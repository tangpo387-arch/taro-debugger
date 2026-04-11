---
title: Project Management Guide
scope: process, work-items, lifecycle, naming, feature-groups
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-12
related:
  - docs/work-items.md
  - docs/archive/design-decisions.md
  - docs/test-plan.md
---

# Project Management Guide

This document defines the authoritative process for managing work items in the `taro-debugger` project — from initial creation through implementation to final stabilization. All agents **must** follow this lifecycle using the project's automation scripts to ensure consistency, traceability, and a synchronized project backlog.

The project uses a **JSON-first architecture** where all task data is stored in `docs/data/work-items/`. Markdown files like `work-items.md` are auto-generated from this source. Feature Groups are **never retired or deleted** — they remain in the active SSOT permanently as a record of delivered capabilities.

## 0. Core Philosophy: Capability Delivery Map

The project implements a **Capability Delivery Map** strategy. Unlike a traditional task list that tracks individual actions (coding vs. testing), our Roadmap focuses on **atomic capabilities**:

1. **Atomic Integrity**: A feature node (`WI-##`) does not turn `✅ Done` until it is both implemented and high-coverage tested.
2. **Outcome-Oriented**: Each node on the map represents a distinct, reliable feature that can be delivered to the end-user.
3. **Reduced Visual Noise**: Technical sub-tasks (like Unit Tests) are "absorbed" into the parent Work Item, ensuring the strategic view reflects system capabilities rather than developer effort.

> [!NOTE]
> For step-by-step instructions on running management scripts (`add-wi.js`, `update-wi.js`), refer to the internal **Work Item Operational Procedures** (Agent SOP).

See [project-roadmap.md](project-roadmap.md) for the visual dependency map of all work items.

---

## 1. Naming Conventions

All trackable units of work use a two-part identifier: a **prefix** and a **two-digit numeric index**.

### 1.1 Work Items (`WI-##`)

Used for any **functional implementation task** — UI features, service logic, refactors, or infrastructure work.

| Field | Rule |
| :--- | :--- |
| **Format** | `WI-` + zero-padded two-digit number (e.g., `WI-01`, `WI-18`) |
| **Sub-tasks** | Append a decimal suffix for tightly coupled splits (e.g., `WI-18.1`, `WI-18.2`) |
| **Assignment** | Assigned by `Product_Architect` when creating or splitting a work item |
| **Uniqueness** | Numbers are never reused, even after an item is retired from `work-items.md` |

### 1.2 Traceability in Code

Every implementation or test file associated with a work item **must** include its ID in a top-level JSDoc comment:

```typescript
/**
 * WI-05 — Implement WebSocket Transport Layer
 * ref: docs/work-items.md, docs/test-plan.md §2.2
 */
```

### 1.3 Testing Tasks Policy

To maintain the **Capability Delivery Map**'s clarity, we distinguish between two types of testing activities:

#### A. Feature-driven Tests

* **Definition**: Tests added to verify **new code** being implemented for an active Work Item.
* **WI Policy**: **Do not create a separate WI**. The tests must be included within the feature's `WI-##` details. A feature is not "Done" until its tests pass.
* **Goal**: Ensure atomic integrity of new capabilities.

#### B. Quality-gap Tests

* **Definition**: Tests added to supplement coverage for **existing, already finished code** (e.g., missed edge cases, regression tests for long-stable modules).
* **WI Policy**: **Create a dedicated WI** (usually `Size: XS` or `S`).
* **Goal**: Make technical debt reduction visible on the Roadmap and track the strengthening of core stability.

---

### 1.4 Feature Groups

A **Feature Group** is a named domain category that groups related `WI-##` items by functional area. Feature Groups appear as `## Heading` sections in `docs/work-items.md`.

> [!NOTE]
> The canonical Feature Group registry (names, colors, and stabilization status) is maintained in `scripts/generate-docs.js` → `FEATURE_COLORS` and auto-rendered in [`docs/project-roadmap.md`](project-roadmap.md). New groups must be proposed by `Product_Architect` and registered in `FEATURE_COLORS` before use.

---

## 2. Work Item Lifecycle

A work item travels through the following states. Only `Product_Architect` may create or promote items; only `Lead_Engineer` may set an item to `done` or `abort`.

```text
[Proposed] → [Pending] → [Done] / [Aborted] → (Group: Stabilized 💎)
```

### 2.1 State Definitions

| State | Symbol | Location | Description |
| :--- | :--- | :--- | :--- |
| **Proposed** | 💡 | Discussion / PR comment | Idea raised; not yet formally scoped |
| **Pending** | ⏳ | `docs/work-items.md` | Scoped & approved; waiting for implementation |
| **Done** | ✅ | JSON SSOT | Implementation complete & reviewed; accessible via `node scripts/generate-docs.js changelog` |
| **Aborted** | ❌ | JSON SSOT | Task cancelled or superseded; permanently stopped |
| **Stabilized** | 💎 | Roadmap (auto) | All WIs in the group are `done`/`aborted`; roadmap style updated automatically by `generate-docs.js`. No manual action required. |

---

## 4. Related Documents

| Document | Purpose |
| :--- | :--- |
| [`docs/work-items.md`](work-items.md) | Active backlog of pending and in-progress work items |
| [`docs/archive/design-decisions.md`](design-decisions.md) | Architecture Decision Records (ADRs) for non-obvious implementation choices |
| [`docs/test-plan.md`](test-plan.md) | Detailed test strategy and TI scope definitions |
| [`docs/data/data-management-spec.md`](data/data-management-spec.md) | Technical reference for JSON schema and automation scripts |
| [`docs/system-specification.md`](system-specification.md) | Feature requirements each WI must satisfy |
| [`.agents/project-context.md`](../.agents/project-context.md) | Agent navigation index — links to this document |
