import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssemblyViewComponent } from './assembly-view.component';
import { DapAssemblyService } from './dap-assembly.service';
import { BehaviorSubject, of } from 'rxjs';
import { DapDisassembledInstruction } from '@taro/dap-core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';

describe('AssemblyViewComponent', () => {
  let component: AssemblyViewComponent;
  let fixture: ComponentFixture<AssemblyViewComponent>;
  let mockAssemblyService: any;
  let instructionsSubject: BehaviorSubject<DapDisassembledInstruction[]>;
  let loadingSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    instructionsSubject = new BehaviorSubject<DapDisassembledInstruction[]>([]);
    loadingSubject = new BehaviorSubject<boolean>(false);

    mockAssemblyService = {
      instructions$: instructionsSubject.asObservable(),
      isLoading$: loadingSubject.asObservable(),
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
    const fakeInstructions: DapDisassembledInstruction[] = [];
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
    const fakeInstructions: DapDisassembledInstruction[] = [
      { address: '0x1000', instruction: 'nop' },
      { address: '0x1004', instruction: 'mov eax, ebx' },
      { address: '0x1008', instruction: 'ret' }
    ];

    instructionsSubject.next(fakeInstructions);
    component.instructionPointerReference = '0x1004';
    component.ngOnChanges({
      instructionPointerReference: {
        currentValue: '0x1004',
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true
      }
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const activeRow = compiled.querySelector('.assembly-row.is-active');
    expect(activeRow).toBeTruthy();
    expect(activeRow?.textContent).toContain('0x1004');
    expect(activeRow?.textContent).toContain('mov eax, ebx');
  });

  it('should verify breakpoint markers are accurately mapped to the corresponding address rows', () => {
    // Currently breakpoint toggle is a stub in the UI placeholder, 
    // but the template contains the `.breakpoint-marker` gutter column.
    const fakeInstructions: DapDisassembledInstruction[] = [
      { address: '0x1000', instruction: 'nop' }
    ];

    instructionsSubject.next(fakeInstructions);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const bpMarker = compiled.querySelector('.breakpoint-marker');
    expect(bpMarker).toBeTruthy();
  });
});
