---
title: State Management and SSOT Rules
scope: State Management
audience: [Lead_Engineer, Quality_Control_Reviewer]
related:
  - SKILL.md
---

# State Management and SSOT Rules

This document defines where "state" should be stored in the `taro-debugger-frontend` project. It aims to maintain a Reactive architecture and prevent AIs from introducing excessive redundant Prop passing (Prop Drilling) when modifying the UI.

## 1. Single Source of Truth (SSOT)

* **R_SM1: `DapSessionService` as the Core SSOT**
  * All "current state" regarding the DAP session (e.g., `executionState`, `connectionStatus`, `capabilities`, `stackFrames`) must be stored in the `DapSessionService`.
  * It is forbidden to manually pass copies of these core states between different Components.
* **R_SM2: Two-Way Binding Restrictions**
  * UI Components should not hold "write access" to core states, unless they trigger state transitions by calling exposed methods on `DapSessionService` (like `continue()`, `stepOver()`).

## 2. State Storage Location Breakdown

| State Type | Recommended Storage Location | Examples | Access Method |
| :--- | :--- | :--- | :--- |
| **Global/Session State** | `DapSessionService` | `executionState`, `connectionStatus` | Subscribe to Observable via `inject(DapSessionService)` |
| **Derived Session State** | `DapSessionService` or a logic-specific Service | `stackFrames`, `scopes`, `variables` | Service exposes Subject/Observable, UI uses the `async` pipe |
| **Local UI State** | `Component` class private properties | `isSidebarExpanded`, `selectedTabIndex`, `hoveredLine` | Direct binding in HTML template |
| **Input and Cache State** | `Component` | `evaluateExpression` (Input string) | `[(ngModel)]` or `FormControl` |

## 3. Reactive Access Standards

* **R_SM3: Prefer the Async Pipe**
  * In HTML templates, always prefer using `dapSession.executionState$ | async` or `dapSession.connectionStatus$ | async`.
  * Avoid manually calling `subscribe` in the Component and storing the value in a local variable, unless that state requires complex filtering or combination logic.
* **R_SM4: Forbid Redundant Parent-Child Component Props**
  * If a child component needs a global state like `executionState`, it should `inject(DapSessionService)` on its own, rather than inheriting it via `@Input()` from the parent component. This ensures system decoupling and reduces the maintenance burden of passing props through multiple layers.
* **R_SM5: State Cleanup on State Transition and Component Destruction**
  * Services that cache runtime-inspectable data (e.g., `DapVariablesService`) must automatically clear their cache whenever `executionState$` exits `stopped` (i.e., transitions to `running`, `terminated`, or `error`). This prevents stale variable data from remaining visible in the UI after a `continue` command.
  * Session-scoped state (e.g., log records) must be cleaned up during `DapSessionService.disconnect()` or when reverting to `idle` via `reset()`.
  * UI-related local Subscriptions must be cancelled within `ngOnDestroy`.
* **R_SM5.1: Component-Scoped Service Must Not Use `providedIn: 'root'`**
  * Any service registered in a component's `providers` array for lifecycle scoping
    MUST NOT declare `@Injectable({ providedIn: 'root' })`. If `providedIn: 'root'` is
    present, Angular resolves the token from the root injector and silently ignores the
    component-level registration — the intended per-component instance is never created
    and the `providers` entry has no effect.
  * **Affected services in `DebuggerComponent.providers`**: `DapSessionService`,
    `DapFileTreeService`, `DapVariablesService`, `DapLogService`, `DapAssemblyService`.
    All must use plain `@Injectable()` with no `providedIn` argument.
* **R_SM5.2: DI Scope Co-location — Downstream Dependents Must Match Scope**
  * If Service A is component-scoped (declared in `DebuggerComponent.providers`), then
    any Service B that `inject()`s Service A **must also** be declared in that same
    component's `providers` array — not as `providedIn: 'root'`.
  * **Rationale**: A root-scoped Service B receives the root injector's instance of
    Service A (whose `transport` is `undefined` because `startSession()` was never called
    on it), not the initialized component-level instance.
  * **Correct** — both services share the component injector:

    ```typescript
    // DebuggerComponent
    providers: [DapSessionService, DapFileTreeService, ...]

    // DapFileTreeService
    @Injectable() // no providedIn
    export class DapFileTreeService {
      private readonly dapSession = inject(DapSessionService); // resolves component instance
    }
    ```

  * **Wrong** — root-vs-component scope mismatch:

    ```typescript
    // DapFileTreeService
    @Injectable({ providedIn: 'root' }) // root scope → wrong injector
    export class DapFileTreeService {
      private readonly dapSession = inject(DapSessionService); // resolves unstarted root instance
    }
    ```

* **R_SM6: Use State Selectors / Derived Observables**
  * UI components must receive pre-computed data from the service layer via derived Observables or "Selectors". For example, use a `hasActiveSession$` observable directly from the service rather than manually computing `executionState === 'running'` within the template or component logic.
* **R_SM7: Immutable State Updates for Change Detection**
  * For arrays or objects displayed in the UI (e.g., log records), use the spread operator `[...]` or `{...}` to create a new reference. This ensures Angular's ChangeDetectionStrategy.OnPush correctly identifies the state mutation.
  
  ```typescript
  this.dapLogs = [...this.dapLogs, newEntry];
  ```

## 4. Notes

> Rules R_SM1–R_SM7 are defined sequentially across §1–§3. §4 contains supplementary notes only.
