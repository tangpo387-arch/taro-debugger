import { Component, Input, OnChanges, SimpleChanges, ViewEncapsulation, ChangeDetectionStrategy, Output, EventEmitter, inject, ViewChild, AfterViewInit, OnDestroy, DestroyRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DapSessionService } from '@taro/dap-core';
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
export class MemoryViewComponent implements OnChanges, AfterViewInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dapSession = inject(DapSessionService);

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

  public ngOnInit(): void {
    this.dapSession.connectionStatus$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(connected => {
      if (!connected) {
        this.rows = [];
        this.cdr.detectChanges();
      }
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['baseAddress']) {
      this.processData();
    }
  }

  public ngAfterViewInit(): void {
    // Attach a ResizeObserver to the virtual scroll viewport.
    // This is required because the component is rendered inside a <mat-tab>,
    // which starts out with 0 height. Without this, the viewport may fail to
    // calculate its true size when the tab becomes active, leading to blank space.
    if (this.viewport && this.viewport.elementRef.nativeElement && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.viewportCheckTimeout) {
          clearTimeout(this.viewportCheckTimeout);
        }
        this.viewportCheckTimeout = setTimeout(() => {
          this.viewport?.checkViewportSize();
          this.viewportCheckTimeout = undefined;
        }, 50);
      });
      this.resizeObserver.observe(this.viewport.elementRef.nativeElement);
    }
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.viewportCheckTimeout) {
      clearTimeout(this.viewportCheckTimeout);
    }
  }

  private processData(): void {
    if (!this.data || this.data.length === 0) {
      this.rows = [];
      return;
    }

    const rows: MemoryRow[] = [];
    const baseAddr = this.baseAddress;

    for (let i = 0; i < this.data.length; i += this.BYTES_PER_ROW) {
      const rowBytes = this.data.slice(i, i + this.BYTES_PER_ROW);
      const rowAddr = (baseAddr + BigInt(i)).toString(16).toUpperCase().padStart(16, '0');

      const bytes: string[] = [];
      let ascii = '';

      for (let j = 0; j < this.BYTES_PER_ROW; j++) {
        if (j < rowBytes.length) {
          const byte = rowBytes[j];
          bytes.push(byte.toString(16).toUpperCase().padStart(2, '0'));
          // ASCII: printable characters are between 32 (space) and 126 (~)
          ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
        } else {
          // Padding for incomplete rows at the end of the buffer
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

    this.rows = rows;
  }

  /**
   * Identifies if a specific byte index in the buffer should be highlighted.
   */
  public isHighlighted(rowIndex: number, byteIndex: number): boolean {
    if (!this.highlightedRange) return false;
    const absoluteIndex = rowIndex * this.BYTES_PER_ROW + byteIndex;
    return absoluteIndex >= this.highlightedRange.start &&
      absoluteIndex < (this.highlightedRange.start + this.highlightedRange.length);
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
