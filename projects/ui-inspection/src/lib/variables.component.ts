import { Component, ChangeDetectorRef, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Subscription } from 'rxjs';

import { DapVariablesService, DapScope } from './dap-variables.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { LAYOUT_COMPACT_MQ } from '@taro/ui-shared';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

// ── Data Model ────────────────────────────────────────────────────────

/** Hierarchical tree node (source of truth). */
export interface VariableNode {
  name: string;
  type?: string;
  value: string;
  variablesReference: number;
  children?: VariableNode[];
  expanded?: boolean;
  isLoading?: boolean;
}

/** Flattened node used by CDK virtual scroll rendering. */
export interface FlatVariableNode {
  /** Reference to the original hierarchical node. */
  source: VariableNode;
  /** Nesting depth (0 = root scope). */
  level: number;
  /** Whether this node can be expanded (has variablesReference > 0). */
  expandable: boolean;
}

/** Indentation per nesting level in pixels. */
const INDENT_PX = 20;

// ── Component ─────────────────────────────────────────────────────────

@Component({
  selector: 'app-variables',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    ScrollingModule,
  ],
  templateUrl: './variables.component.html',
  styleUrls: ['./variables.component.scss']
})
export class VariablesComponent implements OnInit, OnDestroy {
  private readonly variablesService = inject(DapVariablesService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Responsive row height for cdk-virtual-scroll itemSize */
  public rowHeight = toSignal(
    this.breakpointObserver.observe(LAYOUT_COMPACT_MQ).pipe(
      map(state => state.matches ? 24 : 32)
    ),
    { initialValue: 32 }
  );

  /** Hierarchical tree data (source of truth). */
  private treeData: VariableNode[] = [];

  /** Flattened visible nodes fed into *cdkVirtualFor. */
  public flatNodes: FlatVariableNode[] = [];

  /** Constant exposed to template for inline padding calculation. */
  public readonly INDENT_PX: number = INDENT_PX;

  private scopesSubscription?: Subscription;

  // ── Lifecycle ─────────────────────────────────────────────────────────

  public ngOnInit(): void {
    // Listen to scopes changes and rebuild the tree + flat list.
    // SSOT compliance: R_SM1 (DapVariablesService is the source of truth),
    // R_SM5 (service clears scopes automatically when execution leaves 'stopped').
    this.scopesSubscription = this.variablesService.scopes$.subscribe((scopes: DapScope[]) => {
      this.treeData = scopes.map(scope => ({
        name: scope.name,
        value: '',
        type: 'Scope',
        variablesReference: scope.variablesReference,
        expanded: false,
      }));
      this.rebuildFlatList();

      // Auto-expand the first scope (usually 'Local' or 'Locals') to show variables immediately
      if (this.flatNodes.length > 0 && this.flatNodes[0].expandable && !this.flatNodes[0].source.expanded) {
        this.toggleNode(this.flatNodes[0]).catch(e => console.error(e));
      }
    });
  }

  public ngOnDestroy(): void {
    if (this.scopesSubscription) {
      this.scopesSubscription.unsubscribe();
    }
  }

  // ── Public Template Helpers ───────────────────────────────────────────

  /** Toggle expand/collapse of a node. Lazy-loads children on first expand. */
  public async toggleNode(flatNode: FlatVariableNode): Promise<void> {
    const node = flatNode.source;

    if (node.expanded) {
      // Collapse: hide all descendants
      node.expanded = false;
      this.rebuildFlatList();
      return;
    }

    // Expand: fetch children if not yet loaded
    if (!node.children || node.children.length === 0) {
      node.isLoading = true;
      this.rebuildFlatList();

      try {
        const vars = await this.variablesService.getVariables(node.variablesReference);
        node.children = vars.map(v => ({
          name: v.name,
          value: v.value,
          type: v.type,
          variablesReference: v.variablesReference,
          expanded: false,
        }));
      } catch (e) {
        console.error('Failed to load variables', e);
        node.children = [];
      } finally {
        node.isLoading = false;
      }
    }

    node.expanded = true;
    this.rebuildFlatList();
  }

  /** TrackBy function for *cdkVirtualFor performance. */
  public trackByNode(_index: number, flatNode: FlatVariableNode): string {
    // Use a composite key of level + name + variablesReference for uniqueness
    return `${flatNode.level}:${flatNode.source.name}:${flatNode.source.variablesReference}`;
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Rebuilds the flat node list from the hierarchical tree data.
   * Only includes nodes whose ancestors are all expanded (i.e. visible nodes).
   */
  private rebuildFlatList(): void {
    const result: FlatVariableNode[] = [];
    this.flattenRecursive(this.treeData, 0, result);
    this.flatNodes = result;
    this.cdr.detectChanges();
  }

  /**
   * Recursively traverses the tree and appends visible nodes to the output list.
   */
  private flattenRecursive(nodes: VariableNode[], level: number, output: FlatVariableNode[]): void {
    for (const node of nodes) {
      output.push({
        source: node,
        level,
        expandable: node.variablesReference > 0,
      });

      // Only recurse into children if the node is expanded and has loaded children
      if (node.expanded && node.children && node.children.length > 0) {
        this.flattenRecursive(node.children, level + 1, output);
      }
    }
  }
}
