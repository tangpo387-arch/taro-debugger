import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemoryViewComponent } from './memory-view.component';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { SimpleChange } from '@angular/core';

import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { JumpToAddressDialogComponent } from '@taro/ui-shared';

describe('MemoryViewComponent', () => {
  let component: MemoryViewComponent;
  let fixture: ComponentFixture<MemoryViewComponent>;
  let mockDialog: any;

  beforeEach(async () => {
    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(null)
      })
    };

    await TestBed.configureTestingModule({
      imports: [MemoryViewComponent, ScrollingModule, MatDialogModule],
      providers: [
        { provide: MatDialog, useValue: mockDialog }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MemoryViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Data Processing', () => {
    it('should render 16-byte row alignment', () => {
      // Arrange
      const data = new Uint8Array(32).fill(0);
      component.data = data;

      // Act
      component.ngOnChanges({
        data: new SimpleChange(null, data, true)
      });

      // Assert
      expect(component.rows.length).toBe(2);
      expect(component.rows[0].bytes.length).toBe(16);
      expect(component.rows[1].bytes.length).toBe(16);
    });

    it('should calculate addresses correctly using BigInt', () => {
      // Arrange
      const baseAddress = '0x00007FFFFFFFDC00';
      const data = new Uint8Array(32).fill(0);
      component.baseAddress = baseAddress;
      component.data = data;

      // Act
      component.ngOnChanges({
        baseAddress: new SimpleChange(null, baseAddress, true),
        data: new SimpleChange(null, data, true)
      });

      // Assert
      expect(component.rows[0].address).toBe('0x00007FFFFFFFDC00');
      expect(component.rows[1].address).toBe('0x00007FFFFFFFDC10');
    });

    it('should convert bytes to hex and ASCII correctly', () => {
      // Arrange
      const data = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00, 0xFF]);
      component.data = data;

      // Act
      component.ngOnChanges({
        data: new SimpleChange(null, data, true)
      });

      // Assert
      const firstRow = component.rows[0];
      // Hex: 48 65 6C 6C 6F 00 FF
      expect(firstRow.bytes[0]).toBe('48');
      expect(firstRow.bytes[1]).toBe('65');
      expect(firstRow.bytes[2]).toBe('6C');
      expect(firstRow.bytes[3]).toBe('6C');
      expect(firstRow.bytes[4]).toBe('6F');
      expect(firstRow.bytes[5]).toBe('00');
      expect(firstRow.bytes[6]).toBe('FF');

      // ASCII: Hello.. (printable chars only)
      expect(firstRow.ascii.startsWith('Hello..')).toBe(true);
    });
  });

  describe('Highlighting', () => {
    it('should identify highlighted bytes within range', () => {
      // Arrange
      component.highlightedRange = { start: 2, length: 3 };

      // Act & Assert
      expect(component.isHighlighted(0, 1)).toBe(false); // Index 1
      expect(component.isHighlighted(0, 2)).toBe(true);  // Index 2
      expect(component.isHighlighted(0, 3)).toBe(true);  // Index 3
      expect(component.isHighlighted(0, 4)).toBe(true);  // Index 4
      expect(component.isHighlighted(0, 5)).toBe(false); // Index 5
    });

    it('should handle multi-row highlighting', () => {
      // Arrange
      // Row 0 is 0-15, Row 1 is 16-31
      component.highlightedRange = { start: 15, length: 2 };

      // Act & Assert
      expect(component.isHighlighted(0, 14)).toBe(false);
      expect(component.isHighlighted(0, 15)).toBe(true);  // Last byte of row 0
      expect(component.isHighlighted(1, 0)).toBe(true);   // First byte of row 1
      expect(component.isHighlighted(1, 1)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should clear rows when empty data is provided', () => {
      // Arrange
      const data = new Uint8Array(0);
      component.data = data;

      // Act
      component.ngOnChanges({
        data: new SimpleChange(null, data, true)
      });

      // Assert
      expect(component.rows.length).toBe(0);
    });

    it('should pad partial rows at the end of the buffer', () => {
      // Arrange
      const data = new Uint8Array(5).fill(0x41); // 'AAAAA'
      component.data = data;

      // Act
      component.ngOnChanges({
        data: new SimpleChange(null, data, true)
      });

      // Assert
      expect(component.rows.length).toBe(1);
      const row = component.rows[0];
      expect(row.bytes[4]).toBe('41');
      expect(row.bytes[5]).toBe(''); // Padded
      expect(row.ascii[4]).toBe('A');
      expect(row.ascii[5]).toBe(' '); // Padded
    });
  });
});
