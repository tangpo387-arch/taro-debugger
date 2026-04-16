---
name: Advanced Angular Rules
description: Component structure, Material API standards, and framework-level coding practices.
audience: [Lead_Engineer, Quality_Control_Reviewer]
---

# Advanced Angular Rules

> [!IMPORTANT]
> **Exclusion Boundaries:** Does NOT cover Service SSOT or reactive state flows (use `state-management` skill).

## 1. When to Use This Skill

Load before any of the following tasks:

- Implementing or refactoring tree structures (`mat-tree`)
- Managing long-lived RxJS subscriptions (memory leak prevention)
- Creating new Standalone Components

## 2. Applicable Roles

- **Lead_Engineer**: Read before implementing specific components or UI layout directives.
- **Quality_Control_Reviewer**: Read before reviewing component implementations against Angular v17+ API standards.

## 3. Mandatory Rules

### 3.1 Angular Material Tree API

- **Forbidden Deprecated API**: Do not use `NestedTreeControl` (`@angular/cdk/tree`) or `MatTreeNestedDataSource` (`@angular/material/tree`). [Deprecated in Angular Material v17+, removed in v22].
- **Use the `childrenAccessor` Pattern**: All `mat-tree` instances must use the `[childrenAccessor]` Input with a plain array `dataSource`, combined with `#tree="matTree"`. Do not introduce `TreeControl`.

  ```typescript
  // ✅ Preferred
  public dataSource: MyNode[] = [];
  public childrenAccessor = (node: MyNode): MyNode[] => node.children ?? [];

  // ❌ Prohibited
  public treeControl = new NestedTreeControl<MyNode>(node => node.children);
  public dataSource = new MatTreeNestedDataSource<MyNode>();
  ```

### 3.2 RxJS Pattern Enforcements

- **Resource Cleanup**: In `ngOnDestroy`, always call `unsubscribe()` or use declarative operators like `takeUntilDestroyed()` (Angular v16+) or `takeUntil`.
- **Immutability for Change Detection**: For arrays or objects displayed in the UI, use the spread operator (`[...]` or `{...}`) to create a new reference, triggering `ChangeDetectionStrategy.OnPush`.

  ```typescript
  // ✅ Preferred
  this.dapLogs = [...this.dapLogs, newEntry];
  ```
