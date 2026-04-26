import { TestBed } from '@angular/core/testing';
import { DebuggerComponent } from './debugger.component';
import { DapSessionService } from '@taro/dap-core';
import { DapConfigService } from '@taro/dap-core';
import { DapVariablesService } from '@taro/ui-inspection';
import { DapLogService } from '@taro/ui-console';
import { DapAssemblyService } from '@taro/ui-assembly';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { Router } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { DapFileTreeService } from './dap-file-tree.service';
import { BehaviorSubject, EMPTY, of } from 'rxjs';

/**
 * Unit tests for WI-83: Fix Call Stack persistence during execution.
 */
describe('DebuggerComponent — WI-83 Fix', () => {
  let component: DebuggerComponent;
  let executionStateSubject: BehaviorSubject<string>;
  let mockDapSession: any;

  beforeEach(() => {
    executionStateSubject = new BehaviorSubject<string>('stopped');

    mockDapSession = {
      connectionStatus$: EMPTY,
      executionState$: executionStateSubject.asObservable(),
      onEvent: () => EMPTY,
      onTraffic$: EMPTY,
      startSession: vi.fn().mockResolvedValue({}),
      disconnect: vi.fn(),
      breakpoints$: new BehaviorSubject<Map<string, any>>(new Map()).asObservable(),
    };

    const mockVariablesService = {
      executionState$: executionStateSubject.asObservable(),
      scopes$: new BehaviorSubject<any[]>([]).asObservable(),
      fetchScopes: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn()
    };

    const mockLogService = {
      consoleLog: vi.fn(),
      consoleLogs$: EMPTY,
      programLogs$: EMPTY,
      appendProgramLog: vi.fn(),
      appendDapLog: vi.fn(),
    };

    const mockAssemblyService = {
      clear: vi.fn(),
      fetchInstructions: vi.fn().mockResolvedValue([]),
      instructions$: EMPTY
    };

    const mockConfigService = {
      getConfig: () => ({ executablePath: '/path/to/exe', transportType: 'websocket' })
    };

    const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };

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
        { provide: DapFileTreeService, useValue: { readFile: () => of(''), getTree: () => EMPTY, destroy: vi.fn() } },
      ]
    });

    component = TestBed.inject(DebuggerComponent);
    
    // Manually trigger ngOnInit to set up subscriptions
    component.ngOnInit();
  });

  it('should clear stackFrames when executionState transitions to running', () => {
    // Arrange
    component.stackFrames = [{ id: 1, name: 'main', line: 10 } as any];
    component.activeFrameId = 1;
    expect(component.stackFrames.length).toBe(1);

    // Act
    executionStateSubject.next('running');

    // Assert
    expect(component.stackFrames.length).toBe(0);
    expect(component.activeFrameId).toBeNull();
  });

  it('should clear stackFrames when executionState transitions to error', () => {
    // Arrange
    component.stackFrames = [{ id: 1, name: 'main', line: 10 } as any];
    component.activeFrameId = 1;

    // Act
    executionStateSubject.next('error');

    // Assert
    expect(component.stackFrames.length).toBe(0);
    expect(component.activeFrameId).toBeNull();
  });

  it('should NOT clear stackFrames when executionState transitions to stopped', () => {
    // Arrange
    component.stackFrames = [{ id: 1, name: 'main', line: 10 } as any];
    component.activeFrameId = 1;

    // Act
    executionStateSubject.next('stopped');

    // Assert
    expect(component.stackFrames.length).toBe(1);
    expect(component.activeFrameId).toBe(1);
  });
});
