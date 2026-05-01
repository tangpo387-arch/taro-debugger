import { Component, ChangeDetectorRef, inject, OnInit, OnDestroy, ViewChild, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule, MatTree } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DapSessionService, DapThread, DapStackFrame, DapConfigService, ExecutionState } from '@taro/dap-core';
import { TaroEmptyStateComponent } from '@taro/ui-shared';
import { Subscription, combineLatest, BehaviorSubject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

/** 
 * Hierarchical tree node for execution context. 
 * Represents Process (Root), Thread (L2), and Stack Frame (L3).
 */
export interface ExecutionNode {
  type: 'process' | 'thread' | 'frame';
  /** Unique ID for tree state persistence and expansion tracking. */
  id: string;
  label: string;
  icon?: string;
  status?: string;
  children?: ExecutionNode[];

  // Data associations
  threadId?: number;
  isActive?: boolean;
  frame?: DapStackFrame;
  isStopped?: boolean;
  isLoading?: boolean;
  /** The specific reason this thread is paused (e.g. 'breakpoint', 'step', 'exception'). */
  stopReason?: string;
}

@Component({
  selector: 'app-thread-call-stack',
  standalone: true,
  imports: [
    CommonModule,
    MatTreeModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    TaroEmptyStateComponent
  ],
  templateUrl: './thread-call-stack.component.html',
  styleUrls: ['./thread-call-stack.component.scss']
})
export class ThreadCallStackComponent implements OnInit, OnDestroy {
  public readonly dapSession = inject(DapSessionService);
  private readonly dapConfig = inject(DapConfigService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('tree') private tree?: MatTree<ExecutionNode>;

  /** 
   * The ID of the currently selected stack frame. 
   * Passed from parent to ensure highlighting matches the Editor/Variables views.
   */
  @Input() public activeFrameId: number | null = null;

  /** Emitted when the user selects a stack frame node. */
  @Output() public frameSelected = new EventEmitter<DapStackFrame>();

  /** The hierarchical data source for the mat-tree. */
  public dataSource: ExecutionNode[] = [];

  /** Current active thread ID from the session. */
  public activeThreadId: number | null = null;

  /** Accessors for MatTree API. */
  public readonly childrenAccessor = (node: ExecutionNode): ExecutionNode[] => node.children ?? [];
  public readonly hasChild = (_: number, node: ExecutionNode): boolean => node.type !== 'frame';

  private subscription = new Subscription();
  /** 
   * Local cache for stack frames and loading state per thread to avoid redundant 
   * DAP requests and race conditions during UI rebuilds.
   */
  private frameCache = new Map<number, { frames?: ExecutionNode[], loading?: boolean }>();

  /** Triggered whenever the frame cache is updated to refresh the tree. */
  private cacheUpdate$ = new BehaviorSubject<void>(undefined);

  public ngOnInit(): void {
    // Synchronize tree structure with reactive session state
    this.subscription.add(
      combineLatest([
        this.dapSession.processInfo$,
        this.dapSession.threads$,
        this.dapSession.activeThreadId$,
        this.dapSession.stoppedThreads$,
        this.dapSession.allThreadsStopped$,
        this.dapSession.executionState$,
        this.dapSession.threadStopReasons$,
        this.cacheUpdate$
      ]).pipe(debounceTime(10)).subscribe(([processInfo, threads, activeThreadId, stoppedThreads, allThreadsStopped, execState, threadStopReasons]) => {
        this.activeThreadId = activeThreadId;
        this.updateTree(processInfo, threads, activeThreadId, stoppedThreads, allThreadsStopped, execState, threadStopReasons);
      })
    );

    // Immediate cache invalidation on execution events (not affected by debounce)
    this.subscription.add(
      this.dapSession.onEvent().subscribe(event => {
        if (event.event === 'continued' || event.event === 'stopped') {
          this.frameCache.clear();
        }
      })
    );
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * Rebuilds the hierarchical tree data from session state.
   * Preserves expansion state and auto-expands the active thread's frames.
   */
  private updateTree(
    processInfo: { name: string; systemProcessId?: number } | null,
    threads: DapThread[],
    activeThreadId: number | null,
    stoppedThreads: Set<number>,
    allThreadsStopped: boolean,
    execState: ExecutionState,
    threadStopReasons: Map<number, string>
  ): void {
    if (execState === 'idle') {
      this.dataSource = [];
      this.frameCache.clear();
      this.cdr.detectChanges();
      return;
    }

    const expandedIds = this.getExpandedIds();

    // Fallback: use executable name if process event was not received
    let processName = processInfo?.name;
    if (!processName) {
      const config = this.dapConfig.getConfig();
      if (config.executablePath) {
        processName = config.executablePath.split(/[/\\]/).pop() || 'Process';
      } else {
        processName = 'Debug Process';
      }
    }
    const processId = processInfo?.systemProcessId ? ` (PID: ${processInfo.systemProcessId})` : '';

    const rootNode: ExecutionNode = {
      type: 'process',
      id: 'process-root',
      label: `${processName}${processId}`,
      status: execState === 'stopped' ? 'Paused' : (execState.charAt(0).toUpperCase() + execState.slice(1)),
      children: threads.map(t => {
        const cache = this.frameCache.get(t.id);
        const isStopped = allThreadsStopped || stoppedThreads.has(t.id) || (execState === 'stopped' && threads.length === 1);
        const threadNode: ExecutionNode = {
          type: 'thread',
          id: `thread-${t.id}`,
          label: t.name || `Thread ${t.id}`,
          threadId: t.id,
          isActive: t.id === activeThreadId,
          isStopped: isStopped,
          stopReason: threadStopReasons.get(t.id),
          status: isStopped ? 'Paused' : 'Running',
          isLoading: cache?.loading || false,
          children: isStopped ? cache?.frames : undefined
        };
        return threadNode;
      })
    };

    this.dataSource = [rootNode];
    this.cdr.detectChanges();

    // Restore previous expansion state to maintain UX consistency during stepping
    this.restoreExpansion(expandedIds);

    // Ensure the process root is always expanded by default
    if (this.tree) {
      this.tree.expand(rootNode);
    }

    // Auto-fetch and expand frames for the active thread if it's stopped and hasn't been loaded yet
    if (activeThreadId !== null && execState === 'stopped') {
      const threadNode = rootNode.children?.find(c => c.threadId === activeThreadId);
      if (threadNode && !threadNode.children) {
        this.fetchFrames(threadNode).then(() => {
          if (this.tree && threadNode.children) {
            this.tree.expand(threadNode);
            this.cdr.detectChanges();
          }
        });
      }
    }
  }

  private getExpandedIds(): Set<string> {
    const expanded = new Set<string>();
    if (!this.tree) return expanded;

    const traverse = (nodes: ExecutionNode[]) => {
      for (const node of nodes) {
        if (this.tree!.isExpanded(node)) {
          expanded.add(node.id);
          if (node.children) traverse(node.children);
        }
      }
    };
    traverse(this.dataSource);
    return expanded;
  }

  private restoreExpansion(ids: Set<string>): void {
    if (!this.tree) return;
    const traverse = (nodes: ExecutionNode[]) => {
      for (const node of nodes) {
        if (ids.has(node.id)) {
          this.tree!.expand(node);
          if (node.children) traverse(node.children);
        }
      }
    };
    traverse(this.dataSource);
  }

  /**
   * Triggered when a thread node toggle is clicked. 
   * Fetches frames on-demand if not already cached.
   * Guard: only fetches when isStopped is true — running threads have no stack
   * frames available via DAP stackTrace and should expand without fetching.
   * If a thread resumes and re-stops, the frame cache is cleared by the 'stopped'
   * event listener, so the next expand will re-fetch correctly.
   */
  public async onToggle(node: ExecutionNode): Promise<void> {
    if (node.type === 'thread' && !node.children && node.isStopped) {
      await this.fetchFrames(node);
    }
  }

  /**
   * Fetches stack frames for a given thread via DAP and updates the local cache.
   */
  private async fetchFrames(node: ExecutionNode): Promise<void> {
    const threadId = node.threadId!;
    let cache = this.frameCache.get(threadId);

    if (cache?.loading) return;

    if (!cache) {
      cache = { loading: true };
      this.frameCache.set(threadId, cache);
    } else {
      cache.loading = true;
    }

    this.cdr.detectChanges();

    try {
      const response = await this.dapSession.stackTrace(threadId);
      if (response.success && response.body?.stackFrames) {
        cache.frames = response.body.stackFrames.map((f: DapStackFrame) => ({
          type: 'frame',
          id: `frame-${threadId}-${f.id}`,
          label: f.name,
          threadId: threadId,
          frame: f
        } as ExecutionNode));
      }
    } catch (e) {
      console.warn('ThreadCallStackComponent: Failed to fetch stack frames', e);
    } finally {
      // single canonical cleanup point — always reset loading state
      // and trigger a tree rebuild regardless of success or failure.
      if (cache) cache.loading = false;
      this.cacheUpdate$.next();
      this.cdr.detectChanges();
    }
  }

  /**
   * Handles user interaction with a tree node.
   * - Clicking a thread updates the active thread in the session.
   * - Clicking a frame emits the selection event for the parent component.
   */
  public onNodeClick(node: ExecutionNode): void {
    if (node.type === 'thread') {
      this.dapSession.setCurrentThread(node.threadId!);
    } else if (node.type === 'frame' && node.frame) {
      this.frameSelected.emit(node.frame);
    }
  }
}
