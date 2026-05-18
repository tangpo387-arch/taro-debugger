---
title: VariablesComponent — Unit Spec Plan
scope: unit-test
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/ui-inspection/src/lib/variables.component.ts
related-wi: WI-124
last_updated: 2026-05-18
---

# VariablesComponent — Unit Spec Plan

## Overview

Fully isolated tests for `VariablesComponent`. Focuses on variable rendering, row interactions, hover actions, and memory inspection integration.

---

## Test Cases

### Standard Row Interaction

* **should toggle expansion when a row is left-clicked, and NOT trigger inspectMemoryRequest**
  * **Arrange:** Setup scopes with one expandable scope node.
  * **Act:** Simulate a click event on the row container.
  * **Assert:** Verify `toggleNode` is called, `inspectMemoryRequest` is NOT emitted, and the node expands or collapses as expected.

### Hover-to-Reveal Inline Actions

* **should render the memory icon button ONLY for rows with a valid memoryReference**
  * **Arrange:** Setup scopes and mock `getVariables` to return two variables: one with a valid `memoryReference` and one without.
  * **Act:** Expand the scope to render the children rows.
  * **Assert:** Query the DOM for `.row-action-btn` and verify it is only present on the row representing the variable with the `memoryReference`.

* **should emit inspectMemoryRequest when the memory icon button is clicked**
  * **Arrange:** Setup scopes and mock `getVariables` to return a variable with a valid `memoryReference`.
  * **Act:** Expand the scope and simulate a click on the `.row-action-btn` element.
  * **Assert:** Verify the `inspectMemoryRequest` EventEmitter emits the expected memory address as a BigInt.

* **should throw a UiFatalException when the memoryReference is invalid**
  * **Act:** Call `onInspectMemory` with an invalid string.
  * **Assert:** Verify it throws a `UiFatalException`.
