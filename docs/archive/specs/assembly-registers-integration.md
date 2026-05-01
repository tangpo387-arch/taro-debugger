---
title: Specification - Integrated Assembly & Register View
scope: architecture, ui-layer, low-level-inspection
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer, Human Engineer]
last_updated: 2026-05-01
related:
  - assembly-view-spec.md
  - memory-view-spec.md
---

# Specification: Integrated Assembly & Register View

## 1. Purpose

Consolidate the Assembly Instruction View and CPU Register analysis into a single, high-density dashboard to reduce context switching and improve the efficiency of instruction-level debugging.

## 2. Scope

- **In-Scope**: Refactoring `AssemblyViewComponent`, implementing `DapRegisterService`, and creating `AssemblyRegisterPanelComponent`.
- **Exclusions**: Does not include modifying the generic Variables tree or the main Editor view.

## 3. Behavioral Requirements

### 3.1 Layout Integration

- The `AssemblyViewComponent` MUST host a resizable split-pane layout using `taro-panel-group`.
- The **Main Panel** (Left/Center) displays the instruction list.
- The **Context Panel** (Right) displays the CPU Registers.
- The user MUST be able to toggle the Context Panel's visibility via a toolbar button.

### 3.2 Data Synchronization

- Registers MUST be fetched automatically whenever the thread enters a `stopped` state and the Assembly View is active.
- The UI MUST identify and highlight register values that have changed since the previous `stopped` event.

### 3.3 Register Presentation

- Registers MUST be grouped by functional categories (GPRs, Flags, Special).
- Each register row MUST display:
  - Register Name (e.g., `rax`).
  - Hexadecimal Value (e.g., `0x0000000000000041`).
- Changed values MUST be rendered with a distinct visual indicator (e.g., amber text/border).

## 4. Architectural Integration

### 4.1 Session Layer (`DapRegisterService`)

- A new service provided at the `DebuggerComponent` level.
- **Responsibility**:
  - Subscribe to `dapSession.executionState$`.
  - On `stopped`, fetch the "Registers" scope via `scopes` and `variables` requests.
  - Maintain a `previousState` buffer to compute diffs.
  - Expose `registers$: Observable<RegisterState[]>`.

### 4.2 UI Layer (`AssemblyRegisterPanelComponent`)

- A standalone component inside the `ui-assembly` library.
- **Responsibility**:
  - Render the list of registers.
  - Apply conditional styling based on mutation state.

## 5. Acceptance Criteria

- [ ] **WI-107**: `DapRegisterService` correctly fetches the "Registers" scope and computes diffs on each step.
- [ ] **WI-108**: `AssemblyRegisterPanelComponent` renders registers with glowing highlights for changed values.
- [ ] **WI-109**: `AssemblyViewComponent` correctly implements the resizable split-pane and toggle logic.
- [ ] **Self-Verification**: Integration test confirms that stepping an instruction updates both the IP highlight and the register values simultaneously.

---
> [Diagram: Assembly View Dashboard Layout — Instruction List on left, Register List on right, resizable divider in between.]
