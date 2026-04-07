---
trigger: always_on
description: Follow these coding standards to maintain consistency in the taro-debugger-frontend project.
---

# Project Code Style Guide

This document defines the development standards for the `taro-debugger-frontend` project, aiming to maintain code consistency, readability, and modern Angular best practices.

## 1. Naming Conventions

### File Naming
*   **File Name Format**: Always use `kebab-case`.
*   **Suffix Conventions**:
    *   Component: `*.component.ts`
    *   Service: `*.service.ts`
    *   Pipe: `*.pipe.ts`
    *   Directive: `*.directive.ts`
    *   Module/Config: `*.config.ts`, `*.routes.ts`
    *   Unit Test: `*.spec.ts`
    *   Type Definition: `*.types.ts`

### Class and Variable Naming
*   **Classes/Interfaces**: Use `PascalCase` (e.g., `DebuggerComponent`, `DapSessionService`).
*   **Variables and Methods**: Use `camelCase` (e.g., `executionState`, `ngOnInit()`, `startSession()`).
*   **Constants**: Use `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TIMEOUT`).
*   **Observable Variables**: Suffix with `$` (e.g., `connectionStatus$`, `executionState$`).

## 2. Angular Development Standards

### Component Structure
*   **Standalone Components**: This project uses Angular 21+ **Standalone Components**. Do not use `NgModule` to declare components.
*   **External Templates and Styles**: Component templates (`.html`) and styles (`.scss` or `.css`) must be kept separate from the `.ts` file.
*   **Dependency Injection (DI)**: Prefer the modern `inject()` function over constructor injection.
    ```typescript
    private readonly configService = inject(DapConfigService);
    private readonly router = inject(Router);
    ```

### Angular Material Tree API
*   **Forbidden Deprecated API**: Do not use `NestedTreeControl` (`@angular/cdk/tree`) or `MatTreeNestedDataSource` (`@angular/material/tree`). This API was marked deprecated in Angular Material v17+ and will be removed in v22.
*   **Use the `childrenAccessor` Pattern**: All `mat-tree` instances must use the modern `[childrenAccessor]` Input with a plain array `dataSource`, combined with the `#tree="matTree"` template reference. Do not introduce `TreeControl`.
    ```typescript
    // ✅ Correct: modern childrenAccessor pattern
    public dataSource: MyNode[] = [];
    public childrenAccessor = (node: MyNode): MyNode[] => node.children ?? [];

    // ❌ Forbidden: deprecated TreeControl pattern
    public treeControl = new NestedTreeControl<MyNode>(node => node.children);
    public dataSource = new MatTreeNestedDataSource<MyNode>();
    ```

### Services and State Management
*   **Singleton Services**: By default, services that do not manage shared state should not use `providedIn: 'root'`. Instead, provide them according to their usage context (e.g., in a component's `providers` array).
*   **Reactive State**: Use RxJS `BehaviorSubject` or `Subject` to manage shared state streams between components.

### Responsive Layout & Density (Zero-JS Architecture)
*   **CSS-First Responsive Design**: Density scaling (e.g., margins, gaps, fonts) must be handled dynamically via CSS Media Queries (`@media (max-width: 800px)`) applied to CSS Custom Properties. **Do not** manually bind `.ui-density-*` classes.
*   **TypeScript Synchronization**: When CDK components (e.g., `cdk-virtual-scroll`, `mat-tree`) require strict TypeScript geometries, inject `BreakpointObserver` from `@angular/cdk/layout` matched to `(max-width: 800px)`. **Strictly forbidden:** Using `EnvironmentDetectService.isElectron()` to calculate UI sizes or layout parameters.

### SCSS Styling Rules

> [!IMPORTANT]
> **Visual Design System Enforcement**
> The rules defined in this SCSS section, along with the visual standards established in `docs/architecture/ui-layer.md` (Section 8), are **binding architectural decisions**. They are **mandatory** for `Lead_Engineer` implementation and serve as the strict front-end acceptance criteria for the `Quality_Control_Reviewer`.

#### Typography Design Tokens

*   **Design Token Enforcement**: All UI typography (font size, weight, family) must use the CSS custom properties defined in the global `:root` (`styles.scss`). **Hardcoding font scalar sizes (e.g., `font-size: 13px`, `font-size: 0.8rem`) is strictly forbidden.**
*   **Font Family**: `var(--font-sans)` (default UI), `var(--font-mono)` (code, console, debugging panels).

##### Typography System & Density

All UI type must use the tokens defined in `styles.scss`. The following table defines the **authoritative semantic mapping** and viewport-driven density scaling.

| Token | Semantic Usage | Wide (>=800px) | Compact (<800px) |
| :--- | :--- | :--- | :--- |
| `--text-xs` | Reserved for badges, chip labels, or peripheral metadata | `0.75rem` | `0.75rem` (fixed) |
| `--text-sm` | Status bar text, log timestamps, file tree secondary labels | `0.8125rem` | `0.8125rem` (fixed) |
| **`--text-base`** | **Default body text: log content, variable values, editor UI** | **`0.875rem`** | **`0.75rem`** |
| `--text-lg` | Panel section headers (Variables, Call Stack, Explorer) | `1rem` | `1rem` (fixed) |
| `--text-xl` | Toolbar title / app branding label | `1.125rem` | `1.125rem` (fixed) |
| `--text-2xl` | Reserved for empty-state headings or modal titles | `1.375rem` | `1.375rem` (fixed) |

> [!IMPORTANT]
> All derived typographic scale tokens (`--text-sm`, `--text-lg`, etc.) are **ratio-fixed** in `styles.scss` and do **not** change per density — only `--text-base` shifts. Components that use `--text-sm` for timestamps or `--text-lg` for panel titles automatically inherit the density-appropriate visual weight by virtue of the base cascade.

##### Authoritative Weight Semantics

| Token | Value | Semantic Usage |
| :--- | :--- | :--- |
| `--weight-regular` | 400 | Code content, log body text, file names, variable values |
| `--weight-medium` | 500 | Panel section titles (Variables, Call Stack), active tab labels |
| `--weight-bold` | 700 | Critical error badges, primary CTA buttons |

> [!CAUTION]
> **`font-weight: 600` (Semi-Bold) is explicitly rejected** from this design system. It falls outside the closed three-value token set and is not permitted in any component SCSS. Panel titles that require emphasis must use `--weight-medium` (500).


#### `::ng-deep` Usage Policy

`::ng-deep` is **deprecated** in Angular and must be treated as a **last resort**, not a default solution.

**Permitted only when ALL of the following conditions are met:**
1. The target CSS class is an Angular Material internal class (e.g., `.mat-mdc-*`) with **no corresponding CSS Custom Property** exposed by the library.
2. The override is required for **structural layout** (flex growth, height propagation), not for cosmetic changes (colors, fonts, spacing).
3. Every `::ng-deep` selector **must** be prefixed with `:host &` to constrain the style penetration to the current component's subtree only.

```scss
// ✅ Correct: scoped, justified, documented
:host & ::ng-deep .mat-mdc-tab-body-wrapper {
  flex: 1;
  min-height: 0; // Required for flex shrink to work correctly
}

// ❌ Forbidden: unscoped, will leak to all instances globally
::ng-deep .mat-mdc-tab-body-wrapper {
  flex: 1;
}

// ❌ Forbidden: use for cosmetic overrides (use CSS variables instead)
:host & ::ng-deep .mat-mdc-tab-label {
  font-size: 12px;
}
```

**Preferred alternatives (in priority order):**
1. **Angular Material CSS Custom Properties** — check the component's theming API first (e.g., `--mat-tab-header-active-label-text-color`).
2. **Layout restructuring (Method D)** — if the child component is sized via `position: absolute; inset: 0`, Material internals may inherit height without `::ng-deep`.
3. **Global `styles.scss` with precise host selector** — use `app-my-component .mat-mdc-*` if the component is used in only one known context.
4. **`::ng-deep` with `:host &` scope** — only if all alternatives above are not viable.

**Mandatory comment**: Every permitted `::ng-deep` usage must include an inline comment explaining why no alternative exists:
```scss
// Material does not expose a CSS variable for .mat-mdc-tab-body-wrapper
// flex growth — ::ng-deep required to propagate height through tab internals.
:host & ::ng-deep .mat-mdc-tab-body-wrapper {
  flex: 1;
}
```


## 3. TypeScript Standards

### Strong Typing
*   **Explicit Declarations**: Public properties and methods must explicitly declare their return types or data types.
*   **Access Modifiers**: Always use explicit `public`, `private`, and `protected` modifiers. Injected services should default to `private readonly`.

### Asynchronous Handling
*   **Async/Await**: For sequential async logic (e.g., the DAP handshake flow), prefer `async/await`.
*   **RxJS**: For event streams (e.g., DAP event listeners) or state broadcasting, use `Observable`.
*   **Conversion**: To convert an Observable to a Promise, use `firstValueFrom`.

## 4. Language & Documentation

*   **Global Language Policy**:
    *   All **code comments**, **JSDoc**, and **UI display text** (text in templates) must be written in **US English**.
    *   Chinese content is forbidden in `*.ts`, `*.scss`, and `*.html` files.
*   **Comment Standards**:
    *   **Logic Explanation**: Use **US English** for complex logic descriptions to facilitate understanding by international team members.
    *   **JSDoc**: Use **English JSDoc** for public method and interface descriptions.
*   **Code Section Dividers**: For longer services or components, use a clear separator to delineate logical blocks:
    ```typescript
    // ── Session Event Handling ─────────────────────────────────────────
    ```

## 5. Formatting

*   **Indentation**: 2 spaces.
*   **Quotes**: Single quotes `'` (TypeScript/JavaScript), double quotes `"` (HTML).
*   **Semicolons**: Required `;`.
*   **Import Order**:
    1.  Angular core and built-in modules (`@angular/*`)
    2.  Third-party libraries (RxJS, Angular Material)
    3.  Local project files

## 6. RxJS Management

*   **Resource Cleanup**: In `ngOnDestroy`, always call `unsubscribe()` or use operators like `takeUntil` to prevent memory leaks.
*   **Immutability**: For arrays displayed in the UI (e.g., log records), use the spread operator `[...]` to create a new reference and trigger Angular's `OnPush` or default change detection.
    ```typescript
    this.dapLogs = [...this.dapLogs, newEntry];
    ```