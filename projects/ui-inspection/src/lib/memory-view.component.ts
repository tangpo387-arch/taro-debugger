import { Component, Input, OnChanges, SimpleChanges, ViewEncapsulation, ChangeDetectionStrategy, Output, EventEmitter, inject, ViewChild, AfterViewInit, OnDestroy, DestroyRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DapSessionService, DapMemoryService } from '@taro/dap-core';
import { CommonModule } from '@angular/common';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { JumpToAddressDialogComponent, JumpToAddressData } from '@taro/ui-shared';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface MemoryRow {
  address: string;
  bytes: string[];
  ascii: string;
  isUnmapped?: boolean;
}

@Component({
  selector: 'app-memory-view',
  standalone: true,
  imports: [CommonModule, ScrollingModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDialogModule],
  templateUrl: './memory-view.component.html',
  styleUrls: ['./memory-view.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemoryViewComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dapSession = inject(DapSessionService);
  private readonly memoryService = inject(DapMemoryService);

  /** Signal representing the current session connection status */
  public readonly isConnected = toSignal(
    this.dapSession.connectionStatus$,
    { initialValue: false }
  );

  @ViewChild(CdkVirtualScrollViewport) private viewport?: CdkVirtualScrollViewport;

  /** The raw memory bytes to display. */
  @Input() public data: Uint8Array = new Uint8Array(0);

  /** The starting hex address (e.g. 0x00007FFFFFFFDC00n). */
  @Input() public baseAddress: bigint = 0n;

  /** Optional range to highlight for object layout visualization. */
  @Input() public highlightedRange?: { start: number; length: number };

  /** Whether the debugger is currently stopped (enables jump actions). */
  @Input() public isStopped: boolean = false;

  /** Emitted when the user requests a jump to a new address. */
  @Output() public readonly jumpToAddress = new EventEmitter<bigint>();

  public rows: MemoryRow[] = [];
  public readonly BYTES_PER_ROW = 16;
  /** Fixed height per row for virtual scroll optimization (synced with SCSS). */
  public readonly ROW_HEIGHT = 24;

  private resizeObserver?: ResizeObserver;
  private viewportCheckTimeout?: ReturnType<typeof setTimeout>;
  private scrollTimeout?: ReturnType<typeof setTimeout>;

  // ── Infinite Scroll State ──────────────────────────────────────────────────
  private localBaseAddress: bigint = 0n;
  private isFetching = false;
  private lastVisibleAddressStr: string | null = null;

  public ngOnInit(): void {
    this.dapSession.connectionStatus$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(connected => {
      if (!connected) {
        this.rows = [];
        this.localBaseAddress = 0n;
        this.lastVisibleAddressStr = null;
        this.cdr.detectChanges();
      }
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['baseAddress']) {
      this.initializeBuffer();
      this.triggerInitialPrepend();
    }
  }

  private initializeBuffer(): void {
    if (!this.data || this.data.length === 0) {
      this.rows = [];
      this.localBaseAddress = 0n;
      this.lastVisibleAddressStr = null;
      this.cdr.detectChanges();
      return;
    }
    this.localBaseAddress = this.baseAddress;
    this.rows = this.buildRows(this.baseAddress, this.data);
    this.lastVisibleAddressStr = null;
    this.cdr.detectChanges();
  }

  private buildRows(startAddress: bigint, data: Uint8Array): MemoryRow[] {
    const rows: MemoryRow[] = [];
    for (let i = 0; i < data.length; i += this.BYTES_PER_ROW) {
      const rowBytes = data.slice(i, i + this.BYTES_PER_ROW);
      const rowAddr = (startAddress + BigInt(i)).toString(16).toUpperCase().padStart(16, '0');

      const bytes: string[] = [];
      let ascii = '';

      for (let j = 0; j < this.BYTES_PER_ROW; j++) {
        if (j < rowBytes.length) {
          const byte = rowBytes[j];
          bytes.push(byte.toString(16).toUpperCase().padStart(2, '0'));
          ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
        } else {
          bytes.push('');
          ascii += ' ';
        }
      }

      rows.push({
        address: `0x${rowAddr}`,
        bytes,
        ascii
      });
    }
    return rows;
  }

  private buildUnmappedRows(startAddress: bigint, count: number): MemoryRow[] {
    const rows: MemoryRow[] = [];
    for (let i = 0; i < count; i += this.BYTES_PER_ROW) {
      const rowAddr = (startAddress + BigInt(i)).toString(16).toUpperCase().padStart(16, '0');
      const bytes: string[] = Array(this.BYTES_PER_ROW).fill('??');
      const ascii = '.'.repeat(this.BYTES_PER_ROW);
      rows.push({
        address: `0x${rowAddr}`,
        bytes,
        ascii,
        isUnmapped: true
      });
    }
    return rows;
  }

  public ngAfterViewInit(): void {
    // Attach a ResizeObserver to the virtual scroll viewport.
    if (this.viewport && this.viewport.elementRef.nativeElement && typeof ResizeObserver !== 'undefined') {
      let previousHeight = 0;
      this.resizeObserver = new ResizeObserver((entries) => {
        const height = entries[0]?.contentRect?.height || 0;
        const becameVisible = previousHeight === 0 && height > 0;
        previousHeight = height;

        if (this.viewportCheckTimeout) {
          clearTimeout(this.viewportCheckTimeout);
        }
        this.viewportCheckTimeout = setTimeout(() => {
          this.viewport?.checkViewportSize();
          if (becameVisible) {
            this.restoreScrollPosition();
          }
          this.viewportCheckTimeout = undefined;
        }, 50);
      });
      this.resizeObserver.observe(this.viewport.elementRef.nativeElement);
    }

    // Subscribe to scrolledIndexChange for infinite scroll paging triggers.
    this.viewport?.scrolledIndexChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(index => {
        if (this.viewport) {
          const viewportSize = this.viewport.getViewportSize();
          if (viewportSize === 0) return;
          const visibleCount = Math.ceil(viewportSize / this.ROW_HEIGHT);
          this.onViewportScroll(index, visibleCount);
        }
      });

    // Auto-trigger prepend check to allow immediate upward scrolling.
    this.triggerInitialPrepend();
  }

  private restoreScrollPosition(): void {
    if (this.viewport && this.rows.length > 0) {
      let targetRowIndex = -1;
      if (this.lastVisibleAddressStr) {
        targetRowIndex = this.rows.findIndex(row => row.address === this.lastVisibleAddressStr);
      }
      if (targetRowIndex < 0) {
        targetRowIndex = this.rows.findIndex(row => {
          try {
            return BigInt(row.address) === this.baseAddress;
          } catch {
            return false;
          }
        });
      }
      if (targetRowIndex >= 0) {
        const targetOffset = targetRowIndex * this.ROW_HEIGHT;
        this.viewport.scrollToOffset(targetOffset, 'auto');
        this.cdr.detectChanges();
      }
    }
  }

  private triggerInitialPrepend(): void {
    setTimeout(() => {
      if (this.viewport && this.rows.length > 0 && !this.isFetching) {
        const scrollOffset = this.viewport.measureScrollOffset('top') || 0;
        if (scrollOffset === 0) {
          const viewportSize = this.viewport.getViewportSize();
          const visibleCount = viewportSize > 0 ? Math.ceil(viewportSize / this.ROW_HEIGHT) : 10;
          this.checkAndFetchMemory(0, visibleCount);
        }
      }
    }, 100);
  }

  private onViewportScroll(index: number, visibleCount: number): void {
    if (this.isFetching || this.rows.length === 0) return;

    if (index >= 0 && index < this.rows.length) {
      this.lastVisibleAddressStr = this.rows[index].address;
    }

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      this.checkAndFetchMemory(index, visibleCount);
    }, 150);
  }

  private async checkAndFetchMemory(index: number, visibleCount: number): Promise<void> {
    if (this.isFetching || this.rows.length === 0) return;

    const THRESHOLD_ROWS = 10;
    const PAGE_SIZE = 512; // bytes to read = 32 rows
    const PAGE_ROWS = 32;

    if (index <= THRESHOLD_ROWS) {
      this.isFetching = true;
      this.cdr.detectChanges();

      const prependAddress = this.localBaseAddress - BigInt(PAGE_SIZE);
      try {
        const data = await this.memoryService.read(prependAddress, 0, PAGE_SIZE);
        let newRows: MemoryRow[];
        if (data && data.length > 0) {
          newRows = this.buildRows(prependAddress, data);
        } else {
          newRows = this.buildUnmappedRows(prependAddress, PAGE_SIZE);
        }

        // Prepend rows and update base address
        this.rows = [...newRows, ...this.rows];
        this.localBaseAddress = prependAddress;

        // Prune bottom rows if memory limit (1024 rows / 16KB) is exceeded
        const maxRows = 1024;
        if (this.rows.length > maxRows) {
          this.rows = this.rows.slice(0, maxRows);
        }

        this.cdr.detectChanges();

        // Scroll Anchoring: prevent the viewport from jumping during prepend
        if (this.viewport) {
          const currentOffset = this.viewport.measureScrollOffset('top') || 0;
          const addedHeight = newRows.length * this.ROW_HEIGHT;
          this.viewport.scrollToOffset(currentOffset + addedHeight, 'auto');
          this.cdr.detectChanges();
        }
      } catch (err) {
        console.error('Failed to prepend memory', err);
      } finally {
        this.isFetching = false;
        this.cdr.detectChanges();
      }
    } else if (index + visibleCount >= this.rows.length - THRESHOLD_ROWS) {
      this.isFetching = true;
      this.cdr.detectChanges();

      const appendAddress = this.localBaseAddress + BigInt(this.rows.length * this.BYTES_PER_ROW);
      try {
        const data = await this.memoryService.read(appendAddress, 0, PAGE_SIZE);
        let newRows: MemoryRow[];
        if (data && data.length > 0) {
          newRows = this.buildRows(appendAddress, data);
        } else {
          newRows = this.buildUnmappedRows(appendAddress, PAGE_SIZE);
        }

        // Append rows
        this.rows = [...this.rows, ...newRows];

        // Prune top rows if memory limit (1024 rows / 16KB) is exceeded
        const maxRows = 1024;
        let rowsPruned = 0;
        if (this.rows.length > maxRows) {
          rowsPruned = this.rows.length - maxRows;
          this.rows = this.rows.slice(rowsPruned);
          this.localBaseAddress = this.localBaseAddress + BigInt(rowsPruned * this.BYTES_PER_ROW);
        }

        this.cdr.detectChanges();

        // Scroll Anchoring for pruned top rows
        if (rowsPruned > 0 && this.viewport) {
          const currentOffset = this.viewport.measureScrollOffset('top') || 0;
          const prunedHeight = rowsPruned * this.ROW_HEIGHT;
          this.viewport.scrollToOffset(Math.max(0, currentOffset - prunedHeight), 'auto');
          this.cdr.detectChanges();
        }
      } catch (err) {
        console.error('Failed to append memory', err);
      } finally {
        this.isFetching = false;
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

  /**
   * Identifies if a specific byte index in the buffer should be highlighted based on physical addresses.
   */
  public isHighlighted(rowAddressStr: string, byteIndex: number): boolean {
    if (!this.highlightedRange) return false;
    try {
      const rowAddr = BigInt(rowAddressStr);
      const cellAddress = rowAddr + BigInt(byteIndex);
      const highlightStartAddr = this.baseAddress + BigInt(this.highlightedRange.start);
      const highlightEndAddr = highlightStartAddr + BigInt(this.highlightedRange.length);
      return cellAddress >= highlightStartAddr && cellAddress < highlightEndAddr;
    } catch {
      return false;
    }
  }

  public trackByAddress(_index: number, row: MemoryRow): string {
    return row.address;
  }

  /**
   * Opens the Jump to Address dialog.
   */
  public openJumpDialog(): void {
    const dialogRef = this.dialog.open<JumpToAddressDialogComponent, JumpToAddressData, bigint>(JumpToAddressDialogComponent, {
      width: '350px',
      data: {
        title: 'Jump to Address',
        placeholder: 'Address / Reference',
        description: 'Enter a memory address (e.g. 0x4000) or a variable reference.'
      }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result !== undefined) {
        this.jumpToAddress.emit(result);
      }
    });
  }
}

