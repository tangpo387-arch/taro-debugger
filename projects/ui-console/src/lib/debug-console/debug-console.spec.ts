import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugConsoleComponent } from './debug-console';
import { DapSessionService } from '@taro/dap-core';
import { DapLogService } from '../dap-log.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('DebugConsoleComponent', () => {
  let component: DebugConsoleComponent;
  let fixture: ComponentFixture<DebugConsoleComponent>;

  beforeEach(async () => {
    const mockDapSession = {
      executionState$: of('stopped'),
      onTraffic$: EMPTY,
      capabilities: { supportsCancelRequest: true },
      evaluate: vi.fn()
    };
    const mockLogService = {
      consoleLogs$: of([]),
      consoleLog: () => {}
    };
    const mockSnackBar = { open: () => {} };

    await TestBed.configureTestingModule({
      imports: [DebugConsoleComponent],
      providers: [
        { provide: DapSessionService, useValue: mockDapSession },
        { provide: DapLogService, useValue: mockLogService },
        { provide: MatSnackBar, useValue: mockSnackBar }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DebugConsoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should prevent sending evaluate command before previous evaluate command completed', async () => {
    const dapSession = TestBed.inject(DapSessionService);
    let resolveEvaluate: any;
    const evaluatePromise = new Promise((resolve) => {
      resolveEvaluate = resolve;
    });
    
    // Mock the evaluate method to return a promise that we control.
    (dapSession.evaluate as any).mockReturnValue(evaluatePromise);

    component.evaluateExpression = 'test_expr';
    
    // First call should go through and set inFlight to true.
    const firstCallPromise = component.evaluateCommand();
    
    // At this point, evaluateInFlight$ should be true.
    expect(component.evaluateInFlight$.value).toBe(true);
    
    // Second call should be prevented because the first one hasn't completed.
    await component.evaluateCommand();
    
    expect(dapSession.evaluate).toHaveBeenCalledTimes(1);

    // Resolve the first call to clean up.
    resolveEvaluate({ seq: 0, type: 'response', request_seq: 0, success: true, command: 'evaluate' });
    await firstCallPromise;

    // evaluateInFlight$ should now be false.
    expect(component.evaluateInFlight$.value).toBe(false);
  });
});
