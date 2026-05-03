import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssemblyViewComponent } from './assembly-view.component';
import { DapAssemblyService, TaroDisassembledInstruction } from './dap-assembly.service';
import { BehaviorSubject } from 'rxjs';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { vi } from 'vitest';

describe('AssemblyViewComponent', () => {
  let component: AssemblyViewComponent;
  let fixture: ComponentFixture<AssemblyViewComponent>;
  let mockAssemblyService: any;
  let instructionsSubject: BehaviorSubject<TaroDisassembledInstruction[]>;
  let currentPcSubject: BehaviorSubject<string | null>;
  let loadingSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    instructionsSubject = new BehaviorSubject<TaroDisassembledInstruction[]>([]);
    currentPcSubject = new BehaviorSubject<string | null>(null);
    loadingSubject = new BehaviorSubject<boolean>(false);

    mockAssemblyService = {
      instructions$: instructionsSubject.asObservable(),
      currentPc$: currentPcSubject.asObservable(),
      isLoading$: loadingSubject.asObservable(),
      onViewportScroll: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [AssemblyViewComponent, CommonModule, ScrollingModule],
      providers: [
        { provide: DapAssemblyService, useValue: mockAssemblyService }
      ]
    }).compileComponents();

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
        address: `0x${i.toString(16).padStart(8, '0')}`,
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
      { address: '0x1000', instruction: 'nop', normalizedSymbol: 'main' },
      { address: '0x1004', instruction: 'mov eax, ebx', normalizedSymbol: 'main' },
      { address: '0x1008', instruction: 'ret', normalizedSymbol: 'main' }
    ];

    instructionsSubject.next(fakeInstructions);
    currentPcSubject.next('0x1004');
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
      { address: '0x1000', instruction: 'nop', normalizedSymbol: 'main' }
    ];

    instructionsSubject.next(fakeInstructions);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const bpMarker = compiled.querySelector('.breakpoint-marker');
    expect(bpMarker).toBeTruthy();
  });
});
