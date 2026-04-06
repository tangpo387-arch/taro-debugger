import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, Observable, firstValueFrom } from 'rxjs';

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

import { EditorComponent, BreakpointChangeEvent } from './editor.component';
import { FileExplorerComponent } from './file-explorer.component';
import { VariablesComponent } from './variables.component';
import { LogViewerComponent } from './log-viewer.component';
import { ErrorDialog, ErrorDialogData } from './error-dialog/error-dialog';
import { DapConfigService, DapConfig } from './dap-config.service';
import { DapSessionService, ExecutionState, VerifiedBreakpoint } from './dap-session.service';
import { DapVariablesService } from './dap-variables.service';
import { DapEvent } from './dap.types';
import { FileNode } from './file-tree.service';
import { DapLogService } from './dap-log.service';

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
    EditorComponent,
    FileExplorerComponent,
    VariablesComponent,
    LogViewerComponent,
  ],
  providers: [
    DapSessionService,
    DapVariablesService,
    DapLogService,
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

  /** Access the editor component for programmatic breakpoint updates */
  @ViewChild(EditorComponent) private editorComponent?: EditorComponent;

  /** Bind DAP connection status */
  public readonly connectionStatus$: Observable<boolean> = this.dapSession.connectionStatus$;

  /** Bind execution state */
  public readonly executionState$: Observable<ExecutionState> = this.dapSession.executionState$;

  private eventSubscription?: Subscription;
  private stateSubscription?: Subscription;
  /** Subscription for the diagnostic DAP traffic stream (architecture.md §4.6) */
  private trafficSubscription?: Subscription;

  /** Current DAP full configuration for HTML template binding */
  public currentConfig: DapConfig = {
    serverAddress: '',
    transportType: 'websocket',
    launchMode: 'launch',
    executablePath: '',
    sourcePath: '',
    programArgs: ''
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
   * Guards against reloading the file tree on every `stopped` event.
   * Reset only on session-level transitions (terminated, exited, disconnect/reconnect),
   * NOT on ephemeral `continued` events — otherwise a Resume → StepOver cycle
   * would incorrectly trigger a full tree reload on each stop.
   */
  private initialSourcesLoaded: boolean = false;

  // ── Call Stack State ──────────────────────────────────────────────────────

  /** Call stack state */
  public stackFrames: any[] = [];
  public activeFrameId: number | null = null;
  public activeLine: number | null = null;
  public activeLineFilePath: string | null = null;

  /** Resizing state and dimensions */
  public leftWidth: number = 250;
  public rightWidth: number = 300;
  public consoleHeight: number = 250;
  public leftVisible: boolean = true;

  private isResizingLeft = false;
  private isResizingRight = false;
  private isResizingBottom = false;

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
      this.cdr.detectChanges();
    });

    this.eventSubscription = this.dapSession.onEvent().subscribe((event) => {
      this.handleDapEvent(event);
    });

    // Subscribe to the diagnostic traffic stream and bridge to DapLogService (architecture.md §4.6)
    this.trafficSubscription = this.dapSession.onTraffic$.subscribe((msg) => {
      let label: string;
      switch (msg.type) {
        case 'request':
          label = `[→ Request] ${msg.command}`;
          break;
        case 'response':
          label = `[← Response] ${msg.command}`;
          break;
        case 'event':
          label = `[← Event] ${msg.event}`;
          break;
        default:
          label = `[← Unknown] ${typeof msg === 'object' ? JSON.stringify(msg).slice(0, 80) : msg}`;
          break;
      }
      this.logService.consoleLog(label, 'info', 'dap', msg);
    });

    await this.startSession();

    // Load persisted sizes
    this.loadPersistedSizes();
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
      } catch (e) {
        console.warn('Failed to parse persisted layout sizes', e);
      }
    }
  }

  private savePersistedSizes(): void {
    const data = {
      left: this.leftWidth,
      right: this.rightWidth,
      bottom: this.consoleHeight,
      leftVisible: this.leftVisible
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
        const statusBarHeight = 32;
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
  }


  /**
   * Starts the DAP Session, including error handling and retry dialog
   */
  private async startSession(): Promise<void> {
    try {
      this.logService.consoleLog("Initializing DAP Session...", 'info', 'system');

      await this.dapSession.startSession();

      this.logService.consoleLog(`Session started in ${this.currentConfig.launchMode} mode.`, 'info', 'system');

      // Re-push any locally-stored breakpoints to the new adapter session.
      // On first boot this is a no-op; on restart it restores the user's breakpoints.
      await this.resyncAllBreakpoints();
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
   * Re-sends all locally stored breakpoints to the current DAP adapter.
   * Called after every successful session start so that the adapter is always
   * in sync with the editor's breakpoint state, even after a restart.
   * Errors per file are logged and swallowed so one bad file does not block others.
   */
  private async resyncAllBreakpoints(): Promise<void> {
    if (!this.editorComponent) return;

    const allBps = this.editorComponent.getBreakpoints();
    if (allBps.size === 0) return;

    this.logService.consoleLog(
      `Re-syncing ${allBps.size} file(s) of breakpoints to new session...`,
      'info',
      'system'
    );

    const syncPromises = Array.from(allBps.entries()).map(([filePath, lines]) =>
      this.syncBreakpointsForFile(filePath, Array.from(lines))
    );

    // Run all file syncs in parallel; individual failures are handled inside syncBreakpointsForFile
    await Promise.allSettled(syncPromises);
  }

  /**
   * Handles a file-selected event emitted by FileExplorerComponent.
   * Issues a DAP `source` request to load the file content and updates the editor.
   */
  public async onFileSelected(node: FileNode): Promise<void> {
    this.activeFilePath = node.path;
    this.currentCode = '// Loading source code...';
    this.cdr.detectChanges();

    try {
      const code = await firstValueFrom(this.dapSession.fileTree.readFile(node.path));
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
        this.loadCallStack(event.body?.threadId);
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
        this.clearExecutionState();
        this.logService.consoleLog('Debug session terminated', 'info', 'system');
        break;
      case 'exited': {
        this.initialSourcesLoaded = false;
        this.clearExecutionState();
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
      case 'breakpoint': {
        // Server-side breakpoint notification: the adapter is informing us of a state change
        // (e.g., breakpoint verified after lazy symbol load, or relocated to a valid line).
        // We must NOT re-send setBreakpoints here — read the event body directly instead.
        const bp = event.body?.breakpoint;
        if (bp && bp.source?.path && bp.line && this.editorComponent) {
          const filePath: string = bp.source.path;
          // Read the CURRENT verified set for this file so we can update only the affected line.
          // We cannot use the local `breakpoints` Map here — that contains all toggled lines,
          // not just verified ones — passing it to setVerifiedBreakpoints would incorrectly
          // mark unverified (gray) breakpoints as verified (red).
          const currentVerified = new Set(this.editorComponent.getVerifiedLines(filePath));

          // Remove the old line in case the adapter relocated this breakpoint,
          // then add the new line if the adapter confirmed it as verified.
          // Note: DAP spec does not provide originalLine on the breakpoint event,
          // so we remove by bp.line (the adapter's canonical line for this BP).
          currentVerified.delete(bp.line);
          if (bp.verified) {
            currentVerified.add(bp.line);
          }

          this.editorComponent.setVerifiedBreakpoints(filePath, Array.from(currentVerified));
        }
        break;
      }

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
   * Refetches call stack when stopped
   */
  private async loadCallStack(threadId?: number): Promise<void> {
    try {
      let targetThreadId = threadId;
      // Get all threads and use the first one if threadId is not provided
      if (!targetThreadId) {
        const threadsRes = await this.dapSession.threads();
        const threads = threadsRes.body?.threads || [];
        if (threads.length > 0) {
          targetThreadId = threads[0].id;
        }
      }

      if (targetThreadId) {
        const stackRes = await this.dapSession.stackTrace(targetThreadId);
        this.stackFrames = stackRes.body?.stackFrames || [];

        // Render the stack panel immediately before loading source + scopes.
        this.cdr.detectChanges();

        // Load the top frame to show source code by default after success
        if (this.stackFrames.length > 0) {
          await this.onFrameClick(this.stackFrames[0]);
        }
      }
    } catch (e: any) {
      // Clear stale data on failure (Error log handled globally)
      this.stackFrames = [];
      this.cdr.detectChanges();
    }
  }

  /** Trigger load file and line number when Frame is clicked */
  public async onFrameClick(frame: any): Promise<void> {
    this.activeFrameId = frame.id;
    this.activeLine = frame.line;
    this.activeLineFilePath = frame.source?.path || null;

    // Load associated file
    if (frame.source && frame.source.path) {
      this.activeFilePath = frame.source.path;
      this.currentCode = '// Loading source code...';
      this.cdr.detectChanges();

      try {
        const code = await firstValueFrom(this.dapSession.fileTree.readFile(frame.source.path));
        this.currentCode = code;
      } catch (e: any) {
        this.currentCode = `// Error loading file: ${e.message}`;
      }
    } else {
      this.activeFilePath = null;
      const ref = frame.instructionPointerReference ? `\nInstruction Pointer: ${frame.instructionPointerReference}` : '';
      const mod = frame.moduleId ? `\nModule: ${frame.moduleId}` : '';
      this.currentCode = `// No source code available for this frame.${mod}${ref}`;
    }

    // Trigger scope cache update for the newly selected frame
    this.variablesService.fetchScopes(frame.id).catch(e => {
      // Handled globally by synthetic DAP events
    });

    this.cdr.detectChanges();
  }

  /**
   * Called by the editor when the user toggles a breakpoint.
   * Sends the full updated breakpoint list for that file to the DAP adapter,
   * then updates the editor's verified-state decorations from the response.
   */
  public async onBreakpointsChange(event: BreakpointChangeEvent): Promise<void> {
    await this.syncBreakpointsForFile(event.file, event.lines);
  }

  /**
   * Synchronizes breakpoints for a single file with the DAP adapter.
   * Marks breakpoints as verified/unverified in the editor based on the response.
   */
  private async syncBreakpointsForFile(filePath: string, lines: number[]): Promise<void> {
    if (!this.editorComponent) return;

    const executionState = this.executionState;
    // Only send the DAP request when the session is active (not idle/starting/error)
    const activeStates: ExecutionState[] = ['running', 'stopped', 'terminated'];
    if (!activeStates.includes(executionState)) {
      // Session not ready — breakpoints are queued locally, no DAP sync yet
      return;
    }

    try {
      const verified: VerifiedBreakpoint[] = await this.dapSession.setBreakpoints(filePath, lines);
      const verifiedLines = verified
        .filter(bp => bp.verified)
        .map(bp => bp.line);

      this.editorComponent.setVerifiedBreakpoints(filePath, verifiedLines);

      this.logService.consoleLog(
        `Breakpoints synced: ${verifiedLines.length}/${lines.length} verified in ${filePath}`,
        'info',
        'system'
      );
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    }
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
      await this.dapSession.terminate();
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    }
  }

  /** Reset session (Disconnect and restart) */
  public async onRestart(): Promise<void> {
    const validStates: ExecutionState[] = ['running', 'stopped', 'terminated', 'error'];
    if (!validStates.includes(this.executionState)) return;

    // Cache the state BEFORE disconnect overrides it to 'idle'
    const wasError = this.executionState === 'error';

    try {
      await this.dapSession.disconnect();
      this.initialSourcesLoaded = false; // Full session restart — allow initial tree load on next stopped.
      this.clearExecutionState();
      this.logService.consoleLog(wasError ? 'Reconnecting to session...' : 'Restarting session...', 'info', 'system');
      await this.startSession();
    } catch (e: any) {
      this.logService.consoleLog(`Restart/Reconnect failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Clear UI state related to the current execution point (stacks, current line, etc.) */
  private clearExecutionState(): void {
    this.stackFrames = [];
    this.activeFrameId = null;
    this.activeLine = null;
    this.activeLineFilePath = null;
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
}
