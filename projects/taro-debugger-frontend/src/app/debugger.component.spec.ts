import { TestBed } from '@angular/core/testing';
import { DebuggerComponent } from './debugger.component';
import { DapSessionService } from '@taro/dap-core';
import { DapConfigService } from '@taro/dap-core';
import { DapVariablesService } from '@taro/ui-inspection';
import { DapLogService } from '@taro/ui-console';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectorRef, Injector, DestroyRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { KeyboardShortcutService, ActionID } from './keyboard-shortcut.service';
import { DapFileTreeService } from './dap-file-tree.service';
import { DapMemoryService } from '@taro/dap-core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject, BehaviorSubject, EMPTY, of } from 'rxjs';

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
      stop: vi.fn().mockResolvedValue(undefined),
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

    const mockConfigService = {
      getConfig: () => ({ executablePath: '/path/to/exe', transportType: 'websocket', stopOnEntry: true })
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
        { provide: DapConfigService, useValue: mockConfigService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: { baseUrl: 'assets/monaco' } },
        { provide: ChangeDetectorRef, useValue: mockCdr },
        { provide: DapFileTreeService, useValue: { readFile: () => of(''), getTree: () => EMPTY, destroy: vi.fn() } },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        { provide: DapMemoryService, useValue: { read: vi.fn(), write: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(DebuggerComponent, {
      set: { providers: [] }
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

/**
 * Unit tests for DebuggerComponent keyboard shortcut integration.
 */
describe('DebuggerComponent — Keyboard Shortcut Integration', () => {
  let component: DebuggerComponent;
  let mockShortcutService: { onAction$: Subject<ActionID> };
  let mockDapSession: any;

  beforeEach(() => {
    mockShortcutService = {
      onAction$: new Subject<ActionID>()
    };

    mockDapSession = {
      connectionStatus$: EMPTY,
      executionState$: new BehaviorSubject<string>('stopped').asObservable(),
      onEvent: () => EMPTY,
      onTraffic$: EMPTY,
      startSession: vi.fn().mockResolvedValue({}),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      continue: vi.fn(),
      next: vi.fn()
    };

    const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };
    const mockLogService = { consoleLog: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        DebuggerComponent,
        { provide: KeyboardShortcutService, useValue: mockShortcutService },
        { provide: DapSessionService, useValue: mockDapSession },
        { provide: DapLogService, useValue: mockLogService },
        { provide: ChangeDetectorRef, useValue: mockCdr },
        { provide: DapVariablesService, useValue: { executionState$: EMPTY, scopes$: EMPTY, clear: vi.fn(), fetchScopes: vi.fn() } },
        { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: 'exe', stopOnEntry: true }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ChangeDetectorRef, useValue: mockCdr },
        { provide: DapVariablesService, useValue: { executionState$: EMPTY, scopes$: EMPTY, clear: vi.fn(), fetchScopes: vi.fn() } },
        { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: 'exe', stopOnEntry: true }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: DapFileTreeService, useValue: { readFile: () => of(''), getTree: () => EMPTY, destroy: vi.fn() } },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        { provide: DapMemoryService, useValue: { read: vi.fn(), write: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(DebuggerComponent, {
      set: { providers: [] }
    });

    component = TestBed.inject(DebuggerComponent);
    // Mimic ngOnInit to trigger initShortcuts()
    (component as any).initShortcuts();
  });

  it('should call onResume when DEBUG_CONTINUE action is received', () => {
    // Arrange
    const spy = vi.spyOn(component, 'onResume');

    // Act
    mockShortcutService.onAction$.next(ActionID.DEBUG_CONTINUE);

    // Assert
    expect(spy).toHaveBeenCalled();
  });

  it('should call onStepOver when DEBUG_STEP_OVER action is received', () => {
    // Arrange
    const spy = vi.spyOn(component, 'onStepOver');

    // Act
    mockShortcutService.onAction$.next(ActionID.DEBUG_STEP_OVER);

    // Assert
    expect(spy).toHaveBeenCalled();
  });

  it('should call onRestart when DEBUG_RESTART action is received', () => {
    // Arrange
    const spy = vi.spyOn(component, 'onRestart');

    // Act
    mockShortcutService.onAction$.next(ActionID.DEBUG_RESTART);

    // Assert
    expect(spy).toHaveBeenCalled();
  });

  it('should trigger editor breakpoint toggle when EDITOR_TOGGLE_BREAKPOINT action is received', () => {
    // Arrange
    const mockEditor = { toggleBreakpointAtCurrentPosition: vi.fn() };
    (component as any).editorComponent = mockEditor;

    // Act
    mockShortcutService.onAction$.next(ActionID.EDITOR_TOGGLE_BREAKPOINT);

    // Assert
    expect(mockEditor.toggleBreakpointAtCurrentPosition).toHaveBeenCalled();
  });
});

/**
 * Unit tests for DebuggerComponent reveal logic (WI-49 bug fix).
 */
describe('DebuggerComponent — Reveal Logic', () => {
  let component: DebuggerComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DebuggerComponent,
        {
          provide: DapSessionService,
          useValue: {
            connectionStatus$: EMPTY,
            executionState$: EMPTY,
            processInfo$: EMPTY,
            threads$: EMPTY,
            activeThread$: EMPTY,
            onEvent: () => EMPTY,
            onTraffic$: EMPTY,
            stop: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn(),
            fileTree: { readFile: () => of('') }
          }
        },
        {
          provide: DapVariablesService,
          useValue: {
            executionState$: EMPTY,
            scopes$: EMPTY,
            clear: vi.fn(),
            fetchScopes: vi.fn().mockResolvedValue(undefined)
          }
        },
        { provide: DapLogService, useValue: { consoleLog: vi.fn() } },
        { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: 'exe', stopOnEntry: true }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn(), markForCheck: vi.fn() } },
        { provide: DapFileTreeService, useValue: { readFile: () => of(''), getTree: () => EMPTY, destroy: vi.fn() } },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        { provide: DapMemoryService, useValue: { read: vi.fn(), write: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(DebuggerComponent, {
      set: { providers: [] }
    });
    component = TestBed.inject(DebuggerComponent);
  });

  it('should increment fileRevealTrigger only on onFrameClick and not on onFileSelected', async () => {
    // Arrange
    const initialTrigger = component.fileRevealTrigger;

    // Act - File Selection (Passive/Manual Tree Navigation)
    await component.onFileSelected({ path: 'test.cpp', type: 'file', name: 'test.cpp' });
    const triggerAfterFileSelect = component.fileRevealTrigger;

    // Act - Frame Click (Active Reveal)
    await component.onFrameClick({ id: 1, name: 'main', line: 10, column: 1, source: { path: 'test.cpp' } } as any);
    const triggerAfterFrameClick = component.fileRevealTrigger;

    // Assert
    expect(triggerAfterFileSelect).toBe(initialTrigger);
    expect(triggerAfterFrameClick).toBe(initialTrigger + 1);
  });
});

/**
 * Unit tests for DebuggerComponent — State Cleanup (R_SM5 / WI-83)
 */
describe('DebuggerComponent — State Cleanup (WI-83)', () => {
  let component: DebuggerComponent;
  let executionStateSubject: BehaviorSubject<string>;

  beforeEach(() => {
    executionStateSubject = new BehaviorSubject<string>('stopped');

    const mockDapSession = {
      connectionStatus$: EMPTY,
      executionState$: executionStateSubject.asObservable(),
      onEvent: () => EMPTY,
      onTraffic$: EMPTY,
      breakpoints$: EMPTY,
      startSession: vi.fn().mockResolvedValue({}),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      activeThread$: EMPTY,
    };

    TestBed.configureTestingModule({
      providers: [
        DebuggerComponent,
        { provide: DapSessionService, useValue: mockDapSession },
        { provide: DapVariablesService, useValue: { executionState$: EMPTY, scopes$: EMPTY, clear: vi.fn(), fetchScopes: vi.fn() } },
        { provide: DapLogService, useValue: { consoleLog: vi.fn() } },
        { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: 'exe', stopOnEntry: true }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn(), markForCheck: vi.fn() } },
        { provide: DapFileTreeService, useValue: { readFile: () => of(''), getTree: () => EMPTY, destroy: vi.fn() } },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        { provide: DapMemoryService, useValue: { read: vi.fn(), write: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(DebuggerComponent, {
      set: { providers: [] }
    });
    component = TestBed.inject(DebuggerComponent);

    // Trigger ngOnInit to subscribe to executionState$
    component.ngOnInit();
  });

  it('should clear activeFrameId when executionState transitions to running', () => {
    // Arrange
    component.activeFrameId = 1;
    expect(component.activeFrameId).toBe(1);

    // Act
    executionStateSubject.next('running');

    // Assert
    expect(component.activeFrameId).toBeNull();
  });

  it('should clear activeFrameId when executionState transitions to error', () => {
    // Arrange
    component.activeFrameId = 1;
    expect(component.activeFrameId).toBe(1);

    // Act
    executionStateSubject.next('error');

    // Assert
    expect(component.activeFrameId).toBeNull();
  });

  it('should clear activeFrameId and editor state when executionState transitions to idle', () => {
    // Arrange
    component.activeFrameId = 1;
    component.activeFilePath = '/path/to/source.cpp';
    component.currentCode = 'void main() {}';
    expect(component.activeFrameId).toBe(1);
    expect(component.activeFilePath).toBe('/path/to/source.cpp');

    // Act
    executionStateSubject.next('idle');

    // Assert
    expect(component.activeFrameId).toBeNull();
    expect(component.activeFilePath).toBeNull();
    expect(component.currentCode).toBe('');
  });

  it('should discard auto-selected frame if executionState is no longer stopped after stackTrace returns (Race Guard)', async () => {
    // Arrange
    const spy = vi.spyOn(component, 'onFrameClick');
    const mockThread = {
      stackTrace: vi.fn().mockImplementation(async () => {
        component.executionState = 'running';
        return [{ id: 1, name: 'stale' } as any];
      })
    };
    (component as any).dapSession.getOrCreateThreadObject = vi.fn().mockReturnValue(mockThread);
    component.executionState = 'stopped';

    // Act
    await (component as any).autoSelectTopFrame(1);

    // Assert
    expect(spy).not.toHaveBeenCalled();
  });
});

/**
 * Unit tests for No-Source Frame UX (WI-100)
 */
describe('DebuggerComponent — No-Source Frame UX (WI-100)', () => {
  let component: DebuggerComponent;
  let mockDapSession: any;

  beforeEach(() => {
    mockDapSession = {
      connectionStatus$: EMPTY,
      executionState$: EMPTY,
      onEvent: () => EMPTY,
      onTraffic$: EMPTY,
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DebuggerComponent,
        { provide: DapSessionService, useValue: mockDapSession },
        { provide: DapVariablesService, useValue: { executionState$: EMPTY, scopes$: EMPTY, clear: vi.fn(), fetchScopes: vi.fn().mockResolvedValue(undefined) } },
        { provide: DapLogService, useValue: { consoleLog: vi.fn() } },
        { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: 'exe', stopOnEntry: true }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn(), markForCheck: vi.fn() } },
        { provide: DapFileTreeService, useValue: { readFile: () => of(''), getTree: () => EMPTY, destroy: vi.fn() } },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        { provide: DapMemoryService, useValue: { read: vi.fn(), write: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(DebuggerComponent, {
      set: { providers: [] }
    });
    component = TestBed.inject(DebuggerComponent);
  });

  it('should not switch to Disassembly tab when clicking a frame without source if on Source tab', async () => {
    // Arrange
    component.activeTabIndex = 0; // Source tab
    const frame = { id: 0, name: 'func', instructionPointerReference: '0x1234' } as any;

    // Act
    await component.onFrameClick(frame);

    // Assert
    expect(component.activeTabIndex).toBe(0);
    expect(component.activeFilePath).toBeNull();
  });

  it('should stay on Disassembly tab if already there even if frame has no source', async () => {
    // Arrange
    component.activeTabIndex = 1; // Disassembly tab
    const frame = { id: 1, name: 'func', instructionPointerReference: '0x1234' } as any;

    // Act
    await component.onFrameClick(frame);

    // Assert
    expect(component.activeTabIndex).toBe(1);
  });

  it('should manually switch to Disassembly tab when onSwitchToDisassembly is called', () => {
    // Arrange
    component.activeTabIndex = 0;

    // Act
    component.onSwitchToDisassembly();

    // Assert
    expect(component.activeTabIndex).toBe(1);
  });
});

/**
 * Unit tests for Memory View Integration (WI-106)
 */
describe('DebuggerComponent — Memory View Integration (WI-106)', () => {
  let component: DebuggerComponent;
  let mockMemoryService: any;

  beforeEach(() => {
    mockMemoryService = {
      read: vi.fn().mockResolvedValue(new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])),
      onMemoryUpdated$: EMPTY
    };

    TestBed.configureTestingModule({
      providers: [
        DebuggerComponent,
        { provide: DapMemoryService, useValue: mockMemoryService },
        { provide: DapSessionService, useValue: { connectionStatus$: EMPTY, executionState$: EMPTY, processInfo$: EMPTY, threads$: EMPTY, activeThread$: EMPTY, onEvent: () => EMPTY, onTraffic$: EMPTY, stop: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn() } },
        { provide: DapVariablesService, useValue: { executionState$: EMPTY, scopes$: EMPTY, clear: vi.fn(), fetchScopes: vi.fn() } },
        { provide: DapLogService, useValue: { consoleLog: vi.fn() } },
        { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: 'exe', stopOnEntry: true }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn(), markForCheck: vi.fn() } },
        { provide: DapFileTreeService, useValue: { readFile: () => of(''), getTree: () => EMPTY, destroy: vi.fn() } },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(DebuggerComponent, {
      set: { providers: [] }
    });
    component = TestBed.inject(DebuggerComponent);
  });

  it('should switch to Memory tab and load data when onInspectMemory is called', async () => {
    // Arrange
    const address = 0x7fffffff0000n;
    component.activeTabIndex = 0;

    // Act
    await component.onInspectMemory(address);

    // Assert
    expect(component.activeTabIndex).toBe(2);
    expect(component.activeMemoryAddress).toBe(address);
    expect(mockMemoryService.read).toHaveBeenCalledWith(address, 0, 1024);
    expect(component.activeMemoryData[0]).toBe(0xDE);
  });

  it('should clear memory state when execution transitions out of stopped', () => {
    // Arrange
    component.activeMemoryAddress = 0x1234n;
    component.activeMemoryData = new Uint8Array([0xAA]);

    // Simulating the state change subscription behavior
    const stateSubject = new BehaviorSubject<string>('stopped');
    (component as any).dapSession.executionState$ = stateSubject.asObservable();
    component.ngOnInit(); // Re-initialize to subscribe

    // Act
    stateSubject.next('idle');

    // Assert
    expect(component.activeMemoryAddress).toBeNull();
    expect(component.activeMemoryData.length).toBe(0);
  });
});

/**
 * Unit tests for DebuggerComponent — startSession Error Dialog Handling
 */
describe('DebuggerComponent — startSession Error Dialog Handling', () => {
  let component: DebuggerComponent;
  let mockDapSession: any;
  let mockDialog: any;

  beforeEach(() => {
    mockDapSession = {
      connectionStatus$: EMPTY,
      executionState$: EMPTY,
      onEvent: () => EMPTY,
      onTraffic$: EMPTY,
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      startSession: vi.fn(),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of('goback')
      })
    };

    TestBed.configureTestingModule({
      providers: [
        DebuggerComponent,
        { provide: DapSessionService, useValue: mockDapSession },
        { provide: DapVariablesService, useValue: { executionState$: EMPTY, scopes$: EMPTY, clear: vi.fn(), fetchScopes: vi.fn() } },
        { provide: DapLogService, useValue: { consoleLog: vi.fn() } },
        { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: 'exe', stopOnEntry: true }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn(), markForCheck: vi.fn() } },
        { provide: DapFileTreeService, useValue: { readFile: () => of(''), getTree: () => EMPTY, destroy: vi.fn() } },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        { provide: DapMemoryService, useValue: { read: vi.fn(), write: vi.fn() } },
        { provide: MatDialog, useValue: mockDialog },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(DebuggerComponent, {
      set: { providers: [] }
    });
    component = TestBed.inject(DebuggerComponent);
  });

  it('should present digestible title, clean message and hide retry on Session setup failed error', async () => {
    const errorMsg = "Cannot create new session: path '/tmp/test-113.tarodb' already exists.";
    mockDapSession.startSession.mockRejectedValue(new Error(errorMsg));

    await (component as any).startSession();

    expect(mockDialog.open).toHaveBeenCalledWith(expect.any(Function), {
      width: '400px',
      disableClose: true,
      data: {
        title: 'Session Setup Failed',
        message: "Cannot create new session: path '/tmp/test-113.tarodb' already exists.",
        hideRetry: true
      }
    });
  });

  it('should present digestible title, raw message and hide retry on other errors', async () => {
    const errorMsg = "Connection to localhost:4005 timed out";
    mockDapSession.startSession.mockRejectedValue(new Error(errorMsg));

    await (component as any).startSession();

    expect(mockDialog.open).toHaveBeenCalledWith(expect.any(Function), {
      width: '400px',
      disableClose: true,
      data: {
        title: 'Session Setup Failed',
        message: "Connection to localhost:4005 timed out",
        hideRetry: true
      }
    });
  });
});

