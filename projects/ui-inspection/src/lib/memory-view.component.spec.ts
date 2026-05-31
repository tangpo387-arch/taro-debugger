import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemoryViewComponent } from './memory-view.component';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { SimpleChange } from '@angular/core';

import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { JumpToAddressDialogComponent } from '@taro/ui-shared';
import { DapSessionService, DapMemoryService } from '@taro/dap-core';
import { vi } from 'vitest';

describe('MemoryViewComponent', () => {
  let component: MemoryViewComponent;
  let fixture: ComponentFixture<MemoryViewComponent>;
  let mockDialog: any;
  let mockMemoryService: any;

  beforeEach(async () => {
    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(null)
      })
    };

    mockMemoryService = {
      read: vi.fn().mockResolvedValue(new Uint8Array(512).fill(0xAA)),
      write: vi.fn().mockResolvedValue(1)
    };

    await TestBed.configureTestingModule({
      imports: [MemoryViewComponent, ScrollingModule, MatDialogModule],
      providers: [
        { provide: MatDialog, useValue: mockDialog },
        { provide: DapMemoryService, useValue: mockMemoryService },
        { 
          provide: DapSessionService, 
          useValue: { 
            connectionStatus$: of(true) 
          } 
        }
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
      const baseAddress = 0x00007FFFFFFFDC00n;
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
    beforeEach(() => {
      component.baseAddress = 0x1000n;
    });

    it('should identify highlighted bytes within range', () => {
      // Arrange
      component.highlightedRange = { start: 2, length: 3 };

      // Act & Assert
      expect(component.isHighlighted('0x1000', 1)).toBe(false); // Index 1
      expect(component.isHighlighted('0x1000', 2)).toBe(true);  // Index 2
      expect(component.isHighlighted('0x1000', 3)).toBe(true);  // Index 3
      expect(component.isHighlighted('0x1000', 4)).toBe(true);  // Index 4
      expect(component.isHighlighted('0x1000', 5)).toBe(false); // Index 5
    });

    it('should handle multi-row highlighting', () => {
      // Arrange
      // Row 0 is 0x1000, Row 1 is 0x1010
      component.highlightedRange = { start: 15, length: 2 };

      // Act & Assert
      expect(component.isHighlighted('0x1000', 14)).toBe(false);
      expect(component.isHighlighted('0x1000', 15)).toBe(true);  // Last byte of row 0
      expect(component.isHighlighted('0x1010', 0)).toBe(true);   // First byte of row 1
      expect(component.isHighlighted('0x1010', 1)).toBe(false);
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

  describe('Infinite Scroll & Anchoring', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      component.baseAddress = 0x2000n;
      component.data = new Uint8Array(256).fill(0xBB);
      component.ngOnChanges({
        baseAddress: new SimpleChange(null, 0x2000n, true),
        data: new SimpleChange(null, component.data, true)
      });
      fixture.detectChanges();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should trigger prepend memory fetch on scroll near top', async () => {
      const viewport = component['viewport']!;
      vi.spyOn(viewport, 'getViewportSize').mockReturnValue(100);
      vi.spyOn(viewport, 'measureScrollOffset').mockReturnValue(10);
      vi.spyOn(viewport, 'scrollToOffset').mockImplementation(() => {});

      // Act: scroll near top (index = 5, THRESHOLD_ROWS = 10)
      component['onViewportScroll'](5, 4);
      vi.advanceTimersByTime(150);
      await fixture.whenStable();

      // Assert: DapMemoryService.read should be called with preceding address (0x2000 - 512 = 0x1E00)
      expect(mockMemoryService.read).toHaveBeenCalledWith(0x1E00n, 0, 512);
    });

    it('should correct scroll offset after prepend operations (Scroll Anchoring)', async () => {
      const viewport = component['viewport']!;
      vi.spyOn(viewport, 'getViewportSize').mockReturnValue(100);
      vi.spyOn(viewport, 'measureScrollOffset').mockReturnValue(10);
      const scrollToOffsetSpy = vi.spyOn(viewport, 'scrollToOffset').mockImplementation(() => {});

      // Act
      component['onViewportScroll'](2, 4);
      vi.advanceTimersByTime(150);
      await fixture.whenStable();

      // Assert: scroll anchoring calculation
      // PAGE_SIZE = 512 bytes = 32 rows. ROW_HEIGHT = 24. Added height = 32 * 24 = 768.
      // Expected new offset = currentOffset (10) + addedHeight (768) = 778.
      expect(scrollToOffsetSpy).toHaveBeenCalledWith(778, 'auto');
    });

    it('should render unmapped placeholders on failed memory reads', async () => {
      mockMemoryService.read.mockResolvedValueOnce(new Uint8Array(0)); // simulate read failure
      
      const viewport = component['viewport']!;
      vi.spyOn(viewport, 'getViewportSize').mockReturnValue(100);
      vi.spyOn(viewport, 'measureScrollOffset').mockReturnValue(10);
      vi.spyOn(viewport, 'scrollToOffset').mockImplementation(() => {});

      // Act
      component['onViewportScroll'](2, 4);
      vi.advanceTimersByTime(150);
      await fixture.whenStable();

      // Assert: rows should be prepended
      // Initial: 256 bytes = 16 rows. Added: 32 unmapped rows. Total: 48 rows.
      expect(component.rows.length).toBe(48);
      // Prepended row at index 0 should be unmapped with '??' cells
      expect(component.rows[0].isUnmapped).toBe(true);
      expect(component.rows[0].bytes[0]).toBe('??');
    });

    it('should restore scroll position to align baseAddress when tab becomes visible again', async () => {
      const viewport = component['viewport']!;
      const scrollToOffsetSpy = vi.spyOn(viewport, 'scrollToOffset').mockImplementation(() => {});

      // Prepend some rows so that baseAddress is no longer at index 0
      // Initial baseAddress: 0x2000n.
      // Prepend PAGE_SIZE = 512 bytes = 32 rows.
      // PrependAddress = 0x1E00n.
      // rows index of 0x2000n will be exactly 32.
      // targetOffset = 32 * ROW_HEIGHT (24) = 768px.
      component['localBaseAddress'] = 0x1E00n;
      component.rows = [
        ...component['buildUnmappedRows'](0x1E00n, 512),
        ...component['buildRows'](0x2000n, new Uint8Array(256).fill(0xBB))
      ];

      // Act
      component['restoreScrollPosition']();

      // Assert
      expect(scrollToOffsetSpy).toHaveBeenCalledWith(768, 'auto');
    });

    it('should restore scroll position to the last visible address string when present', async () => {
      const viewport = component['viewport']!;
      const scrollToOffsetSpy = vi.spyOn(viewport, 'scrollToOffset').mockImplementation(() => {});

      // Prepend some rows
      component['localBaseAddress'] = 0x1E00n;
      component.rows = [
        ...component['buildUnmappedRows'](0x1E00n, 512),
        ...component['buildRows'](0x2000n, new Uint8Array(256).fill(0xBB))
      ];

      // User scrolls to index 35 (which is 0x2030, since each row is 16 bytes: 0x2000 + 3 * 16 = 0x2030)
      component['lastVisibleAddressStr'] = '0x0000000000002030';

      // Act
      component['restoreScrollPosition']();

      // Assert
      // Row 35 is found at index 35. targetOffset = 35 * ROW_HEIGHT (24) = 840px.
      expect(scrollToOffsetSpy).toHaveBeenCalledWith(840, 'auto');
    });
  });

  describe('Inline Memory Editing (WI-121)', () => {
    beforeEach(() => {
      component.isStopped = true;
      component.baseAddress = 0x2000n;
      component.data = new Uint8Array([0x41, 0x42, 0x43]); // 'ABC'
      component.ngOnChanges({
        baseAddress: new SimpleChange(null, 0x2000n, true),
        data: new SimpleChange(null, component.data, true)
      });
      fixture.detectChanges();
    });

    it('should activate inline editing on double-click when debugger is stopped and cell is mapped', () => {
      // Act: double-click first cell (row '0x0000000000002000', index 0)
      component.startEdit('0x0000000000002000', 0, '41');

      // Assert
      expect(component.isEditing('0x0000000000002000', 0)).toBe(true);
      expect(component.editValue).toBe('41');
    });

    it('should not activate inline editing if debugger is not stopped', () => {
      component.isStopped = false;
      fixture.detectChanges();

      // In the HTML template, double click is bound with `isStopped` check.
      // We can also check that component doesn't start edit when isFetching is true.
      component['isFetching'] = true;
      component.startEdit('0x0000000000002000', 0, '41');
      expect(component.isEditing('0x0000000000002000', 0)).toBe(false);
    });

    it('should restrict and format user hex input dynamically', () => {
      const mockEvent = {
        target: {
          value: '4g5x'
        }
      } as any;

      component.onInputChange(mockEvent);

      expect(component.editValue).toBe('45');
      expect(mockEvent.target.value).toBe('45');
    });

    it('should invoke DapMemoryService.write with absolute target cell address on confirmation', async () => {
      component.startEdit('0x0000000000002000', 1, '42');
      component.editValue = '46'; // 'F'

      await component.confirmEdit('0x0000000000002000', 1);

      expect(mockMemoryService.write).toHaveBeenCalledWith('0x0000000000002001', 0, new Uint8Array([0x46]));
    });

    it('should commit value, update local row bytes, refresh ASCII preview, and flash success on successful write', async () => {
      component.startEdit('0x0000000000002000', 1, '42');
      component.editValue = '46'; // 'F'
      mockMemoryService.write.mockResolvedValueOnce(1); // successful write of 1 byte

      await component.confirmEdit('0x0000000000002000', 1);

      // Assert row data updated
      expect(component.rows[0].bytes[1]).toBe('46');
      expect(component.rows[0].ascii.startsWith('AFC')).toBe(true);

      // Assert success state set
      expect(component.cellStates['0x0000000000002001']).toBe('success');
    });

    it('should rollback instantly to original value, show error border, and set error tooltip on failed write', async () => {
      component.startEdit('0x0000000000002000', 1, '42');
      component.editValue = 'FF';
      mockMemoryService.write.mockResolvedValueOnce(0); // failed write

      await component.confirmEdit('0x0000000000002000', 1);

      // Assert row data rolled back to original '42' ('B')
      expect(component.rows[0].bytes[1]).toBe('42');
      expect(component.rows[0].ascii.startsWith('ABC')).toBe(true);

      // Assert error state and message set
      expect(component.cellStates['0x0000000000002001']).toBe('error');
      expect(component.cellErrorMessages['0x0000000000002001']).toBe('Write Failed');
    });
  });
});

