import {
  Component,
  OnChanges,
  DestroyRef,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  ViewChild,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTreeModule, MatTree } from '@angular/material/tree';

import { DapSessionService } from './dap-session.service';
import { DapConfigService } from './dap-config.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { LAYOUT_COMPACT_MQ } from './layout.config';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FileNode } from './file-tree.service';

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-file-explorer',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTreeModule,
  ],
  templateUrl: './file-explorer.component.html',
  styleUrls: ['./file-explorer.component.scss'],
})
export class FileExplorerComponent implements OnChanges {
  // ── Injected Services ────────────────────────────────────────────────────────
  private readonly dapSession = inject(DapSessionService);
  private readonly dapConfig = inject(DapConfigService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ── Inputs ────────────────────────────────────────────────────────────────────

  /**
   * The currently active file path (driven by call-stack frame-click in
   * DebuggerComponent). Used to apply the active-file highlight in the tree.
   */
  @Input() public activeFilePath: string | null = null;

  /**
   * Incrementing counter driven by DebuggerComponent:
   *  - Incremented on the **first** `stopped` DAP event to fetch the initial source tree.
   *  - Incremented on each `loadedSource` event for dynamic library loads (`dlopen`).
   * General stepping pauses do NOT increment this counter.
   * Using a counter (not boolean) guarantees two consecutive reloads are not
   * swallowed by reference-equality checks.
   */
  @Input() public reloadTrigger: number = 0;

  // ── Outputs ───────────────────────────────────────────────────────────────────

  /**
   * Emitted when the user clicks a file node. The parent DebuggerComponent
   * is responsible for issuing the DAP `source` request and updating the editor.
   */
  @Output() public fileSelected = new EventEmitter<FileNode>();

  // ── Internal State ────────────────────────────────────────────────────────────

  /** Flat-root array that the mat-tree consumes. */
  public fileDataSource: FileNode[] = [];

  /** Accessor function for the childrenAccessor-based mat-tree API. */
  public readonly childrenAccessor = (node: FileNode): FileNode[] => node.children ?? [];

  /** Predicate used by *matTreeNodeDef to identify expandable (directory) nodes. */
  public readonly hasChild = (_: number, node: FileNode): boolean =>
    !!node.children && node.children.length > 0;

  /** Gets active dynamic indent based on viewport context.
   * Responsive logic defined in UI spec §8.1. */
  public indentSize = toSignal(
    this.breakpointObserver.observe(LAYOUT_COMPACT_MQ).pipe(
      map(state => state.matches ? 8 : 16)
    ),
    { initialValue: 16 }
  );

  /** Whether the connected DAP adapter supports `loadedSources`. */
  public fileTreeSupported: boolean = true;

  /** Source path string for display in the panel header. */
  public get sourcePath(): string {
    return this.dapConfig.getConfig().sourcePath;
  }

  /** Access the mat-tree instance for programmatic collapseAll(). */
  @ViewChild('tree') private tree?: MatTree<FileNode>;

  /** Tracks the in-flight loadTree() subscription to cancel on re-entrant calls. */
  private loadTreeSub?: Subscription;

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['reloadTrigger'] && !changes['reloadTrigger'].firstChange) {
      this.loadTree();
    }
  }


  // ── Public Template Methods ───────────────────────────────────────────────────

  /**
   * Handles a node click in the tree.
   * Directory nodes are toggled by matTreeNodeToggle; file nodes emit fileSelected.
   */
  public onNodeClick(node: FileNode): void {
    if (node.type !== 'file') return;
    this.fileSelected.emit(node);
  }

  /**
   * Collapses all expanded nodes in the mat-tree.
   * Bound to the "Collapse All" button in the panel header.
   */
  public collapseAll(): void {
    this.tree?.collapseAll();
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Fetches the current file tree from the DAP adapter via `loadedSources` and
   * populates `fileDataSource`.
   *
   * Called exclusively by two trigger conditions (per R11):
   *  1. The **first** `stopped` event — to obtain the initial source tree while
   *     the target is guaranteed to be in the `stopped` state (GDB requirement).
   *  2. Each `loadedSource` event — when the target dynamically loads a new
   *     shared library (`dlopen`), the adapter forces a `stopped`, then emits
   *     `loadedSource`; the client reacts by refreshing the tree.
   *
   * Because `fileDataSource` is fully replaced on each call, this method
   * snapshots expanded directory paths **before** the replacement and restores
   * them **after** Angular re-renders to preserve the user's tree layout.
   */
  private loadTree(): void {
    if (!this.dapSession.capabilities?.supportsLoadedSourcesRequest) {
      this.fileTreeSupported = false;
      this.cdr.detectChanges();
      return;
    }
    this.fileTreeSupported = true;

    // Capture which directories the user has expanded before we replace the data.
    const expandedPaths = this.snapshotExpandedPaths();

    const rootPath = this.dapConfig.getConfig().sourcePath || '';

    // Cancel any in-flight request to prevent race conditions on rapid reloads.
    this.loadTreeSub?.unsubscribe();

    this.loadTreeSub = this.dapSession.fileTree.getTree(rootPath)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rootNode) => {
          // Unwrap the synthetic root so the tree shows direct children.
          this.fileDataSource = rootNode.children || [];
          this.cdr.detectChanges();

          // Restore previously expanded nodes after the tree re-renders.
          this.restoreExpandedPaths(expandedPaths);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.warn('FileExplorerComponent: Failed to load file tree', err);
        },
      });
  }

  /**
   * Walks the current `fileDataSource` tree and collects the `path` of every
   * directory node that is currently expanded in the mat-tree.
   */
  private snapshotExpandedPaths(): Set<string> {
    const paths = new Set<string>();
    if (!this.tree) return paths;

    const traverse = (nodes: FileNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'directory' && this.tree!.isExpanded(node)) {
          paths.add(node.path);
          if (node.children?.length) {
            traverse(node.children);
          }
        }
      }
    };

    traverse(this.fileDataSource);
    return paths;
  }

  /**
   * After `fileDataSource` has been replaced, expands any directory node
   * whose `path` exists in the provided set, restoring the user's tree layout.
   */
  private restoreExpandedPaths(paths: Set<string>): void {
    if (!this.tree || paths.size === 0) return;

    const traverse = (nodes: FileNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'directory' && paths.has(node.path)) {
          this.tree!.expand(node);
          if (node.children?.length) {
            traverse(node.children);
          }
        }
      }
    };

    traverse(this.fileDataSource);
  }
}
