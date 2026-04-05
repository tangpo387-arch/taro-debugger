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
  * Services that are registered in a component's `providers` array for lifecycle scoping
    (e.g., `DapSessionService`, `DapVariablesService`, `DapLogService` in `DebuggerComponent`)
    MUST NOT declare `@Injectable({ providedIn: 'root' })`. Violating this causes the
    Angular DI container to ignore the component-level registration entirely, making the
    lifecycle scoping rule ineffective.
* **R_SM6: Use State Selectors / Derived Observables**
  * UI components must receive pre-computed data from the service layer via derived Observables or "Selectors". For example, use a `hasActiveSession$` observable directly from the service rather than manually computing `executionState === 'running'` within the template or component logic.

## 4. Notes

> Rules R_SM1–R_SM6 are defined sequentially across §1–§3. §4 contains supplementary notes only.
