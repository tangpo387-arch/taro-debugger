---
name: Work Item Management
description: Managing the creation, progression, and archival of Work Items (WI) and Test Items (TI) per project standards.
---

# Work Item Management Skill

> [!IMPORTANT]
> **Principles & Nomenclature**: For authoritative naming conventions, lifecycle state definitions, and Feature Group mappings, refer to the project guide:
> [docs/project-management.md](../../../docs/project-management.md)

---

## 1. Operational Context

### 1.1 Trigger Conditions

As the **Product_Architect**, you must initiate these procedures when:
- **New Requirement/Feature**: A user request results in a new functional deliverable.
- **Stabilization**: A Feature Group has zero remaining `pending` items; `generate-docs.js` updates the roadmap automatically.
- **Status Alignment**: A discrepancy is detected between the codebase and the `work-items.md` tracking.
- **Progress Reporting**: Visualizing current project dependencies and bottlenecks is required.

### 1.2 Shared Visibility (Role Responsibilities)

- **Product_Architect**: Responsible for maintaining accurate mappings, executing creation scripts, and declaring Feature Group Stabilization.
- **Lead_Engineer**: May optionally read `docs/project-roadmap.md` if the WI's metadata is insufficient to determine implementation sequence. Not required if dependencies are clear.
- **Quality_Control_Reviewer**: Uses the backlog to identify regression boundaries when a WI impacts multiple Feature Groups.

---

## 2. Creating a New Work Item

**Owner**: `Product_Architect`

### Step 1 — Automated Creation

Use the `add-wi.js` script to create the task. The script will automatically assign the next available ID, validate the group, and update all derivative Markdown files.

```bash
# Usage:
# node scripts/add-wi.js AUTO "Group" "Title" "Description" "Details" "Deps" "Size"

node scripts/add-wi.js AUTO "Editor Advanced Interaction" "Search UI" "Add global search filter" "Matches regex|Case sensitive" "WI-12" "M"
```

- **AUTO**: Let the system allocate the numeric ID.
- **Group**: Must match a Feature Group defined in `project-management.md §1.4`.
- **Details**: Use `|` to separate multiple sub-tasks.
- **Deps**: Comma-separated list of dependent IDs (or `none`).

### Step 2 — Long Content Handling

If the `Description` or `Details` are too complex for a shell command, use `@` to reference a temporary file:

```bash
node scripts/add-wi.js AUTO "Core" "Refactor" "@temp_details.txt"
```

### Step 3 — Verification

After the script completes, verify that the item appears in `docs/work-items.md` and the Mermaid graph in `docs/project-roadmap.md` has been updated with the correct styles.

---

## 3. Progressing a Work Item

**Owner**: `Lead_Engineer`

Implementation status is updated via the `update-wi.js` script. **Do not** edit Markdown files manually.

| Action | Command | Result |
| :--- | :--- | :--- |
| **Complete** | `node scripts/update-wi.js WI-## done` | Moves to ✅ Done; item is archived in the JSON SSOT. |
| **Abort** | `node scripts/update-wi.js WI-## abort` | Moves to ❌ Aborted; item is archived in the JSON SSOT. |
| **Revert** | `node scripts/update-wi.js WI-## pending` | Moves back to ⏳ Pending. |

The script automatically handles timestamps and refreshes all derivative views.

## 4. Machine-Readable Archival (JSON)

- **Single Source of Truth**: The JSON repository in `docs/data/work-items/` is the **only** SSOT for task data.
- **Data Specification**: For full JSON schema details and script logic, see [data-management-spec.md](../../../docs/data/data-management-spec.md).
- **Automation First**: Never edit `work-items.md` or `project-roadmap.md` manually. Always use the generation scripts.
- **Utility**: `node scripts/generate-docs.js <type> <output_path|"-">` can be used to manually generate specific views.

---

## 6. Quick Reference

```text
Create WI/TI   →  Product_Architect runs scripts/add-wi.js
Implement      →  Lead_Engineer runs scripts/update-wi.js (done|aborted)
Review         →  Quality_Control_Reviewer approves PR
Query/Export   →  node scripts/generate-docs.js <backlog|roadmap|changelog|future> <path|"-">
```
