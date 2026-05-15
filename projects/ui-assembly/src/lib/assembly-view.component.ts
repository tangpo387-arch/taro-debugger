import { Component, ChangeDetectorRef, inject, OnDestroy, ViewChild, AfterViewInit, DestroyRef, isDevMode } from '@angular/core';
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

import { DapAssemblyCacheService, DapDisassembledInstruction, DapSessionService } from '@taro/dap-core';
import { LAYOUT_COMPACT_MQ, TaroEmptyStateComponent } from '@taro/ui-shared';
import { JumpToAddressDialogComponent } from './jump-to-address-dialog/jump-to-address-dialog.component';

@Component({
  selector: 'app-assembly-view',
  standalone: true,
  imports: [CommonModule, ScrollingModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDialogModule, TaroEmptyStateComponent],
  templateUrl: './assembly-view.component.html',
  styleUrls: ['./assembly-view.component.scss']
})
export class AssemblyViewComponent implements AfterViewInit, OnDestroy {
  private readonly DEBUG_SCROLL = false;

  private readonly cacheService = inject(DapAssemblyCacheService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dapSession = inject(DapSessionService);
  private readonly dialog = inject(MatDialog);

  /** Signal representing the current execution stop state */
  public readonly isStopped = toSignal(
    this.dapSession.executionState$.pipe(map(state => state === 'stopped')),
    { initialValue: false }
  );

  @ViewChild(CdkVirtualScrollViewport) viewport?: CdkVirtualScrollViewport;

  /** Signal representing the current PC */
  public readonly currentPc = input<bigint>();

  /** The anchor address the viewport is currently focused on */
  public readonly viewAnchor = signal<bigint | undefined>(undefined, { equal: () => false });

  // ── Sliding Window Config ────────────────────────────────────────────────
  private static readonly AUTO_FETCH_THRESHOLD = 20;
  private static readonly ASSEMBLY_WINDOW_SIZE = 2001;
  private static readonly ASSEMBLY_WINDOW_OFFSET = -1000;

  constructor() {
    const pcSyncEffect = effect(() => {
      const pc = this.currentPc();
      if (pc !== undefined) {
        this.viewAnchor.set(pc);
      }
    });

    const relocateEffect = effect(() => {
      const anchor = this.viewAnchor();
      if (anchor !== undefined) {
        if (this.DEBUG_SCROLL && isDevMode()) {
          console.log(`Relocating to address ${anchor.toString(16)}`);
        }
        this.relocateWindow(anchor, 'jump');
      }
    });
  }

  /** Responsive row height for cdk-virtual-scroll itemSize */
  public rowHeight = toSignal(
    this.breakpointObserver.observe(LAYOUT_COMPACT_MQ).pipe(
      map(state => state.matches ? 24 : 28)
    ),
    { initialValue: 28 }
  );

  public instructions: DapDisassembledInstruction[] = [];
  public readonly isLoading = signal<boolean>(false);

  /** Current active symbol for sticky header */
  public activeSymbol: string | null = null;

  private resizeObserver?: ResizeObserver;
  private viewportCheckTimeout?: ReturnType<typeof setTimeout>;
  private scrollTimeout?: ReturnType<typeof setTimeout>;

  private updateInstructions(
    inst: DapDisassembledInstruction[],
    action: 'forward' | 'backward' | 'jump',
    targetAddress: bigint
  ): void {
    const prevCount = this.instructions.length;
    const firstOldAddr = prevCount > 0 ? this.instructions[0].address : null;

    this.instructions = inst || [];
    this.cdr.detectChanges();

    if (action === 'backward' && prevCount > 0 && firstOldAddr !== null && firstOldAddr !== undefined) {
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

    if (action === 'jump') {
      setTimeout(() => {
        this.viewport?.checkViewportSize();
        this.scrollToAddress(targetAddress);
      }, 0);
    }
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
            const anchor = this.viewAnchor();
            if (anchor !== undefined) {
              this.scrollToAddress(anchor); // Instantly center when tab becomes visible
            }
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

          // CRITICAL: Ignore scroll events when the tab is hidden.
          // The browser resets scrollTop to 0 when display: none is applied,
          // which would otherwise trigger an erroneous fetchMore('backward').
          if (viewportSize === 0) return;

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
        if (this.DEBUG_SCROLL && isDevMode()) {
          console.log(`[openJumpToAddressDialog] Updating viewAnchor to ${addr.toString(16)}`);
        }
        this.viewAnchor.set(addr);
      }
    });
  }

  /**
   * Navigates the viewport back to the current PC location.
   */
  public revealPc(): void {
    const pc = this.currentPc();
    if (pc !== undefined) {
      this.viewAnchor.set(pc);
    }
  }

  public trackByAddress(_index: number, item: DapDisassembledInstruction): string {
    return item.address?.toString(16) || '';
  }

  /**
   * Formats a bigint address into a standardized hex string for UI display.
   */
  public formatAddress(addr: bigint | undefined): string {
    if (addr === undefined) return '';
    return `0x${addr.toString(16)}`;
  }

  /**
   * Generates a unified, comprehensive tooltip for an instruction row.
   * Format:
   * ADDRESS: 0x1234 <+offset>
   * OPCODE:  90 90
   * DISASM:  nop
   */
  public getInstructionTooltip(inst: DapDisassembledInstruction): string {
    const addr = this.formatAddress(inst.address);
    const offset = inst.byteOffset !== undefined ? `<+${inst.byteOffset}>` : '';
    const bytes = inst.instructionBytes || '--';

    const indent = '          '; // 10 spaces to align with "DISASM:   "
    const wrapText = (text: string, limit: number) => {
      if (text.length <= limit) return text;
      const chunks = [];
      for (let i = 0; i < text.length; i += limit) {
        chunks.push(text.substring(i, i + limit));
      }
      return chunks.join('\n' + indent);
    };

    let disasm = inst.instruction;
    const symbolMatch = disasm.match(/ <.*>$/);
    if (symbolMatch && symbolMatch.index !== undefined) {
      const idx = symbolMatch.index;
      const baseInst = disasm.substring(0, idx);
      const symbolText = disasm.substring(idx + 1);
      disasm = baseInst + '\n' + indent + wrapText(symbolText, 75);
    } else {
      disasm = wrapText(disasm, 85);
    }

    let tooltip = `ADDRESS:  ${addr} ${offset}\nOPCODE:   ${bytes}\nDISASM:   ${disasm}`;
    if (inst.symbol) {
      tooltip += `\nSYMBOL:   ${wrapText(inst.symbol, 75)}`;
    }

    return tooltip;
  }

  private relocateToken: number = 0;

  private scrollToAddress(address: bigint): void {
    if (!this.viewport) return;

    // Find the target instruction
    const activeIndex = this.instructions.findIndex(i =>
      i.address === address
    );

    if (activeIndex >= 0) {
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
          if (this.DEBUG_SCROLL && isDevMode()) {
            console.log(`view port size ${viewportSize}, row height ${rowHeight}`);
            console.log(`Scrolling to address ${address.toString(16)} at index ${activeIndex} with offset ${targetOffset}`);
          }
          this.viewport.scrollToOffset(targetOffset, 'auto');
        }
        this.scrollTimeout = undefined;
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
  public isOutOfRange(instruction: DapDisassembledInstruction): boolean {
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

  private async relocateWindow(
    memoryReference: bigint | undefined,
    action: 'forward' | 'backward' | 'jump',
    instructionCount: number = AssemblyViewComponent.ASSEMBLY_WINDOW_SIZE,
    instructionOffset: number = AssemblyViewComponent.ASSEMBLY_WINDOW_OFFSET
  ): Promise<void> {
    if (memoryReference === undefined) return;

    const currentToken = ++this.relocateToken;
    this.isLoading.set(true);
    try {
      const instructions = await this.cacheService.fetchInstructions(
        memoryReference,
        instructionCount,
        instructionOffset
      );
      if (this.relocateToken !== currentToken) return; // Ignore stale request results

      this.updateInstructions(instructions, action, memoryReference);
    } catch (error: any) {
      if (this.relocateToken !== currentToken) return;
      // DapAssemblyCacheService handles all DAP errors internally (error hint rows).
      // Any exception here is an unexpected component-level fault — preserve the
      // last valid instruction list rather than blanking the viewport.
      console.error('[AssemblyViewComponent] Unexpected error in relocateWindow:', error);
    } finally {
      if (this.relocateToken === currentToken) {
        this.isLoading.set(false);
      }
    }
  }

  private async onViewportScroll(index: number, viewportSize: number): Promise<void> {
    if (this.DEBUG_SCROLL && isDevMode()) {
      console.log(`[AssemblyView] onViewportScroll entry: index=${index}, viewportSize=${viewportSize}, loading=${this.isLoading()}, instructions=${this.instructions.length}`);
    }
    const current = this.instructions;
    if (current.length === 0 || current[0].address === undefined || this.isLoading()) return;

    let action: "forward" | "backward" | undefined;
    if (index + viewportSize >= current.length - AssemblyViewComponent.AUTO_FETCH_THRESHOLD) {
      action = 'forward';
    } else if (index <= AssemblyViewComponent.AUTO_FETCH_THRESHOLD) {
      action = 'backward';
    }
    if (action !== undefined) {
      if (this.DEBUG_SCROLL && isDevMode()) {
        console.log(`[AssemblyView] onViewportScroll: index=${index}, viewportSize=${viewportSize}, action=${action}`);
      }
      // Anchor the fetch to the visible region top, not the buffer start,
      // so the new window is centered on where the user is actually scrolling.
      const visibleTopAddress = current[index]?.address ?? current[0].address;
      await this.relocateWindow(visibleTopAddress, action,
        AssemblyViewComponent.ASSEMBLY_WINDOW_SIZE, AssemblyViewComponent.ASSEMBLY_WINDOW_OFFSET);
    }
  }

}
