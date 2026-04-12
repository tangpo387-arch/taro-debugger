import { TestBed } from '@angular/core/testing';
import { DebuggerComponent } from './debugger.component';
import { DapSessionService } from './dap-session.service';
import { DapConfigService } from './dap-config.service';
import { DapVariablesService } from './dap-variables.service';
import { DapLogService } from './dap-log.service';
import { DapAssemblyService } from './dap-assembly.service';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { Router } from '@angular/router';
import { BehaviorSubject, EMPTY, of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectorRef, Injector } from '@angular/core';

/**
 * Unit tests for DebuggerComponent.onStepInstructionTab().
 *
 * Strategy: We avoid rendering the full component template (which requires Monaco,
 * VariablesComponent, and AssemblyViewComponent — all of which have their own
 * complex DI chains). Instead, we manually instantiate DebuggerComponent using
 * the TestBed Injector while overriding all dependencies with mocks.
 */
describe('DebuggerComponent — onStepInstructionTab()', () => {
  let component: DebuggerComponent;
  let mockDapSession: any;

  beforeEach(() => {
    mockDapSession = {
      connectionStatus$: EMPTY,
      executionState$: new BehaviorSubject<string>('stopped').asObservable(),
      onEvent: () => EMPTY,
      onTraffic$: EMPTY,
      startSession: vi.fn().mockResolvedValue({}),
      disconnect: vi.fn(),
      nextInstruction: vi.fn().mockResolvedValue({}),
      stepInInstruction: vi.fn().mockResolvedValue({}),
      fileTree: { readFile: () => of('') }
    };

    const mockVariablesService = {
      executionState$: new BehaviorSubject<string>('stopped').asObservable(),
      scopes$: new BehaviorSubject<any[]>([]).asObservable(),
      fetchScopes: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn()
    };

    const mockLogService = {
      consoleLog: vi.fn(),
      consoleLogs$: new BehaviorSubject<any[]>([]).asObservable(),
      programLogs$: new BehaviorSubject<any[]>([]).asObservable(),
      appendProgramLog: vi.fn()
    };

    const mockAssemblyService = {
      clear: vi.fn(),
      fetchInstructions: vi.fn().mockResolvedValue([]),
      instructions$: new BehaviorSubject<any[]>([]).asObservable()
    };

    const mockConfigService = {
      getConfig: () => ({ executablePath: '/path/to/exe', transportType: 'websocket' })
    };

    const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };

    // Manually create the component by constructing it from the Injector,
    // bypassing the Angular component factory (no template rendering occurs).
    TestBed.configureTestingModule({
      providers: [
        DebuggerComponent,
        { provide: DapSessionService, useValue: mockDapSession },
        { provide: DapVariablesService, useValue: mockVariablesService },
        { provide: DapLogService, useValue: mockLogService },
        { provide: DapAssemblyService, useValue: mockAssemblyService },
        { provide: DapConfigService, useValue: mockConfigService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: { baseUrl: 'assets/monaco' } },
        { provide: ChangeDetectorRef, useValue: mockCdr },
      ]
    });

    component = TestBed.inject(DebuggerComponent);
    component.executionState = 'stopped';
  });

  it('should switch to Disassembly tab and call nextInstruction', async () => {
    component.activeTabIndex = 0;
    component.executionState = 'stopped';

    await component.onStepInstructionTab('nexti');

    expect(component.activeTabIndex).toBe(1);
    expect(mockDapSession.nextInstruction).toHaveBeenCalled();
  });

  it('should switch to Disassembly tab and call stepInInstruction', async () => {
    component.activeTabIndex = 0;
    component.executionState = 'stopped';

    await component.onStepInstructionTab('stepi');

    expect(component.activeTabIndex).toBe(1);
    expect(mockDapSession.stepInInstruction).toHaveBeenCalled();
  });

  it('should not switch tab or call DAP when state is not stopped', async () => {
    component.activeTabIndex = 0;
    component.executionState = 'running';

    await component.onStepInstructionTab('nexti');

    expect(component.activeTabIndex).toBe(0);
    expect(mockDapSession.nextInstruction).not.toHaveBeenCalled();
  });
});
