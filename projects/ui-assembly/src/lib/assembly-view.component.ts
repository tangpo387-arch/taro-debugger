import { Component, ChangeDetectorRef, inject, OnDestroy, ViewChild, AfterViewInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { input, effect, signal } from '@angular/core';

import { DapAssemblyCacheService, TaroDisassembledInstruction } from '@taro/dap-core';
import { LAYOUT_COMPACT_MQ, TaroEmptyStateComponent } from '@taro/ui-shared';
import { JumpToAddressDialogComponent } from './jump-to-address-dialog/jump-to-address-dialog.component';

export type { TaroDisassembledInstruction };


@Component({
  selector: 'app-assembly-view',
  standalone: true,
  imports: [CommonModule, ScrollingModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDialogModule, TaroEmptyStateComponent],
  templateUrl: './assembly-view.component.html',
  styleUrls: ['./assembly-view.component.scss']
})
export class AssemblyViewComponent implements AfterViewInit, OnDestroy {
  private readonly cacheService = inject(DapAssemblyCacheService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  @ViewChild(CdkVirtualScrollViewport) viewport?: CdkVirtualScrollViewport;

  /** Signal representing the current PC */
  public readonly currentPc = input<bigint>();

  // ── Sliding Window Config ────────────────────────────────────────────────
  private static readonly AUTO_FETCH_THRESHOLD = 20;
  private static readonly AUTO_FETCH_COUNT = 100;
  private static readonly ASSEMBLY_WINDOW_SIZE = 2001;
  private static readonly ASSEMBLY_WINDOW_OFFSET = -1000;

  constructor() {
    const effectRef = effect(() => {
      const pc = this.currentPc();
      if (pc != undefined) {
        this.relocateWindow(pc);
      }
    });
    this.destroyRef.onDestroy(() => {
      effectRef.destroy();
    });
  }

  /** Responsive row height for cdk-virtual-scroll itemSize */
  public rowHeight = toSignal(
    this.breakpointObserver.observe(LAYOUT_COMPACT_MQ).pipe(
      map(state => state.matches ? 24 : 28)
    ),
    { initialValue: 28 }
  );

  public instructions: TaroDisassembledInstruction[] = [];
  public readonly isLoading = signal<boolean>(false);

  /** Current active symbol for sticky header */
  public activeSymbol: string | null = null;

  private resizeObserver?: ResizeObserver;
  private viewportCheckTimeout?: any;
  private scrollTimeout?: any;

  private updateInstructions(inst: TaroDisassembledInstruction[], direction: 'forward' | 'backward' | 'replace'): void {
    const prevCount = this.instructions.length;
    const firstOldAddr = prevCount > 0 ? this.instructions[0].address : null;

    this.instructions = inst || [];
    this.cdr.detectChanges();

    if (direction === 'backward' && prevCount > 0 && firstOldAddr !== null && firstOldAddr !== undefined) {
      const newFirstIndex = this.instructions.findIndex(i => i.address === firstOldAddr);
      if (newFirstIndex > 0) {
        const addedCount = newFirstIndex;
        const offsetToMove = addedCount * (this.rowHeight() || 28);
        const currentOffset = this.viewport?.measureScrollOffset('top') || 0;
        this.viewport?.scrollToOffset(currentOffset + offsetToMove, 'auto');
        this.cdr.detectChanges();
      }
    }

    if (this.instructions.length > 0 && !this.activeSymbol) {
      this.updateStickyHeader(this.viewport?.measureScrollOffset('top') === 0 ? 0 : (this.viewport?.getRenderedRange().start || 0));
    }

    setTimeout(() => {
      this.viewport?.checkViewportSize();

      if (this.pendingJumpAddress !== undefined) {
        this.scrollToAddress(this.pendingJumpAddress, true);
        this.pendingJumpAddress = undefined;
      } else {
        const pc = this.currentPc();
        if (pc !== undefined && pc !== this.lastScrolledIP) {
          this.scrollToAddress(pc, false);
        }
      }
    }, 0);
  }

  public ngAfterViewInit(): void {
    // Attach a ResizeObserver to the virtual scroll viewport.
    // This is required because the component is rendered inside a <mat-tab>,
    // which starts out with 0 height. Without this, the viewport may fail to
    // calculate its true size when the tab becomes active, leading to blank space.
    if (this.viewport && this.viewport.elementRef.nativeElement && typeof ResizeObserver !== 'undefined') {
      let previousHeight = 0;
      this.resizeObserver = new ResizeObserver((entries) => {
        const height = entries[0]?.contentRect?.height || 0;
        const becameVisible = previousHeight === 0 && height > 0;
        previousHeight = height;

        // Wrap in setTimeout to prevent ResizeObserver limits and ExpressionChanged errors.
        if (this.viewportCheckTimeout) {
          clearTimeout(this.viewportCheckTimeout);
        }
        this.viewportCheckTimeout = setTimeout(() => {
          this.viewport?.checkViewportSize();
          if (becameVisible) {
            this.revealPC(true);
          }
          this.viewportCheckTimeout = undefined;
        }, 50);
      });
      this.resizeObserver.observe(this.viewport.elementRef.nativeElement);
    }

    // Subscribe to scroll events to update the sticky header and trigger auto-fetch
    this.viewport?.scrolledIndexChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(index => {
        this.updateStickyHeader(index);

        if (this.viewport) {
          const viewportSize = this.viewport.getViewportSize();
          const visibleCount = Math.ceil(viewportSize / (this.rowHeight() || 28));
          this.onViewportScroll(index, visibleCount);
        }
      });
  }

  private updateStickyHeader(index: number): void {
    if (this.instructions.length > 0 && index >= 0 && index < this.instructions.length) {
      const currentInst = this.instructions[index];
      // Due to buffer, the actual visible top item might be tricky, but scrolledIndex
      // usually reflects the first visible rendered line. 
      // In case we don't have a symbol, backtrack to the nearest symbol block (though we inherit it now)
      if (currentInst.normalizedSymbol !== this.activeSymbol) {
        this.activeSymbol = currentInst.normalizedSymbol || null;
        this.cdr.detectChanges();
      }
    } else {
      if (this.activeSymbol !== null) {
        this.activeSymbol = null;
        this.cdr.detectChanges();
      }
    }
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.viewportCheckTimeout) {
      clearTimeout(this.viewportCheckTimeout);
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  public openJumpToAddressDialog(): void {
    const dialogRef = this.dialog.open(JumpToAddressDialogComponent, {
      width: '350px'
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        const addr = BigInt(result);
        this.pendingJumpAddress = addr;
        this.relocateWindow(addr);
      }
    });
  }

  public trackByAddress(_index: number, item: TaroDisassembledInstruction): string {
    return item.address?.toString(16) || '';
  }

  /**
   * Formats a bigint address into a standardized hex string for UI display.
   */
  public formatAddress(addr: bigint | undefined): string {
    if (addr === undefined) return '';
    return `0x${addr.toString(16)}`;
  }

  private lastScrolledIP: bigint | undefined = undefined;
  private pendingJumpAddress: bigint | undefined = undefined;
  private relocateToken: number = 0;

  /**
   * Manually triggers a scroll to center the current instruction pointer.
   * Resets the lastScrolledIP to force the scroll logic to execute even if
   * the IP hasn't changed (e.g. user scrolled away and wants to return).
   */
  public revealPC(instant: boolean = false): void {
    this.lastScrolledIP = undefined;
    const pc = this.currentPc();
    if (pc) {
      this.scrollToAddress(pc, instant);
    }
  }

  private scrollToAddress(address: bigint, instant: boolean = false): void {
    if (address === undefined || address === null || this.instructions.length === 0 || !this.viewport) return;

    // Find the target instruction
    const activeIndex = this.instructions.findIndex(i =>
      i.address === address
    );

    if (activeIndex >= 0) {
      const isInitial = this.lastScrolledIP === undefined;
      // Update the lastScrolledIP to the CURRENT PC (if any).
      // This "acknowledges" the current execution point even if we are scrolling elsewhere,
      // preventing the automatic scroll-to-PC logic from snapping back until the PC moves again.
      const currentPc = this.currentPc();
      if (currentPc !== null) {
        this.lastScrolledIP = currentPc;
      }

      // Use a fallback viewport size if the CDK viewport hasn't fully measured the DOM yet
      const viewportSize = this.viewport.getViewportSize() || 400;
      const rowHeight = this.rowHeight() || 28;

      // Calculate the exact pixel offset required to center the active row
      const centerOffsetPx = (viewportSize / 2) - (rowHeight / 2);
      const targetOffset = Math.max(0, (activeIndex * rowHeight) - centerOffsetPx);

      if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        if (this.viewport) {
          // Force center alignment via direct offset manipulation
          const behavior = (instant || isInitial) ? 'auto' : 'smooth';
          this.viewport.scrollToOffset(targetOffset, behavior);
        }
        this.scrollTimeout = null;
      }, 50);

      this.updateStickyHeader(activeIndex);
    }
  }

  public isInstructionPointer(address: bigint | undefined): boolean {
    const pc = this.currentPc();
    return address !== undefined && address === pc;
  }

  /**
   * Checks if an instruction is likely out of the current function range.
   * Dims cross-function boundaries to focus on the active execution context.
   */
  public isOutOfRange(instruction: TaroDisassembledInstruction): boolean {
    // 1. Active pointer is ALWAYS in range
    if (this.isInstructionPointer(instruction.address)) {
      return false;
    }

    // 2. Dim if it belongs to a different function than our active instruction!
    const pc = this.currentPc();
    if (pc) {
      const activeInst = this.instructions.find(i => i.address === pc);
      if (activeInst && activeInst.normalizedSymbol && instruction.normalizedSymbol) {
        if (activeInst.normalizedSymbol !== instruction.normalizedSymbol) {
          return true;
        }
      }
    }

    // 3. Fallback: Dim if it's typical zero padding (out-of-range memory)
    if (instruction.instructionBytes === '00 00 00 00' || instruction.instruction === 'add %al, (%rax)') {
      return true;
    }

    // 4. Strong padding detection (All-zero bytes)
    const bytes = instruction.instructionBytes?.replace(/\s/g, '');
    if (bytes && bytes.length >= 4 && /^0+$/.test(bytes)) {
      return true;
    }

    return false;
  }

  public async relocateWindow(
    memoryReference: bigint,
    instructionCount: number = AssemblyViewComponent.ASSEMBLY_WINDOW_SIZE,
    instructionOffset: number = AssemblyViewComponent.ASSEMBLY_WINDOW_OFFSET
  ): Promise<void> {
    if (!memoryReference) return;
    const currentToken = ++this.relocateToken;

    const currentUI = this.instructions;
    if (currentUI.length > 0) {
      const found = currentUI.some(i => i.address === memoryReference);
      if (found && instructionOffset >= 0) return;
    }

    this.isLoading.set(true);
    try {
      const instructions = await this.cacheService.fetchInstructions(memoryReference, instructionCount, instructionOffset);
      if (this.relocateToken !== currentToken) return; // Ignore stale request results

      this.updateInstructions(instructions, 'replace');
    } catch (error: any) {
      if (this.relocateToken !== currentToken) return;
      this.updateInstructions([], 'replace');
      console.error('[AssemblyViewComponent] relocateWindow failed:', error?.message ?? error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async onViewportScroll(index: number, viewportSize: number): Promise<void> {
    const current = this.instructions;
    if (index + viewportSize >= current.length - AssemblyViewComponent.AUTO_FETCH_THRESHOLD) {
      await this.fetchMore('forward');
    } else if (index <= AssemblyViewComponent.AUTO_FETCH_THRESHOLD) {
      await this.fetchMore('backward');
    }
  }

  private async fetchMore(direction: 'forward' | 'backward'): Promise<void> {
    const current = this.instructions;
    if (current.length === 0 || this.isLoading()) return;

    const count = AssemblyViewComponent.AUTO_FETCH_COUNT;
    const windowSize = AssemblyViewComponent.ASSEMBLY_WINDOW_SIZE;
    const first = current[0].address!;

    const instructionOffset = direction === 'forward' ? count : -count;

    try {
      this.isLoading.set(true);
      const nextList = await this.cacheService.fetchInstructions(first, windowSize, instructionOffset);
      this.updateInstructions(nextList, direction);
    } catch (error) {
      console.error('Auto-fetch failed', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
