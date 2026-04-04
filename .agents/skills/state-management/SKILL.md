---
name: State Management Rules
description: SSOT and reactive state management rules for Angular components and services in the taro-debugger-frontend project.
---

# State Management Rules

This skill contains the mandatory rules for where and how to store, access, and clean up state across Angular components and services.

## 1. When to Use This Skill

You **MUST** load this skill before performing any of the following tasks:

- Creating or modifying an Angular Component that consumes session state
- Creating or modifying a **UI-layer** Service that manages shared state (excludes Transport-layer services — those are covered by **Skill: `dap-implementation`** R8)
- Adding `@Input()` or `@Output()` bindings between parent and child components
- Working with `BehaviorSubject`, `Observable`, or `async` pipe patterns in **Components**
- Implementing `ngOnDestroy` cleanup logic

## 2. Applicable Roles

- **Lead_Engineer**: Must read before implementing component/service state changes.
- **Quality_Control_Reviewer**: Must read before reviewing component/service code.

## 3. Mandatory Reading

Before proceeding with the task, you **MUST** read the complete rules document:

📄 [`state-management.md`](./state-management.md)

The rules document contains these critical sections:

| Section | Rules | Scope |
| :--- | :--- | :--- |
| §1 SSOT | R_SM1–R_SM2 | DapSessionService as core SSOT, two-way binding restrictions |
| §2 Storage Breakdown | — | State type → recommended storage location table |
| §3 Reactive Access | R_SM3–R_SM4, R_SM6 | Async pipe, no prop drilling, derived observables |
| §4 Cleanup | R_SM5 | Service state cleanup and subscription cancellation |

## 4. Additional Context

- For ExecutionState machine definition: [`docs/architecture.md §3.2`](../../../docs/architecture.md#32-execution-state-machine)
