---
name: DAP Implementation Rules
description: Mandatory protocol constraints for implementing or modifying DAP-related Services, Transport layers, and session lifecycle logic.
---

# DAP Implementation Rules

This skill contains the mandatory rules that must be followed when modifying any DAP-related code to prevent Race Conditions, Deadlocks, or architectural violations.

## 1. When to Use This Skill

You **MUST** load this skill before performing any of the following tasks:

- Modifying `DapSessionService` or its startup/shutdown logic
- Modifying any `DapTransport*` or `WebSocketTransport*` class
- Changing the DAP initialization sequence (`initialize` → `launch` → `configurationDone`)
- Adding or modifying DAP Request/Response/Event handlers
- Working with `ExecutionState` transitions
- Implementing or modifying `sendRequest` logic
- Working with `loadedSources` or source listing features

## 2. Applicable Roles

- **Lead_Engineer**: Must read before implementing any DAP-related code changes.
- **Quality_Control_Reviewer**: Must read before reviewing any DAP-related code changes.

## 3. Mandatory Reading

Before proceeding with the task, you **MUST** read the complete rules document:

📄 [`dap-protocol-specs.md`](./dap-protocol-specs.md)

The rules document contains these critical sections:

| Section | Rules | Scope |
| :--- | :--- | :--- |
| §1 Sequence Enforcement | R1–R4 | Initialization sequence and deadlock prevention |
| §2 State Machine | R5–R6 | ExecutionState transitions and request legality |
| §3 Layering | R7–R8 | No UI dependencies in service/transport layers |
| §4 Robustness | R9–R10 | Timeout handling and resource cleanup |
| §5 Source Listing | R11 | C/C++ source tree loading constraints |
| §6 Transport Extension | — | New transport type implementation steps |

## 4. Optional Reference (read only if design rationale is unclear)

- For detailed reasoning behind protocol rules: [`docs/dap-integration-faq.md`](../../../docs/dap-integration-faq.md)
- For architectural layering overview: [`docs/architecture.md`](../../../docs/architecture.md)
