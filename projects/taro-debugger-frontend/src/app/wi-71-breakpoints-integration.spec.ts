import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DebuggerComponent } from './debugger.component';
import { DapSessionService, VerifiedBreakpoint } from '@taro/dap-core';
import { BehaviorSubject, of, EMPTY, Subject } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectorRef, Injector, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { DapConfigService } from '@taro/dap-core';
import { DapVariablesService } from '@taro/ui-inspection';
import { DapLogService } from '@taro/ui-console';
import { DapAssemblyService } from '@taro/ui-assembly';
import { KeyboardShortcutService } from './keyboard-shortcut.service';
import { DapFileTreeService } from './dap-file-tree.service';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';

/**
 * Integration-style unit tests for WI-71 (Global Breakpoint Synchronization).
 * Focuses on the reactive flow between DapSessionService, DebuggerComponent, and EditorComponent.
 */
describe('WI-71: Breakpoint Synchronization Integration', () => {
  let component: DebuggerComponent;
  let mockDapSession: any;
  let mockEditor: any;
  let breakpointsSubject: BehaviorSubject<Map<string, VerifiedBreakpoint[]>>;

  beforeEach(() => {
    breakpointsSubject = new BehaviorSubject<Map<string, VerifiedBreakpoint[]>>(new Map());

    mockDapSession = {
      connectionStatus$: of(true),
      executionState$: new BehaviorSubject<string>('stopped').asObservable(),
      breakpoints$: breakpointsSubject.asObservable(),
      onEvent: () => EMPTY,
      onTraffic$: EMPTY,
      startSession: vi.fn().mockResolvedValue({}),
      disconnect: vi.fn(),
      setBreakpoints: vi.fn().mockResolvedValue([]),
    };

    mockEditor = {
      getBreakpoints: vi.fn().mockReturnValue(new Map()),
      getVerifiedLines: vi.fn().mockReturnValue([]),
      setVerifiedBreakpoints: vi.fn(),
      toggleBreakpoint: vi.fn()
    };

    const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };
    const mockLogService = { consoleLog: vi.fn(), appendDapLog: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        DebuggerComponent,
        { provide: DapSessionService, useValue: mockDapSession },
        { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: '/path/to/exe' }) } },
        { provide: DapVariablesService, useValue: { fetchScopes: vi.fn().mockResolvedValue(undefined) } },
        { provide: DapLogService, useValue: mockLogService },
        { provide: DapAssemblyService, useValue: { clear: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: ChangeDetectorRef, useValue: mockCdr },
        { provide: KeyboardShortcutService, useValue: { onAction$: new Subject() } },
        { provide: DapFileTreeService, useValue: { readFile: () => of('line 1\nline 2'), getTree: () => EMPTY, destroy: vi.fn() } },
      ]
    });

    component = TestBed.inject(DebuggerComponent);
    // Inject mockEditor where DebuggerComponent expects @ViewChild
    (component as any).editorComponent = mockEditor;
  });

  describe('Verified State Propagation (SSOT -> Editor)', () => {
    it('should update editor decorations when session breakpoint state changes', async () => {
      // Arrange
      const filePath = '/src/main.c';
      const verifiedBps: VerifiedBreakpoint[] = [{ line: 10, verified: true, enabled: true }];
      const bpsMap = new Map<string, VerifiedBreakpoint[]>();
      bpsMap.set(filePath, verifiedBps);

      // Act
      // Simulate ngOnInit to trigger the subscription
      (component as any).ngOnInit();
      breakpointsSubject.next(bpsMap);

      // Assert
      expect(mockEditor.setVerifiedBreakpoints).toHaveBeenCalledWith(filePath, verifiedBps);
    });
  });

  describe('Breakpoint Navigation (Sidebar -> Editor)', () => {
    it('should reveal source file and line when onBreakpointReveal is called', async () => {
      // Arrange
      const filePath = '/src/utils.c';
      const line = 42;
      const onFileSelectedSpy = vi.spyOn(component, 'onFileSelected').mockResolvedValue(undefined);

      // Act
      await component.onBreakpointReveal({ path: filePath, line });

      // Assert
      expect(onFileSelectedSpy).toHaveBeenCalledWith(expect.objectContaining({ path: filePath }));
      expect(component.activeLine).toBe(line);
      expect(component.activeLineFilePath).toBe(filePath);
      expect(component.fileRevealTrigger).toBeGreaterThan(0);
    });
  });

  describe('Mutation Flow (Editor -> Session)', () => {
    it('should proxy editor changes to session service', async () => {
      // Arrange
      const filePath = '/src/app.c';
      const lines = [5, 12];
      component.executionState = 'stopped';

      // Act
      await component.onBreakpointsChange({ file: filePath, lines });

      // Assert
      expect(mockDapSession.setBreakpoints).toHaveBeenCalledWith(filePath, lines);
    });
  });
});
