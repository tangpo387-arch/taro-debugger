import { Component, ChangeDetectorRef, inject, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, ViewChild, AfterViewInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, Subscription } from 'rxjs';

import { DapAssemblyService, TaroDisassembledInstruction } from './dap-assembly.service';
import { DapDisassembledInstruction } from '@taro/dap-core';
import { LAYOUT_COMPACT_MQ, TaroEmptyStateComponent } from '@taro/ui-shared';

@Component({
  selector: 'app-assembly-view',
  standalone: true,
  imports: [CommonModule, ScrollingModule, MatIconModule, MatButtonModule, MatTooltipModule, TaroEmptyStateComponent],
  templateUrl: './assembly-view.component.html',
  styleUrls: ['./assembly-view.component.scss']
})
export class AssemblyViewComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  private readonly assemblyService = inject(DapAssemblyService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input() public instructionPointerReference: string | null = null;
  /** Emits to toggle breakpoint at a specific address (stub for integration) */
  //@Output() public toggleBreakpoint = new EventEmitter<string>();

  @ViewChild(CdkVirtualScrollViewport) viewport?: CdkVirtualScrollViewport;

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
          // Only jump to IP if we haven't scrolled to this specific address yet
          // to prevent jumping back during infinite scroll expansion.
          if (this.instructionPointerReference &&
            this.normalizeAddress(this.instructionPointerReference) !== this.normalizeAddress(this.lastScrolledIP)) {
            this.scrollToCurrentInstruction();
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
      this.resizeObserver = new ResizeObserver(() => {
        // Wrap in setTimeout to prevent ResizeObserver limits and ExpressionChanged errors.
        if (this.viewportCheckTimeout) {
          clearTimeout(this.viewportCheckTimeout);
        }
        this.viewportCheckTimeout = setTimeout(() => {
          this.viewport?.checkViewportSize();
          this.viewportCheckTimeout = undefined;
        }, 0);
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

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['instructionPointerReference']) {
      this.scrollToCurrentInstruction();
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

  public trackByAddress(_index: number, item: TaroDisassembledInstruction): string {
    return item.address;
  }

  /**
   * Normalizes hex addresses for reliable comparison (strips 0x and lowercases)
   */
  private normalizeAddress(addr: string | null | undefined): string {
    if (!addr) return '';
    const lower = addr.toLowerCase();
    if (lower.startsWith('0x')) {
      try {
        return BigInt(lower).toString(16);
      } catch { }
    }
    return lower.replace(/^0x/, '');
  }

  private lastScrolledIP: string | null = null;

  /**
   * Manually triggers a scroll to center the current instruction pointer.
   * Resets the lastScrolledIP to force the scroll logic to execute even if
   * the IP hasn't changed (e.g. user scrolled away and wants to return).
   */
  public revealPC(): void {
    this.lastScrolledIP = null;
    this.scrollToCurrentInstruction();
  }

  private scrollToCurrentInstruction(): void {
    if (!this.instructionPointerReference || this.instructions.length === 0 || !this.viewport) return;

    const normalizedTarget = this.normalizeAddress(this.instructionPointerReference);

    // Find the active instruction using normalized comparison
    const activeIndex = this.instructions.findIndex(i =>
      this.normalizeAddress(i.address) === normalizedTarget
    );

    if (activeIndex >= 0) {
      // Determine if this is a new IP we haven't scrolled to yet
      if (this.normalizeAddress(this.instructionPointerReference) !== this.normalizeAddress(this.lastScrolledIP)) {
        this.lastScrolledIP = this.instructionPointerReference;

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
            this.viewport.scrollToOffset(targetOffset, 'smooth');
          }
          this.scrollTimeout = null;
        }, 50);
      }

      this.updateStickyHeader(activeIndex);
    }
  }

  public isInstructionPointer(address: string): boolean {
    return this.normalizeAddress(address) === this.normalizeAddress(this.instructionPointerReference);
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
    if (this.instructionPointerReference) {
      const activeInst = this.instructions.find(i => this.normalizeAddress(i.address) === this.normalizeAddress(this.instructionPointerReference));
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
