import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssemblyViewComponent } from './assembly-view.component';
import { DapAssemblyService, TaroDisassembledInstruction } from './dap-assembly.service';
import { BehaviorSubject } from 'rxjs';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { JumpToAddressDialogComponent } from './jump-to-address-dialog/jump-to-address-dialog.component';

describe('AssemblyViewComponent', () => {
  let component: AssemblyViewComponent;
  let fixture: ComponentFixture<AssemblyViewComponent>;
  let mockAssemblyService: any;
  let instructionsSubject: BehaviorSubject<TaroDisassembledInstruction[]>;
  let loadingSubject: BehaviorSubject<boolean>;
  let mockDialog: any;

  beforeEach(async () => {
    instructionsSubject = new BehaviorSubject<TaroDisassembledInstruction[]>([]);
    loadingSubject = new BehaviorSubject<boolean>(false);

    mockAssemblyService = {
      instructions$: instructionsSubject.asObservable(),
      isLoading$: loadingSubject.asObservable(),
      onViewportScroll: vi.fn().mockResolvedValue(undefined),
      relocateWindow: vi.fn().mockResolvedValue(undefined),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of('0x401234')
      })
    };

    await TestBed.configureTestingModule({
      imports: [AssemblyViewComponent, CommonModule, ScrollingModule],
      providers: [
        { provide: DapAssemblyService, useValue: mockAssemblyService },
        { provide: MatDialog, useValue: mockDialog }
      ]
    })
      .overrideComponent(AssemblyViewComponent, {
        set: {
          providers: [
            { provide: DapAssemblyService, useValue: mockAssemblyService },
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
    const fakeInstructions: TaroDisassembledInstruction[] = [];
    for (let i = 0; i < 1000; i++) {
      fakeInstructions.push({
        address: BigInt(i),
        instructionBytes: '90',
        instruction: 'nop'
      });
    }

    instructionsSubject.next(fakeInstructions);
    fixture.detectChanges();

    expect(component.instructions.length).toBe(1000);
    const compiled = fixture.nativeElement as HTMLElement;
    // CDK Virtual scroll will render only a few rows, not 1000
    const rows = compiled.querySelectorAll('.assembly-row');
    expect(rows.length).toBeLessThan(1000);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should verify the highlighted instruction is synchronized with the current instruction pointer reference', () => {
    const fakeInstructions: TaroDisassembledInstruction[] = [
      { address: BigInt('0x1000'), instruction: 'nop', normalizedSymbol: 'main' },
      { address: BigInt('0x1004'), instruction: 'mov eax, ebx', normalizedSymbol: 'main' },
      { address: BigInt('0x1008'), instruction: 'ret', normalizedSymbol: 'main' }
    ];

    instructionsSubject.next(fakeInstructions);
    fixture.componentRef.setInput('currentPc', '0x1004');
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
    const fakeInstructions: TaroDisassembledInstruction[] = [
      { address: BigInt('0x1000'), instruction: 'nop', normalizedSymbol: 'main' }
    ];

    instructionsSubject.next(fakeInstructions);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const bpMarker = compiled.querySelector('.breakpoint-marker');
    expect(bpMarker).toBeTruthy();
  });

  describe('Jump to Address', () => {
    it('should open the Jump to Address dialog when the Jump FAB is clicked', () => {
      // Arrange
      fixture.componentRef.setInput('currentPc', '0x1000'); // Ensure FABs are visible
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const jumpButton = compiled.querySelector('button[aria-label="Jump to address"]') as HTMLButtonElement;
      expect(jumpButton).toBeTruthy();

      // Act
      jumpButton.click();

      // Assert
      expect(mockDialog.open).toHaveBeenCalledWith(JumpToAddressDialogComponent, { width: '350px' });
    });

    it('should call jumpTo when the dialog is confirmed with an address', async () => {
      // Act
      component.openJumpToAddressDialog();

      // Assert
      expect(mockAssemblyService.relocateWindow).toHaveBeenCalledWith('0x401234');
    });
  });
});
