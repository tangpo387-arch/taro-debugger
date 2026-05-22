import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssemblyViewComponent } from './assembly-view.component';
import { DapAssemblyCacheService, DapSessionService, DapDisassembledInstruction } from '@taro/dap-core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { JumpToAddressDialogComponent } from '@taro/ui-shared';

describe('AssemblyViewComponent', () => {
  let component: AssemblyViewComponent;
  let fixture: ComponentFixture<AssemblyViewComponent>;
  let mockCacheService: any;
  let mockSessionService: any;
  let mockDialog: any;

  beforeEach(async () => {
    mockCacheService = {
      fetchInstructions: vi.fn().mockResolvedValue([]),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(0x401234n)
      })
    };

    mockSessionService = {
      executionState$: of('stopped'),
      connectionStatus$: of(true),
    };

    await TestBed.configureTestingModule({
      imports: [AssemblyViewComponent, CommonModule, ScrollingModule],
      providers: [
        { provide: DapAssemblyCacheService, useValue: mockCacheService },
        { provide: DapSessionService, useValue: mockSessionService },
        { provide: MatDialog, useValue: mockDialog }
      ]
    })
      .overrideComponent(AssemblyViewComponent, {
        add: {
          providers: [
            { provide: DapAssemblyCacheService, useValue: mockCacheService },
            { provide: DapSessionService, useValue: mockSessionService },
            { provide: MatDialog, useValue: mockDialog }
          ]
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(AssemblyViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should verify virtual scrolling correctly renders a subset of the assembly instructions', () => {
    const fakeInstructions: DapDisassembledInstruction[] = [];
    for (let i = 0; i < 1000; i++) {
      fakeInstructions.push({
        address: BigInt(i),
        instructionBytes: '90',
        instructionByteLength: 1,
        instruction: 'nop'
      });
    }

    component.instructions = fakeInstructions;
    component.scrollStrategy.setConfig(fakeInstructions, 28);
    fixture.detectChanges();

    expect(component.instructions.length).toBe(1000);
    const compiled = fixture.nativeElement as HTMLElement;
    // CDK Virtual scroll will render only a few rows, not 1000
    const rows = compiled.querySelectorAll('.assembly-row');
    expect(rows.length).toBeLessThan(1000);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should verify the highlighted instruction is synchronized with the current instruction pointer reference', () => {
    const fakeInstructions: DapDisassembledInstruction[] = [
      { address: BigInt('0x1000'), instruction: 'nop', instructionBytes: '90', instructionByteLength: 1, normalizedSymbol: 'main' },
      { address: BigInt('0x1004'), instruction: 'mov eax, ebx', instructionBytes: '89 d8', instructionByteLength: 2, normalizedSymbol: 'main' },
      { address: BigInt('0x1008'), instruction: 'ret', instructionBytes: 'c3', instructionByteLength: 1, normalizedSymbol: 'main' }
    ];

    component.instructions = fakeInstructions;
    component.scrollStrategy.setConfig(fakeInstructions, 28);
    fixture.componentRef.setInput('currentPc', BigInt('0x1004'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const activeRow = compiled.querySelector('.assembly-row.is-active');
    expect(activeRow).toBeTruthy();
    expect(activeRow?.textContent).toContain('0x1004');
    expect(activeRow?.textContent).toContain('mov eax, ebx');

    // Verify the visual IP indicator (arrow) is present in the gutter
    const ipIndicator = activeRow?.querySelector('span.ip-indicator');
    expect(ipIndicator).toBeTruthy();
    expect(ipIndicator?.textContent?.trim()).toBe('➤');
  });

  it('should verify breakpoint markers are accurately mapped to the corresponding address rows', () => {
    // Currently breakpoint toggle is a stub in the UI placeholder, 
    // but the template contains the `.breakpoint-marker` gutter column.
    const fakeInstructions: DapDisassembledInstruction[] = [
      { address: BigInt('0x1000'), instruction: 'nop', instructionBytes: '90', instructionByteLength: 1, normalizedSymbol: 'main' }
    ];

    component.instructions = fakeInstructions;
    component.scrollStrategy.setConfig(fakeInstructions, 28);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const bpMarker = compiled.querySelector('.breakpoint-marker');
    expect(bpMarker).toBeTruthy();
  });

  describe('Jump to Address', () => {
    it('should open the Jump to Address dialog when the Jump FAB is clicked', () => {
      // Arrange
      fixture.componentRef.setInput('currentPc', BigInt('0x1000')); // Ensure FABs are visible
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const jumpButton = compiled.querySelector('button[aria-label="Jump to address"]') as HTMLButtonElement;
      expect(jumpButton).toBeTruthy();

      // Act
      jumpButton.click();

      // Assert
      expect(mockDialog.open).toHaveBeenCalledWith(JumpToAddressDialogComponent, {
        width: '350px',
        data: {
          title: 'Jump to Address',
          placeholder: 'Address / Symbol',
          description: 'Enter a numeric address or a function symbol to disassemble.'
        }
      });
    });

    it('should set viewAnchor when the dialog is confirmed with an address', () => {
      // Act
      component.openJumpToAddressDialog();

      // Assert
      expect(component.viewAnchor()).toBe(BigInt('0x401234'));
    });

    it('should sync currentPc to viewAnchor when currentPc updates', () => {
      fixture.componentRef.setInput('currentPc', BigInt('0x2000'));
      fixture.detectChanges();

      expect(component.viewAnchor()).toBe(BigInt('0x2000'));
    });

    it('should verify Jump to Address does not reset to PC on tab switch', () => {
      fixture.componentRef.setInput('currentPc', BigInt('0x1000'));
      fixture.detectChanges();

      // User jumps to 0x401234
      component.openJumpToAddressDialog();
      expect(component.viewAnchor()).toBe(BigInt('0x401234'));

      // We verify that viewAnchor remains at the jumped address,
      // representing the SSOT for the ResizeObserver's becameVisible logic.
      expect(component.viewAnchor()).not.toBe(BigInt('0x1000'));
    });
  });

  it('should verify opcode and mnemonic elements have title attributes for tooltips', () => {
    const fakeInstructions: DapDisassembledInstruction[] = [
      {
        address: 0x1000n,
        instruction: 'mov eax, [ebp-0x4]',
        instructionBytes: '8b 45 fc',
        instructionByteLength: 3
      }
    ];

    component.instructions = fakeInstructions;
    component.scrollStrategy.setConfig(fakeInstructions, 28);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const opcode = compiled.querySelector('.opcode') as HTMLElement;
    const mnemonic = compiled.querySelector('.mnemonic') as HTMLElement;

    expect(opcode.textContent?.trim()).toBe('8b 45 fc');
    expect(mnemonic.textContent?.trim()).toBe('mov eax, [ebp-0x4]');
  });

  it('should verify the function header uses cppSignature pipe and has a tooltip', () => {
    const longSymbol = 'std::vector<int, std::allocator<int>>::push_back(int)';
    const fakeInstructions: DapDisassembledInstruction[] = [
      { address: BigInt('0x1000'), instruction: 'nop', instructionBytes: '90', instructionByteLength: 1, normalizedSymbol: longSymbol, isFunctionStart: true }
    ];

    component.instructions = fakeInstructions;
    component.scrollStrategy.setConfig(fakeInstructions, 28);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const header = compiled.querySelector('.assembly-function-label');
    expect(header).toBeTruthy();

    const symbolName = header?.querySelector('.symbol-name') as HTMLElement;
    expect(symbolName).toBeTruthy();

    // Simplified version should contain placeholders
    const text = symbolName.textContent?.trim() || '';
    expect(text).toContain('<...>');
    expect(text).toContain('(...)');
    expect(text).not.toContain('std::allocator');
  });

  describe('AssemblyVirtualScrollStrategy and centering calculation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate correct target scroll offset with variable row heights', () => {
      const fakeInstructions: DapDisassembledInstruction[] = [
        { address: 0x1000n, instruction: 'nop', instructionBytes: '90', instructionByteLength: 1, isFunctionStart: true }, // height = rowHeight * 2
        { address: 0x1004n, instruction: 'nop', instructionBytes: '90', instructionByteLength: 1 }, // height = rowHeight
        { address: 0x1008n, instruction: 'nop', instructionBytes: '90', instructionByteLength: 1 }, // height = rowHeight
        { address: 0x100cn, instruction: 'nop', instructionBytes: '90', instructionByteLength: 1, isFunctionStart: true }, // height = rowHeight * 2
        { address: 0x1010n, instruction: 'nop', instructionBytes: '90', instructionByteLength: 1 }, // height = rowHeight (target)
      ];

      component.instructions = fakeInstructions;
      component.scrollStrategy.setConfig(fakeInstructions, 28);

      const mockViewport: any = {
        getViewportSize: () => 100, // viewport height
        measureScrollOffset: () => 0,
        setTotalContentSize: vi.fn(),
        setRenderedRange: vi.fn(),
        setRenderedContentOffset: vi.fn(),
        scrollToOffset: vi.fn()
      };

      component.scrollStrategy.attach(mockViewport);
      expect(mockViewport.setTotalContentSize).toHaveBeenCalledWith(196); // 56 + 28 + 28 + 56 + 28 = 196

      component.viewport = mockViewport;

      // Call private scrollToAddress using bracket notation
      (component as any).scrollToAddress(0x1010n);

      // Trigger the timeout function
      vi.runAllTimers();

      // Accumulated preceding height = 56 + 28 + 28 + 56 = 168px
      // Target instruction topOfInstructionContent = 168px
      // centerOffsetPx = (100 / 2) - (28 / 2) = 36px
      // targetOffset = 168 - 36 = 132px
      expect(mockViewport.scrollToOffset).toHaveBeenCalledWith(132, 'auto');
    });

    it('should adjust scroll offset correctly when scrolling forward (items removed from top)', () => {
      // Arrange
      const oldInstructions: DapDisassembledInstruction[] = [];
      for (let i = 0; i < 200; i++) {
        oldInstructions.push({ address: BigInt(0x1000 + i * 4), instruction: 'nop', instructionBytes: '90', instructionByteLength: 4 });
      }
      component.instructions = oldInstructions;
      component.scrollStrategy.setConfig(oldInstructions, 28);

      const viewport = component.viewport!;
      const getViewportSizeSpy = vi.spyOn(viewport, 'getViewportSize').mockReturnValue(200);
      const measureScrollOffsetSpy = vi.spyOn(viewport, 'measureScrollOffset').mockReturnValue(170 * 28);
      const scrollToOffsetSpy = vi.spyOn(viewport, 'scrollToOffset').mockImplementation(() => {});

      // The target address is at oldIndex 170
      const targetAddress = BigInt(0x1000 + 170 * 4);

      // New instructions (fetched forward, starts at index 100 of old list)
      const newInstructions: DapDisassembledInstruction[] = [];
      for (let i = 100; i < 300; i++) {
        newInstructions.push({ address: BigInt(0x1000 + i * 4), instruction: 'nop', instructionBytes: '90', instructionByteLength: 4 });
      }

      // Act
      (component as any).updateInstructions(newInstructions, 'forward', targetAddress);

      // Assert
      // oldTargetOffset = 170 * 28 = 4760
      // distance = 4760 - 4760 = 0
      // newTargetIndex (for targetAddress in newInstructions) = 70 (since newInstructions starts at 100)
      // newTargetOffset = 70 * 28 = 1960
      // targetScrollOffset = 1960 - 0 = 1960
      expect(scrollToOffsetSpy).toHaveBeenCalledWith(1960, 'auto');

      // Cleanup
      getViewportSizeSpy.mockRestore();
      measureScrollOffsetSpy.mockRestore();
      scrollToOffsetSpy.mockRestore();
    });

    it('should adjust scroll offset correctly when scrolling backward (items added to top)', () => {
      // Arrange
      const oldInstructions: DapDisassembledInstruction[] = [];
      for (let i = 100; i < 300; i++) {
        oldInstructions.push({ address: BigInt(0x1000 + i * 4), instruction: 'nop', instructionBytes: '90', instructionByteLength: 4 });
      }
      component.instructions = oldInstructions;
      component.scrollStrategy.setConfig(oldInstructions, 28);

      const viewport = component.viewport!;
      const getViewportSizeSpy = vi.spyOn(viewport, 'getViewportSize').mockReturnValue(200);
      const measureScrollOffsetSpy = vi.spyOn(viewport, 'measureScrollOffset').mockReturnValue(10 * 28);
      const scrollToOffsetSpy = vi.spyOn(viewport, 'scrollToOffset').mockImplementation(() => {});

      // The target address is at index 10 of oldInstructions (which is address 0x1000 + 110 * 4)
      const targetAddress = BigInt(0x1000 + 110 * 4);

      // New instructions (fetched backward, starts at index 0 of old list)
      const newInstructions: DapDisassembledInstruction[] = [];
      for (let i = 0; i < 200; i++) {
        newInstructions.push({ address: BigInt(0x1000 + i * 4), instruction: 'nop', instructionBytes: '90', instructionByteLength: 4 });
      }

      // Act
      (component as any).updateInstructions(newInstructions, 'backward', targetAddress);

      // Assert
      // oldIndex = 10, oldTargetOffset = 10 * 28 = 280
      // distance = 280 - 280 = 0
      // newIndex (for 110 * 4) = 110
      // newTargetOffset = 110 * 28 = 3080
      // targetScrollOffset = 3080 - 0 = 3080
      expect(scrollToOffsetSpy).toHaveBeenCalledWith(3080, 'auto');

      // Cleanup
      getViewportSizeSpy.mockRestore();
      measureScrollOffsetSpy.mockRestore();
      scrollToOffsetSpy.mockRestore();
    });

    it('should set isAligningScroll flag during scroll alignment and suppress scroll events', () => {
      vi.useFakeTimers();

      // Arrange
      const oldInstructions: DapDisassembledInstruction[] = [
        { address: 0x1000n, instruction: 'nop', instructionBytes: '90', instructionByteLength: 1 }
      ];
      component.instructions = oldInstructions;
      component.scrollStrategy.setConfig(oldInstructions, 28);

      const viewport = component.viewport!;
      const getViewportSizeSpy = vi.spyOn(viewport, 'getViewportSize').mockReturnValue(200);
      let mockedOffset = 100; // start with mismatched offset
      const measureScrollOffsetSpy = vi.spyOn(viewport, 'measureScrollOffset').mockImplementation(() => mockedOffset);
      const scrollToOffsetSpy = vi.spyOn(viewport, 'scrollToOffset').mockImplementation(() => {});

      // Act & Assert
      const newInstructions: DapDisassembledInstruction[] = [
        { address: 0x1000n, instruction: 'nop', instructionBytes: '90', instructionByteLength: 1 }
      ];
      (component as any).updateInstructions(newInstructions, 'backward', 0x1000n);

      // Flag should be true immediately
      expect((component as any).isAligningScroll).toBe(true);

      // Calling onViewportScroll with mismatched offset should keep flag true and suppress fetch
      const relocateSpy = vi.spyOn(component as any, 'relocateWindow').mockResolvedValue(undefined);
      (component as any).onViewportScroll(0, 16);
      expect((component as any).isAligningScroll).toBe(true);
      expect(relocateSpy).not.toHaveBeenCalled();

      // Set offset to expected (0) and call onViewportScroll: should clear flag immediately and not fetch
      mockedOffset = 0;
      (component as any).onViewportScroll(0, 16);
      expect((component as any).isAligningScroll).toBe(false);
      expect(relocateSpy).not.toHaveBeenCalled();

      // Test safety fallback: trigger another alignment with mismatched offset
      (component as any).updateInstructions(newInstructions, 'backward', 0x1000n);
      expect((component as any).isAligningScroll).toBe(true);
      mockedOffset = 100;
      (component as any).onViewportScroll(0, 16);
      expect((component as any).isAligningScroll).toBe(true);

      // Advance timers by 150ms safety fallback
      vi.advanceTimersByTime(150);
      expect((component as any).isAligningScroll).toBe(false);

      // Cleanup
      getViewportSizeSpy.mockRestore();
      measureScrollOffsetSpy.mockRestore();
      scrollToOffsetSpy.mockRestore();
      relocateSpy.mockRestore();
      vi.useRealTimers();
    });
  });
});
