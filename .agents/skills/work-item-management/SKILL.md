---
name: Work Item Management
description: Managing the creation, progression, and archival of Work Items (WI) per project standards.
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

## 2. Managing Feature Groups

**Owner**: `Product_Architect`

Feature Groups represent domain-specific functional boundaries. You must create the group before adding Work Items to it.

### 2.1 Create a Group

Use `manage-wi.js add-group` to initialize a new functional boundary.

```bash
# Usage:
# node scripts/manage-wi.js add-group <Name> <FillHex> <StrokeHex> <Description>

node scripts/manage-wi.js add-group "Network Layer" "#4ade80" "#22c55e" "Handles API calls and socket events"
```

### 2.2 List/Inspect Groups

Use `manage-wi.js show-group` to see all registered groups or inspect a specific one.

```bash
# List all groups
node scripts/manage-wi.js show-group

# Show specific group details
node scripts/manage-wi.js show-group "Network Layer"
```

---

## 3. Creating a New Work Item

**Owner**: `Product_Architect`

### Step 1 — Create

Use `manage-wi.js add` to create the task. The script auto-assigns the next ID, validates the group, and syncs all derivative Markdown files.

```bash
# Usage:
# node scripts/manage-wi.js add <ID|AUTO> <Group> <Title> [Desc] [Details] [Deps] [Size] [Milestone]

node scripts/manage-wi.js add AUTO "Editor Advanced Interaction" "Search UI" "Add global search filter" "Matches regex|Case sensitive|[Test] Confirm regex flag toggles filter correctly" "WI-12" "M"
```

- **AUTO**: Let the system allocate the numeric ID.
- **Group**: Must match an existing Feature Group name. Use `show-group` to list available names or `add-group` to create a new one if needed.
- **Details**: Use `|` to separate multiple sub-tasks. **Must include at least one `[Test]` entry** describing a verifiable test scenario (e.g., `[Test] Confirm X behavior when Y occurs`). See `wi-data-governance.md §2` for the full rule.
- **Deps**: Comma-separated list of dependent IDs (or `none`).

### Step 2 — Long Content Handling

If the `Description` or `Details` are too complex for a shell command, use `@` to reference a temporary file:

```bash
node scripts/manage-wi.js add AUTO "Core" "Refactor" "Short desc" "@temp_details.txt"
```

### Step 3 — Edit an Existing Work Item

To modify content fields of an existing WI (title, description, details, dependencies, size, or milestone), use `manage-wi.js edit`. Only the fields specified via flags are updated.

```bash
# Update a single field
node scripts/manage-wi.js edit WI-38 --title "Revised Title"

# Update multiple fields at once
node scripts/manage-wi.js edit WI-38 --desc "New description" --deps "WI-30,WI-31"

# Replace details list (must still include a [Test] entry)
node scripts/manage-wi.js edit WI-38 --details "Task A|Task B|[Test] Verify debounce resets on rapid calls"

# Load long details from a temp file
node scripts/manage-wi.js edit WI-38 --details "@temp_details.txt"
```

Available flags: `--title`, `--desc`, `--details`, `--deps`, `--size`, `--milestone`.

> [!NOTE]
> Status lifecycle (`pending` → `done` / `aborted`) is **not** managed here.
> Use `update-wi.js` (owned by `Lead_Engineer`) for status transitions.

### Step 4 — Inspect a Work Item

Use `manage-wi.js show` to print the full details of a single WI to stdout before editing or referencing it.

```bash
node scripts/manage-wi.js show WI-38

# Pipe to jq for field-level inspection
node scripts/manage-wi.js show WI-38 | jq .details
```

### Step 5 — Verification

After any `add` or `edit`, verify that the item appears correctly in `docs/work-items.md` and the Mermaid graph in `docs/project-roadmap.md` has been updated.

---

## 3. Progressing a Work Item

**Owner**: `Lead_Engineer`

Implementation status is updated via the `update-wi.js` script. **Do not** edit Markdown files manually.

| Action | Command | Result |
| :--- | :--- | :--- |
| **Complete** | `node scripts/update-wi.js WI-## done` | Moves to ✅ Done; item is archived in the SSOT. |
| **Abort** | `node scripts/update-wi.js WI-## abort` | Moves to ❌ Aborted; item is archived in the SSOT. |
| **Revert** | `node scripts/update-wi.js WI-## pending` | Moves back to ⏳ Pending. |

The script automatically handles timestamps and refreshes all derivative views.

## 4. Machine-Readable Archival

- **Single Source of Truth**: All Work Item records are governed by a centralized SSOT. Markdown views are derived artifacts — never edit them directly.
- **Governance Reference**: For the authoritative schema, lifecycle rules, and script contracts, see [Work Item Data Governance & Schema](references/wi-data-governance.md).
- **Automation First**: Never edit `work-items.md` or `project-roadmap.md` manually. Always use the generation scripts.
- **Utility**: `node scripts/generate-docs.js <type> <output_path|"-">` can be used to manually generate specific views.

---

## 6. Quick Reference

```text
Create Group   →  Product_Architect: node scripts/manage-wi.js add-group "Name" "Fill" "Stroke" "Desc"
Show Groups    →  Product_Architect: node scripts/manage-wi.js show-group [Name]
Create WI      →  Product_Architect: node scripts/manage-wi.js add AUTO "Group" "Title" ...
Edit WI        →  Product_Architect: node scripts/manage-wi.js edit WI-## --field "value"
Inspect WI     →  Product_Architect: node scripts/manage-wi.js show WI-##
Status update  →  Lead_Engineer:     node scripts/update-wi.js WI-## <done|abort|pending>
Review         →  Quality_Control_Reviewer approves PR
Query/Export   →  node scripts/generate-docs.js <backlog|roadmap|changelog|future> <path|"-">
```
