import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ViewChild, DestroyRef, ElementRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, Observable, firstValueFrom, Subject, from, of, forkJoin } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';

// Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';

import { EditorComponent } from '@taro/ui-editor';
import { FileExplorerComponent } from './file-explorer.component';
import {
  VariablesComponent,
  ThreadCallStackComponent,
  DapVariablesService,
  BreakpointsComponent,
  MemoryViewComponent,
} from '@taro/ui-inspection';
import { PanelComponent, PanelGroupComponent, ErrorDialog, ErrorDialogData, TaroEmptyStateComponent } from '@taro/ui-shared';
import { LogViewerComponent } from '@taro/ui-console';
import { DapConfigService, DapConfig } from '@taro/dap-core';
import { DapSessionService, DapThreadSession, ExecutionState, VerifiedBreakpoint } from '@taro/dap-core';
import { DapEvent, DapStackFrame } from '@taro/dap-core';
import { FileNode } from './file-tree.service';
import { DapLogService } from '@taro/ui-console';
import { DebugControlGroupComponent } from './debug-control-group.component';
import { AssemblyViewComponent } from '@taro/ui-assembly';
import { DapAssemblyCacheService } from '@taro/dap-core';
import { DapMemoryService } from '@taro/dap-core';
import { KeyboardShortcutService, ActionID } from './keyboard-shortcut.service';
import { DapFileTreeService } from './dap-file-tree.service';

@Component({
  selector: 'app-debugger',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSidenavModule,
    MatListModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTabsModule,
    EditorComponent,
    FileExplorerComponent,
    VariablesComponent,
    LogViewerComponent,
    DebugControlGroupComponent,
    ThreadCallStackComponent,
    AssemblyViewComponent,
    PanelGroupComponent,
    PanelComponent,
    BreakpointsComponent,
    MemoryViewComponent,
    TaroEmptyStateComponent,
  ],
  providers: [
    DapSessionService,
    DapFileTreeService,
    DapVariablesService,
    DapLogService,
    DapAssemblyCacheService,
    DapMemoryService,
  ],
  templateUrl: './debugger.component.html',
  styleUrls: ['./debugger.component.scss']
})
export class DebuggerComponent implements OnInit, OnDestroy {
  // ── Injected Services ────────────────────────────────────────────────────
  private readonly configService = inject(DapConfigService);
  private readonly router = inject(Router);
  private readonly dapSession = inject(DapSessionService);
  private readonly variablesService = inject(DapVariablesService);
  private readonly logService = inject(DapLogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly shortcutService = inject(KeyboardShortcutService);
  private readonly fileTreeService = inject(DapFileTreeService);
  private readonly memoryService = inject(DapMemoryService);
  private readonly destroyRef = inject(DestroyRef);

  /** Access the editor component for programmatic breakpoint updates */
  @ViewChild(EditorComponent) private editorComponent?: EditorComponent;
  @ViewChild(LogViewerComponent) private logViewer?: LogViewerComponent;

  /** ViewChild references for sidenavs — used by vertical panel resize logic to compute bounding rects.
   *  Queried via template ref vars #leftSidenav / #rightSidenav on the mat-sidenav elements.
   */
  @ViewChild('leftSidenav', { read: ElementRef }) private leftSidenavRef?: ElementRef<HTMLElement>;
  @ViewChild('rightSidenav', { read: ElementRef }) private rightSidenavRef?: ElementRef<HTMLElement>;

  /** Bind DAP connection status */
  public readonly connectionStatus$: Observable<boolean> = this.dapSession.connectionStatus$;

  /** Bind execution state */
  public readonly executionState$: Observable<ExecutionState> = this.dapSession.executionState$;

  /** Signal representing the current session connection status */
  public readonly isConnected = toSignal(
    this.dapSession.connectionStatus$,
    { initialValue: false }
  );

  private eventSubscription?: Subscription;
  private stateSubscription?: Subscription;
  /** Subscription for the diagnostic DAP traffic stream (architecture.md §4.6) */
  private trafficSubscription?: Subscription;

  /** Subject for serializing frame selection requests (WI-42) */
  private readonly frameSelected$ = new Subject<DapStackFrame>();

  /** Current DAP full configuration for HTML template binding */
  public currentConfig: DapConfig = {
    serverAddress: '',
    transportType: 'websocket',
    launchMode: 'launch',
    executablePath: '',
    sourcePath: '',
    programArgs: '',
    stopOnEntry: true
  };

  /** Current execution state (used for non-async pipe scenarios) */
  public executionState: ExecutionState = 'idle';

  // ── Editor State (orchestration) ─────────────────────────────────────────

  /** Path of the file currently displayed in the Monaco editor. */
  public activeFilePath: string | null = null;

  /** Source code content currently displayed in the Monaco editor. */
  public currentCode: string = '// Editor is ready.';

  // ── File Tree Reload Trigger ──────────────────────────────────────────────

  /**
   * Incrementing counter passed to FileExplorerComponent as [reloadTrigger].
   *
   * Two-phase trigger strategy (per R11 / C/C++ Source Listing 規範):
   *   1. Incremented on the **first** `stopped` event to fetch the initial source tree.
   *   2. Incremented on each `loadedSource` event for dynamic library loads (dlopen).
   * General stepping pauses do NOT trigger a reload.
   */
  public fileTreeReloadTrigger: number = 0;

  /**
   * Incrementing counter passed to FileExplorerComponent as [revealTrigger].
   * Triggered on every explicit call stack frame click to ensure the tree
   * expands and scrolls to the node at `activeFilePath`.
   */
  public fileRevealTrigger: number = 0;

  /**
   * Guards against reloading the file tree on every `stopped` event.
   * Reset only on session-level transitions (terminated, exited, disconnect/reconnect),
   * NOT on ephemeral `continued` events — otherwise a Resume → StepOver cycle
   * would incorrectly trigger a full tree reload on each stop.
   */
  private initialSourcesLoaded: boolean = false;

  // ── Call Stack State ──────────────────────────────────────────────────────

  /** Call stack state */
  public activeFrameId: number | null = null;
  public activeLine: number | null = null;
  public activeLineFilePath: string | null = null;
  public activeInstructionPointer: bigint | undefined = undefined;

  /** Sidenav widths, console height, and left visibility */
  public leftWidth: number = 250;
  public rightWidth: number = 300;
  public consoleHeight: number = 250;
  public leftVisible: boolean = true;
  /** Current active tab in the main content area (0: Source, 1: Disassembly) */
  public activeTabIndex: number = 0;

  // ── Memory State ──────────────────────────────────────────────────────────
  public activeMemoryAddress: bigint | null = null;
  public activeMemoryData: Uint8Array = new Uint8Array(0);
  public isMemoryLoading: boolean = false;

  public rightVisible: boolean = true;
  public consoleVisible: boolean = true;
  public isElectron: boolean = !!(window as any).electronAPI;

  private readonly STORAGE_KEY = 'taro-debugger-layout-sizes';

  /**
   * Executed on component initialization
   * Responsible for fetching the latest configuration from DapConfigService
   */
  public async ngOnInit(): Promise<void> {
    this.currentConfig = this.configService.getConfig();

    this.logService.consoleLog("Start debugging session...", 'info', 'system');

    // Guard mechanism: If executable path is missing, automatically navigate back to setup page
    if (!this.currentConfig.executablePath) {
      console.warn('Incomplete configuration parameters detected. Navigating back to setup page.');
      this.snackBar.open('Incomplete configuration parameters detected. Returning to setup page.', 'OK', { duration: 3000 });
      this.router.navigate(['/setup']);
      return;
    }

    // Subscribe to execution state changes
    this.stateSubscription = this.dapSession.executionState$.subscribe(state => {
      this.executionState = state;

      // R_SM5 compliance: Auto-clear execution-specific state whenever the process
      // transitions out of the 'stopped' context (e.g., to 'running', 'error' or 'idle').
      // This ensures the Call Stack panel matches the Variables panel behavior.
      if (state === 'running' || state === 'error' || state === 'idle') {
        this.clearExecutionState();
      }

      // Clear all persistent view state on fatal error or session termination
      if (state === 'error' || state === 'idle') {
        this.activeMemoryAddress = null;
        this.activeMemoryData = new Uint8Array(0);
        this.currentCode = '';
        this.activeFilePath = null;
      }

      this.cdr.detectChanges();
    });

    this.dapSession.activeThread$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (thread) => {
        if (thread && this.executionState === 'stopped') {
          await this.autoSelectTopFrame(thread);
        }
      });

    this.eventSubscription = this.dapSession.onEvent().subscribe((event) => {
      this.handleDapEvent(event);
    });

    // Subscribe to the diagnostic traffic stream and bridge to DapLogService (architecture.md §4.6)
    this.trafficSubscription = this.dapSession.onTraffic$.subscribe((msg) => {
      this.logService.appendDapLog(msg);
    });

    await this.startSession();

    // Initialize global keyboard shortcuts (F5-F11)
    this.initShortcuts();

    // Load persisted sizes
    this.loadPersistedSizes();

    // Initialize frame selection serialization stream (WI-42)
    this.initFrameSelectionStream();
  }

  /**
   * Initializes the RxJS stream for serializing frame selection requests.
   * Uses switchMap to ensure that if a new frame is selected before the previous
   * requests (source, disassembly, scopes) complete, the previous ones are discarded.
   */
  private initFrameSelectionStream(): void {
    this.frameSelected$.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((frame: DapStackFrame) => {
        const tasks: Observable<any>[] = [];

        // 1. Load Source Code
        if (frame.source?.path) {
          tasks.push(
            this.fileTreeService.readFile(frame.source.path, frame.source.sourceReference).pipe(
              tap(code => {
                this.currentCode = code;
                this.cdr.detectChanges();
              }),
              catchError(e => {
                this.currentCode = `// Error loading file: ${e.message}`;
                this.cdr.detectChanges();
                return of(null);
              })
            )
          );
        }

        // 2. Load Scopes (Variable Inspector)
        tasks.push(
          from(this.variablesService.fetchScopes(frame.id)).pipe(
            catchError(() => of(null))
          )
        );

        return forkJoin(tasks);
      })
    ).subscribe();
  }

  private loadPersistedSizes(): void {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (data) {
      try {
        const sizes = JSON.parse(data);
        if (sizes.left && typeof sizes.left === 'number') {
          this.leftWidth = Math.max(150, Math.min(600, sizes.left));
        }
        if (sizes.right && typeof sizes.right === 'number') {
          this.rightWidth = Math.max(200, Math.min(600, sizes.right));
        }
        if (sizes.bottom && typeof sizes.bottom === 'number') {
          this.consoleHeight = Math.max(100, Math.min(window.innerHeight - 200, sizes.bottom));
        }
        if (sizes.leftVisible !== undefined) {
          this.leftVisible = !!sizes.leftVisible;
        }
        if (sizes.rightVisible !== undefined) {
          this.rightVisible = !!sizes.rightVisible;
        }
        if (sizes.consoleVisible !== undefined) {
          this.consoleVisible = !!sizes.consoleVisible;
        }
      } catch (e: any) {
        console.warn('Failed to parse persisted layout sizes', e);
      }
    }
  }

  private savePersistedSizes(): void {
    const data = {
      left: this.leftWidth,
      right: this.rightWidth,
      bottom: this.consoleHeight,
      leftVisible: this.leftVisible,
      rightVisible: this.rightVisible,
      consoleVisible: this.consoleVisible,
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // ── Resizing Logic ─────────────────────────────────────────────────

  public onResizeStart(event: MouseEvent, direction: 'left' | 'right' | 'bottom'): void {
    event.preventDefault();

    // Add global listeners
    const mouseMove = (e: MouseEvent) => {
      if (direction === 'left') {
        this.leftWidth = Math.max(150, Math.min(600, e.clientX));
      } else if (direction === 'right') {
        const windowWidth = window.innerWidth;
        this.rightWidth = Math.max(200, Math.min(600, windowWidth - e.clientX));
      } else if (direction === 'bottom') {
        const windowHeight = window.innerHeight;
        // Resolve the status bar height dynamically from CSS tokens
        const statusBarHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sys-density-header-height')) || 32;
        this.consoleHeight = Math.max(100, Math.min(windowHeight - 150, windowHeight - e.clientY - statusBarHeight));
      }
      this.cdr.detectChanges();
    };

    const mouseUp = () => {
      this.savePersistedSizes();
      window.removeEventListener('mousemove', mouseMove);
      window.removeEventListener('mouseup', mouseUp);
    };

    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mouseup', mouseUp);
  }

  /**
   * Toggle the visibility of the left sidebar (File Explorer)
   */
  public toggleLeftSidenav(): void {
    this.leftVisible = !this.leftVisible;
    this.savePersistedSizes();
    this.updateElectronMenu('view.toggleExplorer', this.leftVisible);
    this.cdr.detectChanges();
  }

  /**
   * Toggle the visibility of the right sidebar (Breakpoints, Variables, Call Stack)
   */
  public toggleRightSidenav(): void {
    this.rightVisible = !this.rightVisible;
    this.savePersistedSizes();
    this.updateElectronMenu('view.toggleInspection', this.rightVisible);
    this.cdr.detectChanges();
  }

  /**
   * Toggle the visibility of the bottom console panel
   */
  public toggleConsole(): void {
    this.consoleVisible = !this.consoleVisible;
    this.savePersistedSizes();
    this.updateElectronMenu('view.toggleConsole', this.consoleVisible);
    this.cdr.detectChanges();
  }

  /**
   * Resets the layout to default sizes and visibility
   */
  public resetLayout(): void {
    this.leftWidth = 250;
    this.rightWidth = 300;
    this.consoleHeight = 250;
    this.leftVisible = true;
    this.rightVisible = true;
    this.consoleVisible = true;
    this.savePersistedSizes();

    // Sync all menu items
    this.updateElectronMenu('view.toggleExplorer', true);
    this.updateElectronMenu('view.toggleInspection', true);
    this.updateElectronMenu('view.toggleConsole', true);

    this.cdr.detectChanges();
  }

  /**
   * Sends an IPC message to the main process to update the native menu checkbox state.
   */
  private updateElectronMenu(id: string, checked: boolean): void {
    if (this.isElectron) {
      (window as any).electronAPI?.send('update-menu-state', { id, checked });
    }
  }

  /**
   * Starts the DAP Session, including error handling and retry dialog
   */
  private async startSession(): Promise<void> {
    try {
      this.logService.consoleLog("Initializing DAP Session...", 'info', 'system');

      await this.dapSession.startSession();

      this.logService.consoleLog(`Session started in ${this.currentConfig.launchMode} mode.`, 'info', 'system');
    } catch (error: any) {
      // 1. Clean up problematic session
      this.dapSession.disconnect();

      const msg = error?.message || 'Unknown error';
      this.logService.consoleLog(`Start Session failed: ${msg}`, 'error', 'system');

      // 2. Show error dialog
      const dialogRef = this.dialog.open(ErrorDialog, {
        width: '400px',
        disableClose: true, // Force user to make a choice
        data: {
          title: 'DAP Handshake Failed',
          message: `Could not establish DAP connection or session: ${msg}`
        } as ErrorDialogData
      });

      // 3. Handle dialog result
      dialogRef.afterClosed().subscribe((result: string) => {
        if (result === 'retry') {
          this.logService.consoleLog("Retrying session...", 'info', 'system');
          this.startSession(); // Retry
        } else {
          // 'goback' or other close action
          this.goBack();
        }
      });
    }
  }

  /**
   * Handles a file-selected event emitted by FileExplorerComponent.
   * Issues a DAP `source` request to load the file content and updates the editor.
   */
  public async onFileSelected(node: FileNode): Promise<void> {
    this.activeFilePath = node.path;
    this.currentCode = '// Loading source code...';
    this.activeTabIndex = 0; // Switching to Source tab immediately (avoids UI lag/error masking)
    this.cdr.detectChanges();

    try {
      // Pass sourceReference so virtual sources (ref > 0) are keyed correctly in the cache.
      const code = await firstValueFrom(this.fileTreeService.readFile(node.path, node.sourceReference));
      this.currentCode = code;
    } catch (e: any) {
      this.currentCode = `// Error loading file: ${e.message}`;
    }
    this.cdr.detectChanges();
  }

  private handleDapEvent(event: DapEvent): void {
    // Note: All DAP events (including custom/synthetic events) are already logged
    // by the onTraffic$ subscriber in ngOnInit. This handler is strictly for
    // business-logic side-effects and state transitions.
    switch (event.event) {
      case 'initialized':
        this.logService.consoleLog("Configuration Done.", 'info', 'system');
        break;
      case 'stopped':
        // As per C/C++ Source Listing 規範 (Q6 & R11):
        // 1. Request `loadedSources` on the FIRST `stopped` event.
        // 2. Subsequent updates exclusively rely on the `loadedSource` event.
        if (!this.initialSourcesLoaded) {
          this.initialSourcesLoaded = true;
          this.fileTreeReloadTrigger++;
        }
        if (this.activeMemoryAddress) {
          this.refreshMemory();
        }
        break;
      case 'continued':
        this.clearExecutionState();
        break;
      case 'loadedSource':
        // Increment trigger so FileExplorerComponent reloads on dynamic source load
        this.fileTreeReloadTrigger++;
        break;
      case 'terminated':
        this.initialSourcesLoaded = false;
        this.logService.consoleLog('Debug session terminated', 'info', 'system');
        break;
      case 'exited': {
        this.initialSourcesLoaded = false;
        const exitCode = event.body?.exitCode;
        if (exitCode !== undefined && exitCode !== 0) {
          // Abnormal exit: show warning snackbar with exit code (§7.2)
          this.logService.consoleLog(`[Warning] Program exited with non-zero code: ${exitCode}`, 'error', 'system');
        } else {
          this.logService.consoleLog('Program exited normally', 'info', 'system');
        }
        break;
      }
      case 'output':
        if (event.body) {
          const body = event.body as any;
          const outMsg = body.output;
          const category = body.category || 'console';
          if (category === 'stdout' || category === 'stderr') {
            this.logService.appendProgramLog(outMsg, category);
          } else {
            this.logService.consoleLog(outMsg, 'info', category);
          }
        }
        break;

      // ── DAP Server Error Handling (§7.2) ────────────────────────

      case '_dapError': {
        // DAP error response: display error message to user via snackbar
        const errBody = event.body as { command: string; message: string };
        const errMsg = `DAP Error [${errBody.command}]: ${errBody.message}`;
        this.logService.consoleLog(errMsg, 'error', 'system');
        this.snackBar.open(errMsg, 'Dismiss', { duration: 5000 });
        break;
      }
      case '_transportError': {
        // Abnormal transport disconnection: notify user (§7.1 / §7.2)
        const body = event.body as { reason: string; message: string };
        const reason = body.reason === 'disconnected'
          ? 'Connection lost'
          : 'Transport error';
        this.logService.consoleLog(`${reason}: ${body.message}`, 'error', 'system');
        this.snackBar.open(`${reason}: ${body.message}`, 'Dismiss', { duration: 8000 });
        break;
      }
      case '_sessionWarning': {
        // Session-layer protocol anomaly: log to console only (non-critical, no snackbar)
        const warnBody = event.body as { message: string };
        this.logService.consoleLog(warnBody.message, 'error', 'system');
        break;
      }
    }
    this.cdr.detectChanges();
  }

  /**
   * Automatically selects the top stack frame of the active thread when the debugger is paused.
   * This guarantees that GDB's stop location is immediately shown in the Editor & Scopes views.
   */
  private async autoSelectTopFrame(thread: DapThreadSession): Promise<void> {
    try {
      const stackFrames = await thread.stackTrace();

      // Race condition guard: If the process resumed while the request was in flight,
      // discard the results to prevent stale data from appearing in the UI.
      if (this.executionState !== 'stopped') {
        return;
      }

      this.cdr.detectChanges();

      // Load the top frame to show source code by default after success
      if (stackFrames.length > 0) {
        await this.onFrameClick(stackFrames[0]);
      }
    } catch (e: any) {
      // Clear stale data on failure (Error log handled globally)
      this.cdr.detectChanges();
    }
  }

  /**
   * Triggered when a frame is clicked in the Call Stack panel.
   * Performs immediate synchronous UI updates and then triggers the serialized async flow.
   */
  public onFrameClick(frame: DapStackFrame): void {
    // ── Synchronous UI State Updates ─────────────────────────────────────────
    this.activeFrameId = frame.id;
    this.activeLine = frame.line;
    // Normalize: strip any trailing slash that some DAP adapters (e.g. GDB MI) append to source paths.
    this.activeLineFilePath = frame.source?.path?.replace(/\/+$/, '') || null;
    this.activeInstructionPointer = frame.instructionPointerReference;

    if (frame.source && frame.source.path) {
      // Normalize: strip trailing slash before storing as the editor filename / breakpoint map key.
      this.activeFilePath = frame.source.path.replace(/\/+$/, '');
      this.fileRevealTrigger++; // Always trigger a UX reveal on explicit navigation
      this.currentCode = '// Loading source code...';

      // Focus Source tab only if we're already there, or if there's no IP to show in Disassembly
      if (this.activeTabIndex === 0 || frame.instructionPointerReference == undefined) {
        this.activeTabIndex = 0;
      }
    } else {
      this.activeFilePath = null;
      const ref = frame.instructionPointerReference ? `\nInstruction Pointer: ${frame.instructionPointerReference}` : '';
      const mod = frame.moduleId ? `\nModule: ${frame.moduleId}` : '';
      this.currentCode = `// No source code available for this frame.${mod}${ref}`;

      // R_UX_A: No auto-switch to Disassembly. Stay on current tab.
      // If we are on Source, we show the enhanced empty state.
      // If we are on Disassembly, we stay there (already sticky).
      if (this.activeTabIndex === 0 || !frame.instructionPointerReference) {
        this.activeTabIndex = 0;
      }
    }

    // ── Trigger Asynchronous Flow (Serialized via switchMap) ─────────────────
    this.frameSelected$.next(frame);

    this.cdr.detectChanges();
  }

  /**
   * Refreshes the currently active memory block.
   */
  private async refreshMemory(): Promise<void> {
    if (!this.activeMemoryAddress || this.executionState !== 'stopped') return;

    this.isMemoryLoading = true;
    this.cdr.detectChanges();

    try {
      const data = await this.memoryService.read(this.activeMemoryAddress, 0, 1024);
      this.activeMemoryData = data;
    } catch (e: any) {
      this.logService.consoleLog(`Failed to refresh memory: ${e.message}`, 'error', 'system');
    } finally {
      this.isMemoryLoading = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Handles memory inspection request from Variables component or manual input.
   */
  public async onInspectMemory(addressOrRef: bigint): Promise<void> {
    if (!addressOrRef) return;

    this.activeMemoryAddress = addressOrRef;
    this.activeTabIndex = 2; // Switch to Memory tab
    this.isMemoryLoading = true;
    this.activeMemoryData = new Uint8Array(0);
    this.cdr.detectChanges();

    try {
      // Read 1KB of memory by default
      const data = await this.memoryService.read(addressOrRef, 0, 1024);
      this.activeMemoryData = data;
    } catch (e: any) {
      this.logService.consoleLog(`Failed to read memory at ${addressOrRef}: ${e.message}`, 'error', 'system');
    } finally {
      this.isMemoryLoading = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Handles breakpoint selection in the sidebar panel.
   * Forces the editor to reveal the target file and line.
   */
  public async onBreakpointReveal(event: { path: string, line: number }): Promise<void> {
    // 1. Open the file if not already active
    if (this.activeFilePath !== event.path) {
      // onFileSelected handles state updates and source fetching
      await this.onFileSelected({ path: event.path } as any);
    }

    // 2. Set the active line and trigger the reveal snap
    this.activeLine = event.line;
    this.activeLineFilePath = event.path;
    this.fileRevealTrigger++;

    this.cdr.detectChanges();
  }

  /** Resume execution */
  public async onResume(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.continue();
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    }
  }

  /** Pause execution */
  public async onPause(): Promise<void> {
    if (this.executionState !== 'running') return;
    try {
      await this.dapSession.pause();
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    }
  }

  /** Step Over */
  public async onStepOver(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.next();
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    }
  }

  /**
   * Manually switches the center view to the Disassembly tab.
   * Triggered by the "View Disassembly" action button in the Source tab's empty state.
   */
  public onSwitchToDisassembly(): void {
    this.activeTabIndex = 1;
    this.cdr.detectChanges();
  }

  /** Step Into */
  public async onStepInto(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.stepIn();
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    }
  }

  /** Step Out */
  public async onStepOut(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.stepOut();
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    }
  }

  /** Stop debugging */
  public async onStop(): Promise<void> {
    try {
      this.logService.consoleLog('Debug session stopped by user', 'info', 'system');
      await this.dapSession.stop();
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    }
  }

  /** Start new session (Run) */
  public async onRun(): Promise<void> {
    try {
      await this.dapSession.startSession();
    } catch (e: any) {
      this.logService.consoleLog(`Run failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Reset session (Restart) */
  public async onRestart(): Promise<void> {
    try {
      await this.dapSession.restart();
    } catch (e: any) {
      this.logService.consoleLog(`Restart failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Clear UI state related to the current execution point (stacks, current line, etc.) */
  private clearExecutionState(): void {
    this.activeFrameId = null;
    this.activeLine = null;
    this.activeLineFilePath = null;
    this.activeInstructionPointer = undefined;
    // Note: initialSourcesLoaded is intentionally NOT reset here.
    // It is only reset on session-level events (terminated, exited) or explicit
    // disconnect/reconnect — to prevent a Resume → StepOver cycle from triggering
    // a redundant full file tree reload.
    this.cdr.detectChanges();
  }

  public ngOnDestroy(): void {
    this.eventSubscription?.unsubscribe();
    this.stateSubscription?.unsubscribe();
    this.trafficSubscription?.unsubscribe();
    this.dapSession.disconnect();
  }

  /**
   * Handle 'Reset' button click event
   * Disconnects current debug session and navigates back to setup view
   */
  public goBack(): void {
    // Disconnect session and connection
    this.dapSession.disconnect();

    this.router.navigate(['/setup']);
  }

  /** Handle instruction-level stepping requested from the control group */
  public async onStepInstructionTab(action: 'stepi' | 'nexti'): Promise<void> {
    if (this.executionState !== 'stopped') return;

    // Switch to Disassembly tab immediately (activeTabIndex = 1)
    this.activeTabIndex = 1;
    this.cdr.detectChanges();

    try {
      if (action === 'nexti') {
        await this.dapSession.nextInstruction();
      } else {
        await this.dapSession.stepInInstruction();
      }
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    }
  }

  /**
   * Links the global keyboard shortcut stream to component-level action handlers.
   * Leverages takeUntilDestroyed() for memory safety.
   */
  private initShortcuts(): void {
    this.shortcutService.onAction$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((actionId) => {
        // Log the shortcut action for debug visibility in Console
        this.logService.consoleLog(`Action triggered: ${actionId}`, 'info', 'system');

        switch (actionId) {
          case ActionID.DEBUG_CONTINUE: this.onResume(); break;
          case ActionID.DEBUG_PAUSE: this.onPause(); break;
          case ActionID.DEBUG_STEP_OVER: this.onStepOver(); break;
          case ActionID.DEBUG_STEP_INTO: this.onStepInto(); break;
          case ActionID.DEBUG_STEP_OUT: this.onStepOut(); break;
          case ActionID.DEBUG_STOP: this.onStop(); break;
          case ActionID.DEBUG_RESTART: this.onRestart(); break;
          case ActionID.EDITOR_TOGGLE_BREAKPOINT:
            this.editorComponent?.toggleBreakpointAtCurrentPosition();
            break;

          case ActionID.VIEW_TOGGLE_EXPLORER: this.toggleLeftSidenav(); break;
          case ActionID.VIEW_TOGGLE_INSPECTION: this.toggleRightSidenav(); break;
          case ActionID.VIEW_TOGGLE_CONSOLE: this.toggleConsole(); break;
          case ActionID.VIEW_RESET_LAYOUT: this.resetLayout(); break;
          case ActionID.CONSOLE_FOCUS:
            if (!this.consoleVisible) {
              this.toggleConsole();
            }
            this.logViewer?.focusDebugConsole();
            break;

          case ActionID.FILE_NEW_SESSION: this.goBack(); break;
          case ActionID.FILE_CLOSE_SESSION: this.goBack(); break;
          case ActionID.FILE_EXIT:
            if (this.isElectron) {
              (window as any).electronAPI.send('exit-app');
            }
            break;

          case ActionID.HELP_DOCS: window.open('https://github.com/tangpo387-arch/taro-debugger/docs', '_blank'); break;
          case ActionID.HELP_ABOUT:
            this.snackBar.open('Taro Debugger v1.0.0-alpha', 'OK', { duration: 3000 });
            break;
        }
      });
  }
}
