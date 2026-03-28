import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, Observable, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ViewChildren, QueryList } from '@angular/core';

// Import Angular Material modules
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

import { MatTreeModule, MatTree } from '@angular/material/tree';

import { EditorComponent, BreakpointChangeEvent } from './editor.component';
import { VariablesComponent } from './variables.component';
import { ErrorDialog, ErrorDialogData } from './error-dialog/error-dialog';
import { DapConfigService, DapConfig } from './dap-config.service';
import { DapSessionService, ExecutionState, VerifiedBreakpoint } from './dap-session.service';
import { DapVariablesService } from './dap-variables.service';
import { DapEvent, LogEntry } from './dap.types';
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
    MatTabsModule,
    ScrollingModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTreeModule,
    FormsModule,
    EditorComponent,
    VariablesComponent,
  ],
  providers: [
    DapSessionService,
    DapVariablesService,
  ],
  templateUrl: './debugger.component.html',
  styleUrls: ['./debugger.component.scss']
})
export class DebuggerComponent implements OnInit, OnDestroy {
  // Inject dependency services
  private readonly configService = inject(DapConfigService);
  private readonly router = inject(Router);
  private readonly dapSession = inject(DapSessionService);
  private readonly variablesService = inject(DapVariablesService);
  private readonly logService = inject(DapLogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Access the mat-tree instance for programmatic control */
  @ViewChild('tree') tree?: MatTree<FileNode>;

  /** Access the editor component for programmatic breakpoint updates */
  @ViewChild(EditorComponent) private editorComponent?: EditorComponent;

  /** Bind DAP connection status */
  public readonly connectionStatus$: Observable<boolean> = this.dapSession.connectionStatus$;

  /** Bind execution state */
  public readonly executionState$: Observable<ExecutionState> = this.dapSession.executionState$;

  private eventSubscription?: Subscription;
  private stateSubscription?: Subscription;
  private logSubscription?: Subscription;

  // ViewChildren for auto-scrolling
  @ViewChildren(CdkVirtualScrollViewport) viewports!: QueryList<CdkVirtualScrollViewport>;

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

  /** Console output logs (System/DAP) */
  public readonly consoleLogs$: Observable<LogEntry[]> = this.logService.consoleLogs$;

  /** Program output logs */
  public readonly programLogs$: Observable<LogEntry[]> = this.logService.programLogs$;

  /** Current evaluate expression input string */
  public evaluateExpression: string = '';

  /** File tree state */
  public fileDataSource: FileNode[] = [];
  public childrenAccessor = (node: FileNode) => node.children ?? [];
  public hasChild = (_: number, node: FileNode) => !!node.children && node.children.length > 0;
  public activeFilePath: string | null = null;
  public currentCode: string = '// Editor is ready.';
  public fileTreeSupported: boolean = true;

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

    // Auto-scroll when logs update
    this.logSubscription = this.consoleLogs$.subscribe(() => this.scrollToBottom());
    this.logSubscription.add(this.logService.programLogs$.subscribe(() => this.scrollToBottom()));

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
   * Collapse all expanded nodes in the file tree
   */
  public collapseAllNodes(): void {
    this.tree?.collapseAll();
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

  private loadTree(): void {
    if (!this.dapSession.capabilities?.supportsLoadedSourcesRequest) {
      this.fileTreeSupported = false;
      return;
    }
    this.fileTreeSupported = true;

    const rootPath = this.currentConfig.sourcePath || '';
    this.dapSession.fileTree.getTree(rootPath).subscribe({
      next: (rootNode) => {
        // Expand root or set children as dataSource.
        // If root is redundant, it can be skipped. Here we put children in the array.
        this.fileDataSource = rootNode.children || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Failed to load file tree', err);
      }
    });
  }

  public async onFileNodeClick(node: FileNode): Promise<void> {
    if (node.type !== 'file') return;

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
    // Internal synthetic events (prefixed with '_') are not logged as normal DAP events
    const skipLogs = ['output', 'breakpoint', 'loadedSource', '_dapError', '_transportError'];
    if (!skipLogs.includes(event.event)) {
      this.logService.consoleLog(`[Event] ${event.event}`, 'info', 'dap');
    }

    switch (event.event) {
      case 'initialized':
        this.logService.consoleLog("Configuration Done.", 'info', 'system');
        break;
      case 'stopped':
        // Safely update file tree when DA is stopped (prevents request failure during Running state)
        this.loadTree();
        this.loadCallStack(event.body?.threadId);
        break;
      case 'continued':
        this.clearExecutionState();
        break;
      case 'loadedSource':
        // Update file tree on dynamic load source event
        this.loadTree();
        break;
      case 'terminated':
        this.clearExecutionState();
        this.logService.consoleLog('Debug session terminated', 'info', 'system');
        break;
      case 'exited': {
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

        // Load the top frame to show source code by default after success
        if (this.stackFrames.length > 0) {
          this.onFrameClick(this.stackFrames[0]);
        }
        this.cdr.detectChanges();
      }
    } catch (e: any) {
      this.logService.consoleLog(`Failed to load call stack: ${e.message}`, 'error', 'system');
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
      this.logService.consoleLog(`Scopes request failed: ${e.message}`, 'error', 'system');
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
      this.logService.consoleLog(
        `Failed to sync breakpoints for ${filePath}: ${e.message}`,
        'error',
        'system'
      );
    }
  }

  /** Resume execution */
  public async onResume(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.continue();
    } catch (e: any) {
      this.logService.consoleLog(`Continue failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Pause execution */
  public async onPause(): Promise<void> {
    if (this.executionState !== 'running') return;
    try {
      await this.dapSession.pause();
    } catch (e: any) {
      this.logService.consoleLog(`Pause failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Step Over */
  public async onStepOver(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.next();
    } catch (e: any) {
      this.logService.consoleLog(`Step Over failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Step Into */
  public async onStepInto(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.stepIn();
    } catch (e: any) {
      this.logService.consoleLog(`Step Into failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Step Out */
  public async onStepOut(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.stepOut();
    } catch (e: any) {
      this.logService.consoleLog(`Step Out failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Stop debugging */
  public async onStop(): Promise<void> {
    try {
      this.logService.consoleLog('Debug session stopped by user', 'info', 'system');
      await this.dapSession.terminate();
    } catch (e: any) {
      this.logService.consoleLog(`Terminate failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Reset session (Disconnect and restart) */
  public async onRestart(): Promise<void> {
    const validStates: ExecutionState[] = ['running', 'stopped', 'terminated', 'error'];
    if (!validStates.includes(this.executionState)) return;
    try {
      await this.dapSession.disconnect();
      this.clearExecutionState();
      this.logService.consoleLog(this.executionState === 'error' ? 'Reconnecting to session...' : 'Restarting session...', 'info', 'system');
      await this.startSession();
    } catch (e: any) {
      this.logService.consoleLog(`Restart/Reconnect failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Send evaluate expression request */
  public async evaluateCommand(): Promise<void> {
    if (!this.evaluateExpression.trim() || this.executionState !== 'stopped') {
      return;
    }

    const expr = this.evaluateExpression;
    this.evaluateExpression = ''; // clear input
    this.logService.consoleLog(`> ${expr}`, 'info', 'system');

    try {
      const response = await this.dapSession.sendRequest('evaluate', {
        expression: expr,
        context: 'repl'
      });

      if (response.success && response.body) {
        this.logService.consoleLog(response.body.result, 'info', 'stdout');
      } else {
        this.logService.consoleLog(response.message || 'Evaluate failed', 'error', 'system');
      }
    } catch (e: any) {
      this.logService.consoleLog(`Evaluate failed: ${e.message}`, 'error', 'system');
    }
  }

  /** Clear UI state related to the current execution point (stacks, current line, etc.) */
  private clearExecutionState(): void {
    this.stackFrames = [];
    this.activeFrameId = null;
    this.activeLine = null;
    this.activeLineFilePath = null;
    this.cdr.detectChanges();
  }

  private scrollToBottom(): void {
    // Force scroll to bottom on the next frame
    setTimeout(() => {
      this.viewports.forEach(viewport => {
        viewport.scrollToIndex(viewport.getDataLength(), 'smooth');
      });
    }, 50);
  }

  public trackByFn(index: number, item: LogEntry): string {
    return item.timestamp.getTime() + item.message;
  }

  public ngOnDestroy(): void {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
    if (this.logSubscription) {
      this.logSubscription.unsubscribe();
    }
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
