---
title: Project Management Guide
scope: process, work-items, lifecycle, naming, changelog
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-02
related:
  - docs/work-items.md
  - docs/changelog.md
  - docs/test-plan.md
---

# Project Management Guide

This document defines the authoritative process for managing work items in the `taro-debugger` project — from initial creation through implementation to final archival. All agents **must** follow this lifecycle to ensure consistency, traceability, and a clean project backlog.

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
| **Uniqueness** | Numbers are never reused, even after an item is archived to `changelog.md` |

### 1.2 Test Items (`TI-##`)

Used for any **automated test task** — unit tests, integration tests, or E2E test suites.

| Field | Rule |
| :--- | :--- |
| **Format** | `TI-` + zero-padded two-digit number (e.g., `TI-01`, `TI-05`) |
| **Relationship** | Each `TI` must reference one or more `WI` IDs in its `depends` field |
| **Uniqueness** | Numbers are never reused |

### 1.3 Traceability in Code

Every implementation or test file associated with a work item **must** include its ID in a top-level JSDoc comment:

```typescript
/**
 * TI-05 — Connection Error & Intent Detection Integration Tests
 * ref: docs/work-items.md, docs/test-plan.md §2.2
 */
```

---

## 2. Work Item Lifecycle

A work item travels through the following states. Only `Product_Architect` may create or promote items; only `Lead_Engineer` may set an item to `in-progress` or `done`.

```text
[Proposed] → [Pending] → [In Progress] → [Done] → [Archived]
```

### 2.1 State Definitions

| State | Symbol | Location | Description |
| :--- | :---: | :--- | :--- |
| **Proposed** | 💡 | Discussion / PR comment | Idea raised; not yet formally scoped |
| **Pending** | ⏳ | `docs/work-items.md` | Scoped & approved by `Product_Architect`; waiting for implementation |
| **In Progress** | 🔄 | `docs/work-items.md` | Actively being implemented by `Lead_Engineer` |
| **Done** | ✅ | `docs/work-items.md` → `docs/changelog.md` | Implementation complete & reviewed; ready for archival |
| **Archived** | 📦 | `docs/changelog.md` | Moved out of active backlog; full record preserved |

---

## 3. Creating a New Work Item

**Owner**: `Product_Architect`

### Step 1 — Assign an ID

Determine the next available `WI-##` or `TI-##` number by checking the highest existing ID across **both** `work-items.md` and `changelog.md` (archived items retain their IDs).

### Step 2 — Write the entry in `docs/work-items.md`

Add the item under its corresponding Phase section using the standard template:

```markdown
### WI-XX: [Short Descriptive Title]
<!-- status: pending | size: S|M|L | phase: N | depends: WI-YY, WI-ZZ -->
- **Size**: S / M / L
- **Description**: One-sentence summary of what this item delivers.
- **Details**:
  - Specific sub-task or acceptance criterion 1
  - Specific sub-task or acceptance criterion 2
- **Dependencies**: WI-YY (or `none`)
- **Status**: ⏳ Pending
```

> [!IMPORTANT]
> The HTML comment `<!-- status: ... -->` on the second line is machine-readable metadata. Always keep it in sync with the visible `**Status**` field.

### Step 3 — Update the Phase Navigation table

Update the summary table at the top of `work-items.md` to reflect the new item's phase status if required.

---

## 4. Progressing a Work Item

**Owner**: `Lead_Engineer`

| Action | Required Update |
| :--- | :--- |
| Starting an item | Change `Status` field and HTML comment to `in-progress` / `🔄 In Progress` |
| Completing an item | Change `Status` field and HTML comment to `done` / `✅ Done` |
| Blocked by a dependency | Add a note under `**Details**` explaining the blocker; do NOT change status |

---

## 5. Archiving a Completed Work Item (Done → Archived)

When a Phase is fully complete (all its `WI-##` items are `✅ Done`), `Product_Architect` initiates archival.

### Step 1 — Move the Phase block to `docs/changelog.md`

Cut the entire Phase section (heading + all `### WI-##` entries) from `docs/work-items.md` and paste it at the **bottom** of `docs/changelog.md`, preserving all content verbatim.

### Step 2 — Update the Phase Navigation table in `work-items.md`

Change the Phase row's **Status** column from `⏳ Pending` to `✅ Done` and update the **Quick Link** to point to `changelog.md#phase-N-slug` instead of the inline anchor.

```markdown
| **Phase N** | ✅ Done | [Phase objective description] | [View](changelog.md#phase-n-slug) |
```

### Step 3 — Update `changelog.md` front-matter

Update the `last_updated` date in `changelog.md`'s YAML front-matter to the archival date.

### Step 4 — Verify cross-references

Ensure no other document (e.g., `test-plan.md`, `architecture.md`) contains a broken link to the archived items' old anchor in `work-items.md`.

> [!NOTE]
> Individual `TI-##` items follow the same archival flow and are moved alongside the Phase they belong to, even if their Phase number differs from the `WI-##` items in the same block.

---

## 6. Phase Completion Criteria

A Phase is considered complete and eligible for archival only when **all** of the following conditions are met:

- [ ] All `WI-##` items within the Phase have `Status: ✅ Done`.
- [ ] All associated `TI-##` items (if any) have `Status: ✅ Done` and all tests pass (`npm run test -- --watch=false`).
- [ ] `Quality_Control_Reviewer` has reviewed all implementation files for the Phase and raised no blocking issues.
- [ ] `Product_Architect` has confirmed the deliverable matches the corresponding section in `docs/system-specification.md`.

---

## 7. Quick Reference

```text
Create WI/TI   →  Product_Architect adds to work-items.md
Implement      →  Lead_Engineer sets status to In Progress
Complete       →  Lead_Engineer sets status to Done
Review         →  Quality_Control_Reviewer approves
Archive        →  Product_Architect moves Phase to changelog.md
               →  Updates work-items.md navigation table
```

---

## 8. Related Documents

| Document | Purpose |
| :--- | :--- |
| [`docs/work-items.md`](work-items.md) | Active backlog of pending and in-progress work items |
| [`docs/changelog.md`](changelog.md) | Archive of all completed phases and work items |
| [`docs/test-plan.md`](test-plan.md) | Detailed test strategy and TI scope definitions |
| [`docs/system-specification.md`](system-specification.md) | Feature requirements each WI must satisfy |
| [`.agents/project-context.md`](../.agents/project-context.md) | Agent navigation index — links to this document |
