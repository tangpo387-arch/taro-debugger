import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
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

import { MatTreeModule } from '@angular/material/tree';

// Import child components and global configuration services
import { EditorComponent } from './editor.component';
import { ErrorDialog, ErrorDialogData } from './error-dialog/error-dialog';
import { DapConfigService, DapConfig } from './dap-config.service';
import { DapSessionService, ExecutionState } from './dap-session.service';
import { DapEvent } from './dap.types';
import { FileNode } from './file-tree.service';

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
  ],
  providers: [
    DapSessionService,
  ],
  templateUrl: './debugger.component.html',
  styleUrls: ['./debugger.component.scss']
})
export class DebuggerComponent implements OnInit, OnDestroy {
  // Inject dependency services
  private readonly configService = inject(DapConfigService);
  private readonly router = inject(Router);
  private readonly dapSession = inject(DapSessionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Bind DAP connection status */
  public readonly connectionStatus$: Observable<boolean> = this.dapSession.connectionStatus$;

  /** Bind execution state */
  public readonly executionState$: Observable<ExecutionState> = this.dapSession.executionState$;

  private eventSubscription?: Subscription;
  private stateSubscription?: Subscription;

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

  /** DAP output logs */
  public dapLogs: LogEntry[] = [];

  /** Program output logs */
  public programLogs: LogEntry[] = [];

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

  /**
   * Executed on component initialization
   * Responsible for fetching the latest configuration from DapConfigService
   */
  public async ngOnInit(): Promise<void> {
    this.currentConfig = this.configService.getConfig();

    this.appendDapLog("Start debugging session...", 'console');

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

    await this.startSession();
  }

  /**
   * Starts the DAP Session, including error handling and retry dialog
   */
  private async startSession(): Promise<void> {
    try {
      this.appendDapLog("Initializing DAP Session...", 'console');

      this.eventSubscription = this.dapSession.onEvent().subscribe((event) => {
        this.handleDapEvent(event);
      });

      await this.dapSession.startSession();

      this.appendDapLog(`Session started in ${this.currentConfig.launchMode} mode.`, 'console');
    } catch (error: any) {
      // 1. Clean up problematic session
      this.dapSession.disconnect();

      const msg = error?.message || 'Unknown error';
      this.appendDapLog(`[Error] Session failed: ${msg}`, 'stderr');

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
          this.appendDapLog("Retrying session...", 'console');
          this.startSession(); // Retry
        } else {
          // 'goback' or other close action
          this.goBack();
        }
      });
    }
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
    const skipLogs = ['output', 'breakpoint', 'loadedSource'];
    if (!skipLogs.includes(event.event)) {
      this.appendDapLog(`[Event] ${event.event}`, 'console');
    }

    switch (event.event) {
      case 'initialized':
        this.appendDapLog("Configuration Done.", 'console');
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
      case 'exited':
        this.clearExecutionState();
        this.snackBar.open('Debug session terminated', 'OK', { duration: 3000 });
        break;
      case 'output':
        if (event.body) {
          const body = event.body as any;
          const outMsg = body.output;
          const category = body.category || 'console';
          if (category === 'stdout' || category === 'stderr') {
            this.appendProgramLog(outMsg, category);
          } else {
            this.appendDapLog(outMsg, category);
          }
        }
        break;
      case 'breakpoint':
        // TODO: Update UI breakpoint state
        break;
    }
  }

  /** Load call stack */
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
      this.appendDapLog(`[Error] Failed to load call stack: ${e.message}`, 'stderr');
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

    // Trigger scope request (background) and log results
    this.dapSession.scopes(frame.id).then(res => {
      // Log scope update for debugging purposes
      this.appendDapLog(`Scopes updated for frame: ${frame.name}.`, 'console');
    }).catch(e => {
      this.appendDapLog(`[Error] Scopes request failed: ${e.message}`, 'stderr');
    });

    this.cdr.detectChanges();
  }

  /** Resume execution */
  public async onResume(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.continue();
    } catch (e: any) {
      this.appendDapLog(`[Error] Continue failed: ${e.message}`, 'stderr');
    }
  }

  /** Pause execution */
  public async onPause(): Promise<void> {
    if (this.executionState !== 'running') return;
    try {
      await this.dapSession.pause();
    } catch (e: any) {
      this.appendDapLog(`[Error] Pause failed: ${e.message}`, 'stderr');
    }
  }

  /** Step Over */
  public async onStepOver(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.next();
    } catch (e: any) {
      this.appendDapLog(`[Error] Step Over failed: ${e.message}`, 'stderr');
    }
  }

  /** Step Into */
  public async onStepInto(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.stepIn();
    } catch (e: any) {
      this.appendDapLog(`[Error] Step Into failed: ${e.message}`, 'stderr');
    }
  }

  /** Step Out */
  public async onStepOut(): Promise<void> {
    if (this.executionState !== 'stopped') return;
    try {
      await this.dapSession.stepOut();
    } catch (e: any) {
      this.appendDapLog(`[Error] Step Out failed: ${e.message}`, 'stderr');
    }
  }

  /** Stop debugging */
  public async onStop(): Promise<void> {
    try {
      await this.dapSession.disconnect();
      this.snackBar.open('Session stopped', 'OK', { duration: 2000 });
    } catch (e: any) {
      this.appendDapLog(`[Error] Stop failed: ${e.message}`, 'stderr');
    }
  }

  /** Send evaluate expression request */
  public async evaluateCommand(): Promise<void> {
    if (!this.evaluateExpression.trim() || this.executionState !== 'stopped') {
      return;
    }

    const expr = this.evaluateExpression;
    this.evaluateExpression = ''; // clear input
    this.appendDapLog(`> ${expr}`, 'console');

    try {
      const response = await this.dapSession.sendRequest('evaluate', {
        expression: expr,
        context: 'repl'
      });

      if (response.success && response.body) {
        this.appendDapLog(response.body.result, 'stdout');
      } else {
        this.appendDapLog(response.message || 'Evaluate failed', 'stderr');
      }
    } catch (e: any) {
      this.appendDapLog(`[Error] ${e.message}`, 'stderr');
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

  private appendDapLog(message: string, category: string = 'console'): void {
    if (!message) return;
    const cleanMsg = message.endsWith('\n') ? message.slice(0, -1) : message;

    // Immutable update: create new reference to trigger change detection
    this.dapLogs = [...this.dapLogs, {
      timestamp: new Date(),
      message: cleanMsg,
      category
    }];
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private appendProgramLog(message: string, category: string = 'console'): void {
    if (!message) return;
    const cleanMsg = message.endsWith('\n') ? message.slice(0, -1) : message;

    // Immutable update
    this.programLogs = [...this.programLogs, {
      timestamp: new Date(),
      message: cleanMsg,
      category
    }];
    this.cdr.detectChanges();
    this.scrollToBottom();
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

export interface LogEntry {
  timestamp: Date;
  message: string;
  category: string;
}