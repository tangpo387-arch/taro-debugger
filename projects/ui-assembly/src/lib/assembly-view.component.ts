import { Component, ChangeDetectorRef, inject, OnInit, OnDestroy, ViewChild, AfterViewInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, Subscription } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { DapAssemblyService, TaroDisassembledInstruction } from './dap-assembly.service';
import { LAYOUT_COMPACT_MQ, TaroEmptyStateComponent } from '@taro/ui-shared';
import { JumpToAddressDialogComponent } from './jump-to-address-dialog/jump-to-address-dialog.component';

@Component({
  selector: 'app-assembly-view',
  standalone: true,
  imports: [CommonModule, ScrollingModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDialogModule, TaroEmptyStateComponent],
  templateUrl: './assembly-view.component.html',
  styleUrls: ['./assembly-view.component.scss']
})
export class AssemblyViewComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly assemblyService = inject(DapAssemblyService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  @ViewChild(CdkVirtualScrollViewport) viewport?: CdkVirtualScrollViewport;

  /** Signal representing the current PC from the service */
  public readonly currentPc = toSignal(this.assemblyService.currentPc$);

  /** Responsive row height for cdk-virtual-scroll itemSize */
  public rowHeight = toSignal(
    this.breakpointObserver.observe(LAYOUT_COMPACT_MQ).pipe(
      map(state => state.matches ? 24 : 28)
    ),
    { initialValue: 28 }
  );

  public instructions: TaroDisassembledInstruction[] = [];
  public isLoading: boolean = false;

  /** Current active symbol for sticky header */
  public activeSymbol: string | null = null;

  private resizeObserver?: ResizeObserver | any;
  private viewportCheckTimeout?: any;
  private scrollTimeout?: any;

  public ngOnInit(): void {
    this.assemblyService.instructions$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((inst: TaroDisassembledInstruction[]) => {
        const prevCount = this.instructions.length;
        const firstOldAddr = prevCount > 0 ? this.instructions[0].address : null;

        this.instructions = inst || [];
        this.cdr.detectChanges();

        // Stabilization: If we prepended items (backward scroll), adjust offset to prevent jumping
        if (prevCount > 0 && this.instructions.length > prevCount && firstOldAddr) {
          const newFirstIndex = this.instructions.findIndex(i => i.address === firstOldAddr);
          if (newFirstIndex > 0) {
            const addedCount = newFirstIndex;
            const offsetToMove = addedCount * (this.rowHeight() || 28);
            const currentOffset = this.viewport?.measureScrollOffset('top') || 0;

            // Apply offset adjustment immediately without animation to maintain visual position
            this.viewport?.scrollToOffset(currentOffset + offsetToMove, 'auto');
            this.cdr.detectChanges();
          }
        }

        // Initialize sticky header for the first instruction if not scrolled
        if (this.instructions.length > 0 && !this.activeSymbol) {
          this.updateStickyHeader(this.viewport?.measureScrollOffset('top') === 0 ? 0 : (this.viewport?.getRenderedRange().start || 0));
        }

        // Force virtual scroll to re-evaluate container size after data is rendered
        // to resolve the blank space issue (R_UX_SCROLL_1)
        setTimeout(() => {
          this.viewport?.checkViewportSize();
          
          // If we have a pending jump target, scroll to it.
          // Otherwise, only jump to IP if we haven't scrolled to this specific address yet.
          if (this.pendingJumpAddress) {
            this.scrollToAddress(this.pendingJumpAddress, true);
            this.pendingJumpAddress = null;
          } else {
            const pc = this.currentPc();
            if (pc && this.normalizeAddress(pc) !== this.normalizeAddress(this.lastScrolledIP)) {
              this.scrollToCurrentInstruction();
            }
          }
        }, 0);
      });

    this.assemblyService.isLoading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loading: boolean) => {
        this.isLoading = loading;
        this.cdr.detectChanges();
      });
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
          this.assemblyService.onViewportScroll(index, visibleCount);
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
        this.pendingJumpAddress = result;
        // Use a large count and negative offset to ensure we're centered
        this.assemblyService.relocateWindow(result, 2001, -1000);
      }
    });
  }

  public trackByAddress(_index: number, item: TaroDisassembledInstruction): string {
    return item.address;
  }

  /**
   * Normalizes hex addresses for reliable comparison (strips 0x and lowercases)
   */
  private normalizeAddress(addr: string | null | undefined): string {
    if (!addr) return '';
    const lower = addr.toLowerCase().trim();
    if (lower.startsWith('0x')) {
      try {
        return BigInt(lower).toString(16);
      } catch { }
    }
    return lower.replace(/^0x/, '').trim();
  }

  private lastScrolledIP: string | null = null;
  private pendingJumpAddress: string | null = null;

  /**
   * Manually triggers a scroll to center the current instruction pointer.
   * Resets the lastScrolledIP to force the scroll logic to execute even if
   * the IP hasn't changed (e.g. user scrolled away and wants to return).
   */
  public revealPC(instant: boolean = false): void {
    this.lastScrolledIP = null;
    this.scrollToCurrentInstruction(instant);
  }

  private scrollToCurrentInstruction(instant: boolean = false): void {
    const pc = this.currentPc();
    if (pc) {
      this.scrollToAddress(pc, instant);
    }
  }

  private scrollToAddress(address: string, instant: boolean = false): void {
    if (!address || this.instructions.length === 0 || !this.viewport) return;

    const normalizedTarget = this.normalizeAddress(address);

    // Find the target instruction using normalized comparison
    const activeIndex = this.instructions.findIndex(i =>
      this.normalizeAddress(i.address) === normalizedTarget
    );

    if (activeIndex >= 0) {
      const isInitial = this.lastScrolledIP === null;
      // Update the lastScrolledIP to the CURRENT PC (if any).
      // This "acknowledges" the current execution point even if we are scrolling elsewhere,
      // preventing the automatic scroll-to-PC logic from snapping back until the PC moves again.
      const currentPc = this.currentPc();
      if (currentPc) {
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

  public isInstructionPointer(address: string): boolean {
    const pc = this.currentPc();
    return this.normalizeAddress(address) === this.normalizeAddress(pc);
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
      const activeInst = this.instructions.find(i => this.normalizeAddress(i.address) === this.normalizeAddress(pc));
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
}
