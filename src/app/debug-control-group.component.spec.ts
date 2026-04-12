import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DebugControlGroupComponent } from './debug-control-group.component';
import { DapSessionService } from './dap-session.service';
import { BehaviorSubject, of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { By } from '@angular/platform-browser';

describe('DebugControlGroupComponent', () => {
  let component: DebugControlGroupComponent;
  let fixture: ComponentFixture<DebugControlGroupComponent>;
  let mockDapSession: any;
  let executionState$: BehaviorSubject<string>;

  beforeEach(async () => {
    executionState$ = new BehaviorSubject<string>('idle');
    mockDapSession = {
      executionState$: executionState$.asObservable(),
      continue: vi.fn().mockResolvedValue({}),
      pause: vi.fn().mockResolvedValue({}),
      next: vi.fn().mockResolvedValue({}),
      stepIn: vi.fn().mockResolvedValue({}),
      stepOut: vi.fn().mockResolvedValue({})
    };

    await TestBed.configureTestingModule({
      imports: [DebugControlGroupComponent, MatButtonModule, MatIconModule],
      providers: [
        { provide: DapSessionService, useValue: mockDapSession }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DebugControlGroupComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should disable stepi/nexti buttons when not stopped', () => {
    executionState$.next('running');
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button.instruction-step'));
    expect(buttons.length).toBe(2);
    expect(buttons[0].nativeElement.disabled).toBe(true);
    expect(buttons[1].nativeElement.disabled).toBe(true);

    executionState$.next('stopped');
    fixture.detectChanges();
    expect(buttons[0].nativeElement.disabled).toBe(false);
    expect(buttons[1].nativeElement.disabled).toBe(false);
  });

  it('should emit stepInstructionTab when stepi/nexti buttons are clicked', () => {
    executionState$.next('stopped');
    fixture.detectChanges();

    const spy = vi.spyOn(component.stepInstructionTab, 'emit');
    
    const buttons = fixture.debugElement.queryAll(By.css('button.instruction-step'));
    
    // First button should be nexti
    buttons[0].nativeElement.click();
    expect(spy).toHaveBeenCalledWith('nexti');

    // Second button should be stepi
    buttons[1].nativeElement.click();
    expect(spy).toHaveBeenCalledWith('stepi');
  });

  it('should apply high-weight class when activeTabIndex is 1', () => {
    component.activeTabIndex = 1;
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button.instruction-step'));
    expect(buttons[0].nativeElement.classList.contains('high-weight')).toBe(true);
    expect(buttons[1].nativeElement.classList.contains('high-weight')).toBe(true);
  });

  it('should apply low-weight class when activeTabIndex is 0', () => {
    // Note: Default is 0, so we just check it
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button.instruction-step'));
    expect(buttons[0].nativeElement.classList.contains('low-weight')).toBe(true);
    expect(buttons[1].nativeElement.classList.contains('low-weight')).toBe(true);
  });
});
