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

## 0. Core Philosophy: Capability Delivery Map

The project implements a **Capability Delivery Map** strategy. Unlike a traditional task list that tracks individual actions (coding vs. testing), our Roadmap focuses on **atomic capabilities**:

1. **Atomic Integrity**: A feature node (`WI-##`) does not turn `✅ Done` until it is both implemented and high-coverage tested.
2. **Outcome-Oriented**: Each node on the map represents a distinct, reliable feature that can be delivered to the end-user.
3. **Reduced Visual Noise**: Technical sub-tasks (like Unit Tests) are "absorbed" into the parent Work Item, ensuring the strategic view reflects system capabilities rather than developer effort.

> [!NOTE]
> For step-by-step instructions on running management scripts (`manage-wi.js`, `update-wi.js`), refer to the internal **Work Item Operational Procedures** (Agent SOP).

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

> To create, edit, or inspect Work Items, use the scripts defined in Skill: `work-item-management`.

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
> The canonical Feature Group registry—including names, colors, and descriptions—is managed via the project's data layer. New groups are established using `node scripts/manage-wi.js add-group <Name> <FillHex> <StrokeHex> <Desc>`, which initializes a new functional domain. Items within a group can be inspected using `node scripts/manage-wi.js list-group <Name>`.

---

## 2. Work Item Lifecycle

A work item travels through the following states. Only `Product_Architect` may create or promote items; only `Lead_Engineer` may set an item to `done` or `abort`.

```text
[Proposed] → [Pending] → [Done] / [Aborted] → (Group: Stabilized 💎)
```

### 2.1 State Definitions

| State | Symbol | Location | Description |
| :--- | :--- | :--- | :--- |
| **Proposed** | 💡 | JSON SSOT | Idea raised; not yet formally scoped. Roadmap entry: milestone required. |
| **Pending** | ⏳ | `docs/work-items.md` | Scoped & approved; spec written if needed; ready for implementation. |
| **Done** | ✅ | JSON SSOT | Implementation complete & reviewed; archived in changelog. |
| **Aborted** | ❌ | JSON SSOT | Task cancelled or superseded; permanently stopped. |
| **Stabilized** | 💎 | Roadmap (auto) | All WIs in the group are `done`/`aborted`; roadmap style updated automatically. |

> [!IMPORTANT]
> **Never edit `work-items.md` or `project-roadmap.md` manually.** These files are auto-generated from the JSON SSOT; manual changes will be overwritten during the next sync. Always use the generation scripts.

---

### 2.2 Specification Handoff Protocol (Product_Architect → Lead_Engineer)

**Goal**: Transfer a fully scoped Work Item from `Product_Architect` to `Lead_Engineer` for implementation.

**Prerequisites**:
* WI status is `Proposed`.
* All dependency WIs (`deps`) are `✅ Done`.

#### 2.2.1 Product_Architect Steps (Scoping & Promotion)

**Objective**: Transition a WI from `Proposed` to `Pending`.

**Steps**:
1. **Creation**: User and PA define the idea and create a `Proposed` record using `manage-wi.js add`.
2. **Review**: Verify WI record completeness: `id`, `title`, `description`, `details[]` (requires ≥1 `[Test]`), `size`, `deps`.
3. **Complexity Gate**: Evaluate if the WI meets Spec criteria. A formal specification document (`docs/*.md`) is **mandatory** if any of the following conditions are met:
   * Introduces a new architectural pattern or design rule.
   * Requires coordinating changes across ≥3 files or layers.
   * Involves non-obvious protocol constraints (e.g., async sequencing, DAP edge cases).
   * Work Item Size is **M** or above.
4. **Spec Authoring**: If the gate is passed, author the `docs/*.md` spec and link it in the WI details.
5. **Promotion**: Run `node scripts/update-wi.js WI-## pending` to authorize development.

**Verification**:
* WI status is updated to `Pending` and appears in the Active Backlog.

#### 2.2.2 Lead_Engineer Steps (Implementation Prep)

**Prerequisites**:
* WI status is `Pending`.

**Steps**:
1. Execute `node scripts/manage-wi.js show {WI-ID}` and read `details[]` and `deps`.
2. Halt execution and notify `Product_Architect` if any dependency WIs are not `✅ Done`.
3. Load all relevant Skills listed in the WI or `project-context.md`.
4. Read the spec document (`docs/{WI-ID}-spec.md`) in full if linked in the WI details.

**Verification**:
* Begin implementation only after Steps 1-4 are complete.

---

### 2.3 QCR Handoff Protocol (Lead_Engineer → Quality_Control_Reviewer)

Before any `QCR review` request can be submitted, `Lead_Engineer` **must** complete the following handoff sequence. `Quality_Control_Reviewer` **must** reject any submission that does not comply.

```text
Lead_Engineer
  1. Implement all items listed in the WI's details.
  2. Run: npm run test -- --watch=false   (all tests must pass)
  3. Produce: docs/reviews/{WI-ID}.review-package.md
        — §1 Acceptance Criteria  (copied verbatim from manage-wi.js show)
        — §2 Diff Summary         (file + line ranges only; no pasted code)
        — §3 Edge Cases           (🔍 flags for areas requiring deeper QCR inspection)
        — §4 Tests Added          (suite names + test descriptions)
        — §5 Spec-Plan Updates    (list of spec-plan files updated)
        — §6 Self-Verification    (pasted terminal output proving tests pass)
  4. Submit: "QCR review {WI-ID}"

Quality_Control_Reviewer
  1. Read docs/reviews/{WI-ID}.review-package.md  (primary input)
  2. Load only the Skills listed in `skills-required` frontmatter.
  3. Verify §1 Acceptance Criteria — read only the diff line ranges in §2.
  4. Inspect only 🔍-flagged areas in §3.
  5. Verify tests in §4 match the spec-plan entries in §5.
  6. Issue APPROVED or REJECTED with precise, actionable findings.
```

> [!NOTE]
> The full Review Package format is defined in Skill: `review-package` (`docs/reviews/{WI-ID}.review-package.md`).
> [!CAUTION]
> `Quality_Control_Reviewer` is FORBIDDEN from re-reading full source files. All required context must be sourced from the Review Package and the specific line ranges listed in its §2 Diff Summary.

---

## 3. Package Release Flow (SemVer)

The project follows strict Semantic Versioning (SemVer) using pre-release suffixes to track milestone readiness.

> [!IMPORTANT]
> * `Product_Architect` MUST explicitly state "Version bump approved" in the conversation to authorize a transition.
> * `Lead_Engineer` MUST NOT modify `package.json` until this authorization is granted.

### 3.1 Stage Definitions

| Stage | Version Pattern | Objective |
| :--- | :--- | :--- |
| **Active Development** | `X.Y.Z-dev` | Default state. Features are being implemented. |
| **Release Candidate** | `X.Y.Z-rc.N` | Feature-complete. Regression and integration testing. |
| **Formal Release** | `X.Y.Z` | Stable, production-ready build. |

### 3.2 Transition to Release Candidate (`-dev` → `-rc.1`)

**Goal**: Freeze feature development and begin integration testing.

**Prerequisites**:
* [ ] All `⏳ Pending` items in `docs/work-items.md` are `✅ Done`.
* [ ] `npm run test -- --watch=false` passes with 0 failures.

**Steps**:
1. `Lead_Engineer` verifies prerequisites and requests transition approval.
2. `Product_Architect` evaluates and outputs "Version bump approved".
3. `Lead_Engineer` updates `package.json` version to `X.Y.Z-rc.1`.

### 3.3 Transition to Formal Release (`-rc.N` → Formal Release)

**Goal**: Publish the stable build.

**Prerequisites**:
* [ ] No open regression issues.
* [ ] `electron-builder` packages verified on all target platforms.
* [ ] If a blocker is fixed during the RC phase, increment `N` (e.g., `-rc.1` → `-rc.2`) and re-verify.

**Steps**:
1. `Lead_Engineer` confirms prerequisites and requests final sign-off.
2. `Product_Architect` outputs "Version bump approved".
3. `Lead_Engineer` updates `package.json` to `X.Y.Z` (removing the `-rc.N` suffix).

---

## 4. Related Documents

| Document | Purpose |
| :--- | :--- |
| [`docs/work-items.md`](work-items.md) | Active backlog of pending and in-progress work items |
| [`docs/archive/design-decisions.md`](design-decisions.md) | Architecture Decision Records (ADRs) for non-obvious implementation choices |
| [`docs/test-plan.md`](test-plan.md) | Detailed test strategy and TI scope definitions |
| [`docs/system-specification.md`](system-specification.md) | Feature requirements each WI must satisfy |
| [`.agents/project-context.md`](../.agents/project-context.md) | Agent navigation index — links to this document |
