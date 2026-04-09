---
name: Work Item Management
description: Managing the creation, progression, and archival of Work Items (WI) and Test Items (TI) per project standards.
---

# Work Item Management Skill

This skill defines the procedures and criteria for the `Product_Architect` and `Lead_Engineer` to manage the project's backlog and task lifecycle.

## 1. When to Use This Skill

As the **Product_Architect**, you must trigger this skill in the following scenarios:

- **New Requirement/Feature**: When a user request results in a new functional deliverable.
- **Retirement Decision**: When `Product_Architect` decides to retire a Feature Group (all work being done is a necessary precondition, not the trigger).
- **Status Alignment**: When there is a discrepancy between the codebase and the `work-items.md` tracking.
- **Progress Reporting**: When visualizing the current project dependencies and bottlenecks.

## 2. Shared Visibility (Who reads what)

- **Lead_Engineer**: May optionally read `docs/project-roadmap.md` when the WI's `depends:` metadata is insufficient to determine implementation sequence or module coupling. Not required if dependencies are clear from the WI description.
- **Quality_Control_Reviewer**: May optionally read `docs/project-roadmap.md` to identify regression boundaries when a WI impacts multiple Feature Groups.
- **Product_Architect**: Responsible for maintaining both maps to ensure accurate project trajectory tracking.

## 3. Standard Procedures

### A. Creating a New Work Item (WI) — Owner: `Product_Architect`

1. **Assign ID**: Scan `docs/project-roadmap.md` for the highest existing `WI-##` node (retired nodes are preserved there and never deleted), then increment by 1. Never reuse any ID that has appeared in the roadmap.
2. **Categorize**: Place the item under the correct **Feature Group** heading in `docs/work-items.md`.
3. **Template**: Use the mandatory HTML comment metadata for machine-readability:

   ```markdown
   ### WI-##: [Title]
   <!-- status: pending | size: S|M|L | depends: WI-##, WI-## -->
   - Status: ⏳ Pending
   ```

4. **Link Dependencies**:
   - **Atomic Map**: Add the new node and dependency edge in `docs/project-roadmap.md`.
   - **Strategic Map**: Normally no change is required in `docs/work-items.md` unless creating a fundamentally new Feature Group.

### B. Progressing to 'In-Progress' or 'Done' — Owner: `Lead_Engineer`

1. **Validation**: Before setting to `✅ Done`, ensure all associated `TI-##` (Test Items) are passing.
2. **Update Status**: Synchronize the visible `Status` field and the hidden HTML metadata.
3. **Visual Feedback**:
   - **Atomic Map** (`docs/project-roadmap.md`): Assign `stroke-width: 2.5px` (Thick Border) to the completed node.
   - **Strategic Map** (`docs/work-items.md`): Only update the Feature Group's border when **all** WIs within that group reach `✅ Done`. Do NOT update before the entire group is complete.

### C. Retiring a Feature Group — Owner: `Product_Architect`

1. **Criteria**: Ensure §6 (Completion Criteria) of `project-management.md` is met (QA review + Specs match).
2. **Design Persistence**: If the work involved architectural changes, translate them into an ADR in `docs/design-decisions.md` **before** any deletion.
3. **Purge Backlog**: Delete the entire Feature Group section (the `## Heading` + all `### WI-##` entries) from `docs/work-items.md`. Also remove the Feature Group node from the Strategic Map in `work-items.md`.
4. **Archive Atomic Map**: In `docs/project-roadmap.md`, update the retired nodes to use the archived style (`stroke-dasharray: 5`). Do **not** delete nodes — preserve dependency history for downstream traceability.

## 4. Reference Documents

- [`docs/project-management.md`](../../../docs/project-management.md): Authoritative lifecycle process and Feature Group SSOT.
- [`docs/project-roadmap.md`](../../../docs/project-roadmap.md): Atomic dependency map (SSOT for Mermaid node styles).
- [`docs/work-items.md`](../../../docs/work-items.md): Active task backlog and strategic milestone overview.
- [`docs/design-decisions.md`](../../../docs/design-decisions.md): Architecture Decision Records (ADRs) for non-obvious implementation choices.
- [`.agents/project-context.md`](../../project-context.md): Agent navigation index.
