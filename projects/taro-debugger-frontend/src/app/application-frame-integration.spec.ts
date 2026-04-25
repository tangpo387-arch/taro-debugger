import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebuggerComponent } from './debugger.component';
import { DebugControlGroupComponent } from './debug-control-group.component';
import { KeyboardShortcutService, ActionID } from './keyboard-shortcut.service';
import { DapSessionService, DapConfigService } from '@taro/dap-core';
import { DapLogService } from '@taro/ui-console';
import { DapVariablesService } from '@taro/ui-inspection';
import { DapAssemblyService } from '@taro/ui-assembly';
import { DapFileTreeService } from './dap-file-tree.service';
import { Subject, BehaviorSubject, of, EMPTY } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

describe('WI-81: Application Frame & Global Controls Integration', () => {

  describe('DebuggerComponent (Mode Detection & Layout Toggling)', () => {
    let component: DebuggerComponent;
    let mockShortcutService: any;
    let mockDapSession: any;
    let mockDialog: any;

    beforeEach(() => {
      mockShortcutService = {
        onAction$: new Subject<ActionID>(),
        initElectronListener: vi.fn()
      };

      mockDapSession = {
        connectionStatus$: EMPTY,
        executionState$: new BehaviorSubject('idle').asObservable(),
        onEvent: () => EMPTY,
        onTraffic$: EMPTY,
        breakpoints$: EMPTY,
        disconnect: vi.fn(),
        startSession: vi.fn().mockResolvedValue({}),
        resyncAllBreakpoints: vi.fn().mockResolvedValue({})
      };

      mockDialog = {
        open: vi.fn().mockReturnValue({
          afterClosed: () => of(true),
          close: vi.fn()
        })
      };

      TestBed.configureTestingModule({
        imports: [MatDialogModule],
        providers: [
          DebuggerComponent,
          { provide: KeyboardShortcutService, useValue: mockShortcutService },
          { provide: DapSessionService, useValue: mockDapSession },
          { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: 'exe' }) } },
          { provide: DapLogService, useValue: { consoleLog: vi.fn(), appendDapLog: vi.fn() } },
          { provide: DapVariablesService, useValue: { executionState$: EMPTY, scopes$: EMPTY, clear: vi.fn(), fetchScopes: vi.fn() } },
          { provide: DapAssemblyService, useValue: { clear: vi.fn(), instructions$: EMPTY } },
          { provide: DapFileTreeService, useValue: { readFile: () => of(''), getTree: () => EMPTY, destroy: vi.fn() } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: MatSnackBar, useValue: { open: vi.fn() } },
          { provide: MatDialog, useValue: mockDialog },
          { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn(), markForCheck: vi.fn() } },
          { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        ]
      });

      // Reset global electronAPI before each test
      (window as any).electronAPI = undefined;
    });

    describe('Mode Detection', () => {
      it('should identify Web mode when electronAPI is missing', () => {
        component = TestBed.inject(DebuggerComponent);
        expect(component.isElectron).toBe(false);
      });

      it('should identify Electron mode when electronAPI is present', () => {
        (window as any).electronAPI = { on: vi.fn(), send: vi.fn() };
        component = TestBed.inject(DebuggerComponent);
        expect(component.isElectron).toBe(true);
      });
    });

    describe('Layout Toggling', () => {
      beforeEach(() => {
        component = TestBed.inject(DebuggerComponent);
        (component as any).initShortcuts(); // Subscribe to action$
      });

      it('should toggle left sidenav on VIEW_TOGGLE_EXPLORER', () => {
        component.leftVisible = true;
        mockShortcutService.onAction$.next(ActionID.VIEW_TOGGLE_EXPLORER);
        expect(component.leftVisible).toBe(false);
      });

      it('should toggle right sidenav on VIEW_TOGGLE_INSPECTION', () => {
        component.rightVisible = true;
        mockShortcutService.onAction$.next(ActionID.VIEW_TOGGLE_INSPECTION);
        expect(component.rightVisible).toBe(false);
      });

      it('should toggle console on VIEW_TOGGLE_CONSOLE', () => {
        component.consoleVisible = true;
        mockShortcutService.onAction$.next(ActionID.VIEW_TOGGLE_CONSOLE);
        expect(component.consoleVisible).toBe(false);
      });

      it('should reset layout on VIEW_RESET_LAYOUT', () => {
        component.leftWidth = 100;
        component.rightVisible = false;
        mockShortcutService.onAction$.next(ActionID.VIEW_RESET_LAYOUT);
        expect(component.leftWidth).toBe(250);
        expect(component.rightVisible).toBe(true);
      });
    });
    
    describe('Layout Rendering', () => {
      it('should NOT render toggle buttons in Electron mode', () => {
        // Set up Web mode
        const webFixture = TestBed.createComponent(DebuggerComponent);
        const webComp = webFixture.componentInstance;
        (webComp as any).isElectron = false;
        webFixture.detectChanges();
        let toggleBtns = webFixture.nativeElement.querySelectorAll('.toolbar-right button[mat-icon-button]');
        // 3 toggles (explorer, inspection, console) + 1 logout = 4 buttons
        expect(toggleBtns.length).toBe(4);

        // Set up Electron mode
        const electronFixture = TestBed.createComponent(DebuggerComponent);
        const electronComp = electronFixture.componentInstance;
        (electronComp as any).isElectron = true;
        electronFixture.detectChanges();
        toggleBtns = electronFixture.nativeElement.querySelectorAll('.toolbar-right button[mat-icon-button]');
        // Should be 0 since they are wrapped in @if (!isElectron)
        expect(toggleBtns.length).toBe(0);
      });
    });

    describe('Status Bar (Footer)', () => {
      it('should update executionState property', () => {
        const stateSubject = new BehaviorSubject('stopped');
        mockDapSession.executionState$ = stateSubject.asObservable();
        component = TestBed.inject(DebuggerComponent);
        
        // Mimic ngOnInit to subscribe to state
        component.ngOnInit();
        
        expect(component.executionState).toBe('stopped');
      });
    });
  });

  describe('DebugControlGroupComponent (Status LED)', () => {
    let component: DebugControlGroupComponent;
    let fixture: ComponentFixture<DebugControlGroupComponent>;
    let mockDapSession: any;
    let executionStateSubject: BehaviorSubject<string>;

    beforeEach(async () => {
      executionStateSubject = new BehaviorSubject('idle');
      mockDapSession = {
        executionState$: executionStateSubject.asObservable(),
        commandInFlight$: new BehaviorSubject(false).asObservable(),
        continue: vi.fn().mockResolvedValue({}),
        pause: vi.fn().mockResolvedValue({}),
        next: vi.fn().mockResolvedValue({}),
        stepIn: vi.fn().mockResolvedValue({}),
        stepOut: vi.fn().mockResolvedValue({})
      };

      await TestBed.configureTestingModule({
        imports: [DebugControlGroupComponent, CommonModule, MatIconModule],
        providers: [
          { provide: DapSessionService, useValue: mockDapSession }
        ],
        schemas: [NO_ERRORS_SCHEMA]
      }).compileComponents();

      fixture = TestBed.createComponent(DebugControlGroupComponent);
      component = fixture.componentInstance;
    });

    it('should show "paused" state correctly (static yellow)', () => {
      executionStateSubject.next('stopped');
      fixture.detectChanges();
      const container = fixture.nativeElement.querySelector('.status-led-container');
      const led = fixture.nativeElement.querySelector('.status-led');
      expect(led.classList).toContain('stopped');
      expect(container.title).toBe('Stopped');
    });

    it('should show "running" state correctly (pulsing green)', () => {
      executionStateSubject.next('running');
      fixture.detectChanges();
      const container = fixture.nativeElement.querySelector('.status-led-container');
      const led = fixture.nativeElement.querySelector('.status-led');
      expect(led.classList).toContain('running');
      expect(container.title).toBe('Running');
    });
  });
});
