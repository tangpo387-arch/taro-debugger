import { Component, ChangeDetectorRef, inject, OnDestroy, ViewChild, AfterViewInit, DestroyRef, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule, CdkVirtualScrollViewport, VirtualScrollStrategy, VIRTUAL_SCROLL_STRATEGY } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, Subject, Observable } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { input, effect, signal, forwardRef } from '@angular/core';

import { DapAssemblyCacheService, DapDisassembledInstruction, DapSessionService } from '@taro/dap-core';
import { LAYOUT_COMPACT_MQ, TaroEmptyStateComponent, CppSignaturePipe, JumpToAddressDialogComponent, JumpToAddressData } from '@taro/ui-shared';

/** Set to `true` to enable verbose scroll/layout debug logging for the strategy class. */
const DEBUG_SCROLL = false;

export class AssemblyVirtualScrollStrategy implements VirtualScrollStrategy {
  private viewport: CdkVirtualScrollViewport | null = null;
  private readonly indexChange = new Subject<number>();
  public readonly scrolledIndexChange: Observable<number> = this.indexChange.asObservable();

  private instructions: DapDisassembledInstruction[] = [];
  private rowHeight = 28;

  public setConfig(instructions: DapDisassembledInstruction[], rowHeight: number): void {
    if (DEBUG_SCROLL) console.log(`[AssemblyVirtualScrollStrategy] setConfig: instructions count = ${instructions?.length || 0}, rowHeight = ${rowHeight}`);
    this.instructions = instructions;
    this.rowHeight = rowHeight;
    this.updateContent();
  }

  public attach(viewport: CdkVirtualScrollViewport): void {
    if (DEBUG_SCROLL) console.log('[AssemblyVirtualScrollStrategy] attach viewport called');
    this.viewport = viewport;
    this.updateContent();
  }

  public detach(): void {
    if (DEBUG_SCROLL) console.log('[AssemblyVirtualScrollStrategy] detach viewport called');
    this.viewport = null;
  }

  public onContentScrolled(): void {
    if (DEBUG_SCROLL && this.viewport) {
      console.log(`[AssemblyVirtualScrollStrategy] onContentScrolled: current scrollOffset = ${this.viewport.measureScrollOffset()}`);
    }
    this.updateContent();
  }

  public onDataLengthChanged(): void {
    if (DEBUG_SCROLL) console.log('[AssemblyVirtualScrollStrategy] onDataLengthChanged called');
    this.updateContent();
  }

  public onContentRendered(): void {
    // No-op
  }

  public onRenderedOffsetChanged(): void {
    // No-op
  }

  public scrollToIndex(index: number, behavior?: ScrollBehavior): void {
    if (!this.viewport) {
      if (DEBUG_SCROLL) console.log('[AssemblyVirtualScrollStrategy] scrollToIndex: no viewport attached');
      return;
    }
    const offset = this.getOffsetForIndex(index);
    if (DEBUG_SCROLL) console.log(`[AssemblyVirtualScrollStrategy] scrollToIndex: index = ${index}, calculated offset = ${offset}, behavior = ${behavior}`);
    this.viewport.scrollToOffset(offset, behavior);
  }

  public updateContent(): void {
    if (!this.viewport) {
      if (DEBUG_SCROLL) console.log('[AssemblyVirtualScrollStrategy] updateContent: no viewport attached');
      return;
    }

    if (!this.instructions || this.instructions.length === 0) {
      if (DEBUG_SCROLL) console.log('[AssemblyVirtualScrollStrategy] updateContent: instructions are empty/null');
      this.viewport.setTotalContentSize(0);
      this.viewport.setRenderedRange({ start: 0, end: 0 });
      this.viewport.setRenderedContentOffset(0);
      return;
    }

    const rowHeight = this.rowHeight;
    const viewportSize = this.viewport.getViewportSize();
    const scrollOffset = this.viewport.measureScrollOffset();
    if (DEBUG_SCROLL) console.log(`[AssemblyVirtualScrollStrategy] updateContent start: viewportSize = ${viewportSize}, scrollOffset = ${scrollOffset}, rowHeight = ${rowHeight}`);

    // Calculate total height and cumulative offsets
    let totalHeight = 0;
    const itemOffsets: number[] = [];
    const itemHeights: number[] = [];

    for (const inst of this.instructions) {
      itemOffsets.push(totalHeight);
      const height = inst.isFunctionStart ? rowHeight * 2 : rowHeight;
      itemHeights.push(height);
      totalHeight += height;
    }

    this.viewport.setTotalContentSize(totalHeight);

    // Determine the range of items to render
    const buffer = 200;
    const rangeStartOffset = Math.max(0, scrollOffset - buffer);
    const rangeEndOffset = scrollOffset + viewportSize + buffer;

    let start = 0;
    while (start < this.instructions.length - 1 && itemOffsets[start] + itemHeights[start] <= rangeStartOffset) {
      start++;
    }

    let end = start;
    while (end < this.instructions.length && itemOffsets[end] < rangeEndOffset) {
      end++;
    }

    if (DEBUG_SCROLL) console.log(`[AssemblyVirtualScrollStrategy] updateContent: totalHeight = ${totalHeight}, buffer = ${buffer}, rangeStartOffset = ${rangeStartOffset}, rangeEndOffset = ${rangeEndOffset}, start = ${start}, end = ${end}, renderedContentOffset = ${itemOffsets[start]}`);

    this.viewport.setRenderedRange({ start, end });
    this.viewport.setRenderedContentOffset(itemOffsets[start]);

    // Emit the first visible index
    let firstVisibleIndex = 0;
    while (firstVisibleIndex < this.instructions.length - 1 && itemOffsets[firstVisibleIndex] + itemHeights[firstVisibleIndex] <= scrollOffset) {
      firstVisibleIndex++;
    }
    if (DEBUG_SCROLL) console.log(`[AssemblyVirtualScrollStrategy] updateContent: firstVisibleIndex = ${firstVisibleIndex}`);
    this.indexChange.next(firstVisibleIndex);
  }

  public getOffsetForIndex(index: number): number {
    let offset = 0;
    const limit = Math.min(index, this.instructions.length);
    for (let i = 0; i < limit; i++) {
      offset += this.instructions[i].isFunctionStart ? this.rowHeight * 2 : this.rowHeight;
    }
    return offset;
  }
}

@Component({
  selector: 'app-assembly-view',
  standalone: true,
  imports: [CommonModule, ScrollingModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDialogModule, TaroEmptyStateComponent, CppSignaturePipe],
  templateUrl: './assembly-view.component.html',
  styleUrls: ['./assembly-view.component.scss'],
  providers: [
    {
      provide: VIRTUAL_SCROLL_STRATEGY,
      useFactory: (component: AssemblyViewComponent) => component.scrollStrategy,
      deps: [forwardRef(() => AssemblyViewComponent)]
    }
  ]
})
export class AssemblyViewComponent implements AfterViewInit, OnDestroy {
  private readonly DEBUG_SCROLL = false;

  private readonly cacheService = inject(DapAssemblyCacheService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dapSession = inject(DapSessionService);
  private readonly dialog = inject(MatDialog);
  public readonly scrollStrategy = new AssemblyVirtualScrollStrategy();

  /** Signal representing the current session connection status */
  public readonly isConnected = toSignal(
    this.dapSession.connectionStatus$,
    { initialValue: false }
  );

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
  private static readonly ASSEMBLY_WINDOW_SIZE = 201;
  private static readonly ASSEMBLY_WINDOW_OFFSET = -100;

  constructor() {
    const pcSyncEffect = effect(() => {
      const pc = this.currentPc();
      if (this.DEBUG_SCROLL) console.log(`[AssemblyView] pcSyncEffect: currentPc updated to: ${pc !== undefined ? '0x' + pc.toString(16) : 'undefined'}`);
      if (pc !== undefined) {
        this.viewAnchor.set(pc);
      }
    });

    const relocateEffect = effect(() => {
      const anchor = this.viewAnchor();
      if (this.DEBUG_SCROLL) console.log(`[AssemblyView] relocateEffect: viewAnchor updated to: ${anchor !== undefined ? '0x' + anchor.toString(16) : 'undefined'}`);
      if (anchor !== undefined) {
        const hasAddress = this.instructions.some(i => i.address === anchor);
        if (hasAddress) {
          if (this.DEBUG_SCROLL) console.log(`[AssemblyView] relocateEffect: Address 0x${anchor.toString(16)} already loaded, scrolling directly`);
          if (this.viewport) {
            this.isJumping = true;
          }
          this.scrollToAddress(anchor);
        } else {
          if (this.DEBUG_SCROLL) console.log(`[AssemblyView] relocateEffect: Address 0x${anchor.toString(16)} not loaded, relocating window`);
          this.relocateWindow(anchor, 'jump');
        }
      }
    });

    const scrollSyncEffect = effect(() => {
      const height = this.rowHeight();
      if (this.DEBUG_SCROLL) console.log(`[AssemblyView] scrollSyncEffect: rowHeight updated to: ${height}, instructions count: ${this.instructions.length}`);
      this.scrollStrategy.setConfig(this.instructions, height);
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

  private resizeObserver?: ResizeObserver;
  private viewportCheckTimeout?: ReturnType<typeof setTimeout>;
  private scrollTimeout?: ReturnType<typeof setTimeout>;

  /**
   * True while a programmatic jump-scroll is in flight.
   * Suppresses auto-fetch triggers from onViewportScroll so a premature
   * backward/forward fetch cannot fire before the centering scroll lands.
   */
  private isJumping: boolean = false;

  /**
   * True while we are aligning the scroll offset after a forward/backward fetch.
   * Suppresses auto-fetch triggers from onViewportScroll.
   */
  private isAligningScroll: boolean = false;
  private aligningScrollTimeout?: ReturnType<typeof setTimeout>;
  private expectedScrollOffset?: number;

  private updateInstructions(
    inst: DapDisassembledInstruction[],
    action: 'forward' | 'backward' | 'jump',
    targetAddress: bigint
  ): void {
    const prevCount = this.instructions.length;
    this.expectedScrollOffset = undefined;

    // For scroll-triggered updates, calculate the relative distance from the top of the viewport
    // to the targetAddress BEFORE we replace the instructions list.
    let distance = 0;
    let hasTarget = false;
    let oldScrollOffset = 0;
    if (this.viewport && (action === 'forward' || action === 'backward')) {
      if (this.aligningScrollTimeout) {
        clearTimeout(this.aligningScrollTimeout);
        this.aligningScrollTimeout = undefined;
      }
      this.isAligningScroll = true;

      const oldIndex = this.instructions.findIndex(i => i.address === targetAddress);
      if (oldIndex >= 0) {
        const oldTargetOffset = this.scrollStrategy.getOffsetForIndex(oldIndex);
        oldScrollOffset = this.viewport.measureScrollOffset('top') || 0;
        distance = oldTargetOffset - oldScrollOffset;
        hasTarget = true;
      }
    }

    if (this.DEBUG_SCROLL) console.log(`[AssemblyView] updateInstructions: action=${action}, targetAddress=0x${targetAddress.toString(16)}, count=${inst?.length || 0}`);
    this.instructions = inst || [];
    this.scrollStrategy.setConfig(this.instructions, this.rowHeight());
    this.cdr.detectChanges();

    if (this.viewport && hasTarget && (action === 'forward' || action === 'backward')) {
      const newIndex = this.instructions.findIndex(i => i.address === targetAddress);
      if (newIndex >= 0) {
        const newTargetOffset = this.scrollStrategy.getOffsetForIndex(newIndex);
        const targetScrollOffset = Math.max(0, newTargetOffset - distance);
        if (this.DEBUG_SCROLL) console.log(`[AssemblyView] updateInstructions ${action} scroll alignment: targetAddress=0x${targetAddress.toString(16)}, oldScrollOffset=${oldScrollOffset}, distance=${distance}, newTargetOffset=${newTargetOffset}, targetScrollOffset=${targetScrollOffset}`);
        this.expectedScrollOffset = targetScrollOffset;
        this.viewport.scrollToOffset(targetScrollOffset, 'auto');
        this.cdr.detectChanges();
      }

      this.aligningScrollTimeout = setTimeout(() => {
        this.isAligningScroll = false;
        this.expectedScrollOffset = undefined;
        this.aligningScrollTimeout = undefined;
        if (this.DEBUG_SCROLL) console.log(`[AssemblyView] updateInstructions: cleared isAligningScroll=false for action=${action}`);
      }, 150);
    } else if (action === 'forward' || action === 'backward') {
      this.aligningScrollTimeout = setTimeout(() => {
        this.isAligningScroll = false;
        this.expectedScrollOffset = undefined;
        this.aligningScrollTimeout = undefined;
        if (this.DEBUG_SCROLL) console.log(`[AssemblyView] updateInstructions: no alignment performed, cleared isAligningScroll=false`);
      }, 0);
    }

    if (action === 'jump') {
      // Guard: block auto-fetch (onViewportScroll) while the centering scroll is in flight.
      // Without this, CDK emits firstVisibleIndex=0 (scroll still at top) immediately after
      // setConfig(), which triggers a backward auto-fetch that corrupts the scroll position
      // and causes an infinite forward-fetch loop.
      this.isJumping = true;
      if (this.DEBUG_SCROLL) console.log(`[AssemblyView] updateInstructions jump: isJumping=true, scheduling scrollToAddress(0x${targetAddress.toString(16)})`);
      // Step 1: checkViewportSize() is asynchronous — it schedules CDK internal updates
      // (setTotalContentSize, setRenderedRange) via an animation frame / zone cycle.
      // We must NOT call scrollToAddress in the same setTimeout tick, or the scroll
      // will be applied before CDK has registered the new content height, causing
      // the browser to silently clamp the offset to the old scroll boundary.
      // Step 2: A second setTimeout gives CDK the full current event loop turn to
      // finish its size update before we compute and apply the scroll offset.
      setTimeout(() => {
        if (this.DEBUG_SCROLL) console.log('[AssemblyView] updateInstructions jump step-1: calling checkViewportSize');
        this.viewport?.checkViewportSize();
        setTimeout(() => {
          if (this.DEBUG_SCROLL) console.log('[AssemblyView] updateInstructions jump step-2: calling scrollToAddress after CDK size update');
          this.scrollToAddress(targetAddress);
        }, 0);
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
        if (this.DEBUG_SCROLL) console.log(`[AssemblyView] ResizeObserver callback: height=${height}, previousHeight=${previousHeight}, becameVisible=${becameVisible}`);
        previousHeight = height;

        // Wrap in setTimeout to prevent ResizeObserver limits and ExpressionChanged errors.
        if (this.viewportCheckTimeout) {
          clearTimeout(this.viewportCheckTimeout);
        }
        this.viewportCheckTimeout = setTimeout(() => {
          if (this.DEBUG_SCROLL) console.log('[AssemblyView] ResizeObserver viewportCheckTimeout fired: checking viewport size');
          this.viewport?.checkViewportSize();
          if (becameVisible) {
            const anchor = this.viewAnchor();
            if (this.DEBUG_SCROLL) console.log(`[AssemblyView] ResizeObserver becameVisible=true, viewAnchor=0x${anchor !== undefined ? anchor.toString(16) : 'undefined'}, calling scrollToAddress`);
            if (anchor !== undefined) {
              // Guard: block auto-fetch while centering scroll is in flight.
              this.isJumping = true;
              if (this.DEBUG_SCROLL) console.log('[AssemblyView] ResizeObserver becameVisible: isJumping=true');
              this.scrollToAddress(anchor); // Instantly center when tab becomes visible
            }
          }
          this.viewportCheckTimeout = undefined;
        }, 50);
      });
      this.resizeObserver.observe(this.viewport.elementRef.nativeElement);
    }

    // Subscribe to scroll events to trigger auto-fetch
    this.viewport?.scrolledIndexChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(index => {
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

    // Clear instructions on connection loss
    this.dapSession.connectionStatus$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(connected => {
      if (!connected) {
        this.instructions = [];
        this.scrollStrategy.setConfig(this.instructions, this.rowHeight());
        this.cdr.detectChanges();
      }
    });
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.viewportCheckTimeout) {
      clearTimeout(this.viewportCheckTimeout);
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    if (this.aligningScrollTimeout) {
      clearTimeout(this.aligningScrollTimeout);
    }
  }

  public openJumpToAddressDialog(): void {
    const dialogRef = this.dialog.open<JumpToAddressDialogComponent, JumpToAddressData, bigint>(JumpToAddressDialogComponent, {
      width: '350px',
      data: {
        title: 'Jump to Address',
        placeholder: 'Address / Symbol',
        description: 'Enter a numeric address or a function symbol to disassemble.'
      }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result !== undefined) {
        if (this.DEBUG_SCROLL && isDevMode()) {
          console.log(`[openJumpToAddressDialog] Updating viewAnchor to ${result.toString(16)}`);
        }
        this.viewAnchor.set(result);
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
    const displaySymbol = inst.symbol || inst.normalizedSymbol;
    if (displaySymbol) {
      tooltip += `\nSYMBOL:   ${wrapText(displaySymbol, 75)}`;
    }

    return tooltip;
  }

  private relocateToken: number = 0;

  private scrollToAddress(address: bigint): void {
    if (this.DEBUG_SCROLL) console.log(`[AssemblyView] scrollToAddress called with address: 0x${address.toString(16)}`);
    if (!this.viewport) {
      console.warn('[AssemblyView] scrollToAddress: No viewport available');
      return;
    }

    const nativeEl = this.viewport?.elementRef?.nativeElement;
    if (this.DEBUG_SCROLL) console.log('[AssemblyView] scrollToAddress: nativeElement layout measurements on entry:', {
      offsetHeight: nativeEl?.offsetHeight,
      scrollHeight: nativeEl?.scrollHeight,
      scrollTop: nativeEl?.scrollTop
    });

    const activeIndex = this.instructions.findIndex(i => i.address === address);
    if (this.DEBUG_SCROLL) console.log(`[AssemblyView] scrollToAddress: activeIndex found: ${activeIndex} (total instructions: ${this.instructions.length})`);

    if (activeIndex >= 0) {
      if (this.scrollTimeout) {
        if (this.DEBUG_SCROLL) console.log('[AssemblyView] scrollToAddress: Clearing existing scrollTimeout');
        clearTimeout(this.scrollTimeout);
      }
      this.scrollTimeout = setTimeout(() => {
        if (this.viewport) {
          const innerNativeEl = this.viewport?.elementRef?.nativeElement;
          if (this.DEBUG_SCROLL) console.log('[AssemblyView] scrollToAddress timeout callback nativeElement layout measurements:', {
            offsetHeight: innerNativeEl?.offsetHeight,
            scrollHeight: innerNativeEl?.scrollHeight,
            scrollTop: innerNativeEl?.scrollTop
          });

          // Measure the viewport and row size inside the timeout to ensure the DOM layout has settled.
          const viewportSize = this.viewport.getViewportSize() || 400;
          const rowHeight = this.rowHeight() || 28;
          if (this.DEBUG_SCROLL) console.log(`[AssemblyView] scrollToAddress timeout fired: measured viewportSize=${viewportSize}, rowHeight=${rowHeight}`);

          // Calculate the exact pixel offset required to center the active row content
          let accumulatedHeight = 0;
          for (let i = 0; i < activeIndex; i++) {
            accumulatedHeight += this.instructions[i].isFunctionStart ? (rowHeight * 2) : rowHeight;
          }

          const topOfInstructionContent = accumulatedHeight + (this.instructions[activeIndex].isFunctionStart ? rowHeight : 0);
          const centerOffsetPx = (viewportSize / 2) - (rowHeight / 2);
          const targetOffset = Math.max(0, topOfInstructionContent - centerOffsetPx);

          if (this.DEBUG_SCROLL) console.log(`[AssemblyView] scrollToAddress calculation details: accumulatedHeight=${accumulatedHeight}, topOfInstructionContent=${topOfInstructionContent}, centerOffsetPx=${centerOffsetPx}, targetOffset=${targetOffset}`);

          // Force center alignment via direct offset manipulation
          if (this.DEBUG_SCROLL) {
            console.log(`[AssemblyView] view port size ${viewportSize}, row height ${rowHeight}`);
            console.log(`[AssemblyView] Scrolling to address 0x${address.toString(16)} at index ${activeIndex} with offset ${targetOffset}`);
          }
          this.viewport.scrollToOffset(targetOffset, 'auto');

          // Release the jump guard immediately after the scroll is applied.
          // This allows onViewportScroll to resume auto-fetch from the correct
          // centered position rather than the stale top/bottom offset.
          this.isJumping = false;
          if (this.DEBUG_SCROLL) console.log('[AssemblyView] scrollToAddress: isJumping=false (scroll applied)');

          // Verify the scroll position at 50ms and 200ms to see if layout changes or scrolling resets it.
          setTimeout(() => {
            if (this.viewport) {
              const actualOffset = this.viewport.measureScrollOffset();
              if (this.DEBUG_SCROLL) console.log(`[AssemblyView] scrollToAddress verification (50ms post-scroll): targetOffset=${targetOffset}, actualOffset=${actualOffset}, scrollTop=${this.viewport.elementRef?.nativeElement?.scrollTop}`);
            }
          }, 50);

          setTimeout(() => {
            if (this.viewport) {
              const actualOffset = this.viewport.measureScrollOffset();
              if (this.DEBUG_SCROLL) console.log(`[AssemblyView] scrollToAddress verification (200ms post-scroll): targetOffset=${targetOffset}, actualOffset=${actualOffset}, scrollTop=${this.viewport.elementRef?.nativeElement?.scrollTop}`);
            }
          }, 200);
        } else {
          // If the viewport disappeared, release the guard to prevent a permanent lock.
          this.isJumping = false;
          console.warn('[AssemblyView] scrollToAddress timeout fired but viewport is gone; isJumping=false');
        }
        this.scrollTimeout = undefined;
      }, 50);
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
    // 1. Fallback: Dim if it's typical zero padding (out-of-range memory)
    if (instruction.instructionBytes === '00 00 00 00' || instruction.instruction === 'add %al, (%rax)') {
      return true;
    }

    // 2. Strong padding detection (All-zero bytes)
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
    if (this.DEBUG_SCROLL) console.log(`[AssemblyView] relocateWindow start: token=${currentToken}, memoryReference=0x${memoryReference.toString(16)}, action=${action}`);
    this.isLoading.set(true);
    try {
      const instructions = await this.cacheService.fetchInstructions(
        memoryReference,
        instructionCount,
        instructionOffset
      );
      if (this.relocateToken !== currentToken) {
        if (this.DEBUG_SCROLL) console.log(`[AssemblyView] relocateWindow ignored: stale token (currentToken=${currentToken}, relocateToken=${this.relocateToken})`);
        return; // Ignore stale request results
      }

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
    if (this.isAligningScroll && this.viewport && this.expectedScrollOffset !== undefined) {
      const currentOffset = this.viewport.measureScrollOffset('top') || 0;
      const viewportSizePx = this.viewport.getViewportSize() || 0;
      const maxScroll = Math.max(0, (this.viewport.elementRef.nativeElement.scrollHeight || 0) - viewportSizePx);
      const expected = Math.min(maxScroll, Math.max(0, this.expectedScrollOffset));
      if (Math.abs(currentOffset - expected) < 2) {
        this.isAligningScroll = false;
        this.expectedScrollOffset = undefined;
        if (this.aligningScrollTimeout) {
          clearTimeout(this.aligningScrollTimeout);
          this.aligningScrollTimeout = undefined;
        }
        if (this.DEBUG_SCROLL) console.log(`[AssemblyView] onViewportScroll: aligning scroll offset reached expected ${expected} (actual ${currentOffset}), cleared guard`);
        return;
      }
    }

    const current = this.instructions;
    if (this.DEBUG_SCROLL) console.log(`[AssemblyView] onViewportScroll: index=${index}, viewportSize=${viewportSize}, loading=${this.isLoading()}, jumping=${this.isJumping}, aligningScroll=${this.isAligningScroll}, instructionsLength=${current.length}`);
    if (current.length === 0 || current[0].address === undefined || this.isLoading() || this.isJumping || this.isAligningScroll) {
      if (this.isJumping) {
        if (this.DEBUG_SCROLL) console.log(`[AssemblyView] onViewportScroll: suppressed (isJumping=true), index=${index}`);
      }
      if (this.isAligningScroll) {
        if (this.DEBUG_SCROLL) console.log(`[AssemblyView] onViewportScroll: suppressed (isAligningScroll=true), index=${index}`);
      }
      return;
    }

    let action: "forward" | "backward" | undefined;
    if (index + viewportSize >= current.length - AssemblyViewComponent.AUTO_FETCH_THRESHOLD) {
      action = 'forward';
    } else if (index <= AssemblyViewComponent.AUTO_FETCH_THRESHOLD) {
      action = 'backward';
    }
    if (action !== undefined) {
      if (this.DEBUG_SCROLL) console.log(`[AssemblyView] onViewportScroll: index=${index}, viewportSize=${viewportSize}, action=${action}`);
      // Anchor the fetch to the visible region top, not the buffer start,
      // so the new window is centered on where the user is actually scrolling.
      const visibleTopAddress = current[index]?.address ?? current[0].address;
      await this.relocateWindow(visibleTopAddress, action,
        AssemblyViewComponent.ASSEMBLY_WINDOW_SIZE, AssemblyViewComponent.ASSEMBLY_WINDOW_OFFSET);
    }
  }

}
