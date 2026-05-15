import { Component, Input, OnChanges, SimpleChanges, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

export interface MemoryRow {
  address: string;
  bytes: string[];
  ascii: string;
}

@Component({
  selector: 'app-memory-view',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  templateUrl: './memory-view.component.html',
  styleUrls: ['./memory-view.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemoryViewComponent implements OnChanges {
  /** The raw memory bytes to display. */
  @Input() public data: Uint8Array = new Uint8Array(0);

  /** The starting hex address string (e.g. "0x00007FFFFFFFDC00"). */
  @Input() public baseAddress: string = '0x0';

  /** Optional range to highlight for object layout visualization. */
  @Input() public highlightedRange?: { start: number; length: number };

  public rows: MemoryRow[] = [];
  public readonly BYTES_PER_ROW = 16;
  /** Fixed height per row for virtual scroll optimization (synced with SCSS). */
  public readonly ROW_HEIGHT = 24;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['baseAddress']) {
      this.processData();
    }
  }

  private processData(): void {
    if (!this.data || this.data.length === 0) {
      this.rows = [];
      return;
    }

    const rows: MemoryRow[] = [];
    const baseAddr = BigInt(this.baseAddress);

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
}
