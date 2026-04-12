---
name: Advanced Angular Rules
description: Component structure, Material API standards, and framework-level coding practices.
---

# Advanced Angular Rules

This skill contains framework-level implementation standards for the `taro-debugger-frontend` project.

## 1. When to Use This Skill

You **MUST** load this skill before performing any of the following tasks:

- Implementing or refactoring tree structures (`mat-tree`)
- Managing long-lived RxJS subscriptions (memory leak prevention)
- Creating new Standalone Components

## 2. Applicable Roles

- **Lead_Engineer**: Must read before implementing complex Angular components.
- **Quality_Control_Reviewer**: Must read before reviewing component implementations to ensure exact adherence to modern API standards.

## 3. Mandatory Rules

### 3.1 Angular Material Tree API

- **Forbidden Deprecated API**: Do not use `NestedTreeControl` (`@angular/cdk/tree`) or `MatTreeNestedDataSource` (`@angular/material/tree`). This API was marked deprecated in Angular Material v17+ and will be removed in v22.
- **Use the `childrenAccessor` Pattern**: All `mat-tree` instances must use the modern `[childrenAccessor]` Input with a plain array `dataSource`, combined with the `#tree="matTree"` template reference. Do not introduce `TreeControl`.

    ```typescript
    // ✅ Correct: modern childrenAccessor pattern
    public dataSource: MyNode[] = [];
    public childrenAccessor = (node: MyNode): MyNode[] => node.children ?? [];

    // ❌ Forbidden: deprecated TreeControl pattern
    public treeControl = new NestedTreeControl<MyNode>(node => node.children);
    public dataSource = new MatTreeNestedDataSource<MyNode>();
    ```

### 3.2 RxJS Pattern Enforcements

- **Resource Cleanup**: In `ngOnDestroy`, always call `unsubscribe()` or use declarative operators like `takeUntilDestroyed()` (Angular v16+) or `takeUntil` to prevent memory leaks from long-lived observables.
- **Immutability for Change Detection**: For arrays or objects displayed in the UI (e.g., log records), use the spread operator `[...]` or `{...}` to create a new reference. This ensures Angular's ChangeDetectionStrategy.OnPush correctly identifies the state mutation.

    ```typescript
    this.dapLogs = [...this.dapLogs, newEntry];
    ```
