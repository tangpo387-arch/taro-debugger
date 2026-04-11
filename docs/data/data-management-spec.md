# Data Management Specification

This document defines the technical structure and behavioral logic of the data-driven work item management system.

---

## 1. Storage Architecture

All project tasks are stored in a **JSON-first Single Source of Truth (SSOT)**. This ensures that documentation is derived from structured data, allowing for automated syncing, validation, and analytics.

- **Root Directory**: `docs/data/work-items/`
- **File Organization**: Tasks are partitioned into JSON files based on their Feature Group (e.g., `editor-features.json`, `dap-transport-layer.json`).
- **File Naming**: Filenames are derived from group names in lowercase with hyphens (e.g., "Core Infrastructure" → `core-infrastructure.json`).

---

## 2. Work Item Schema

Every entry in the JSON files MUST strictly follow this schema to maintain compatibility with generation scripts:

```json
{
  "id": "WI-01",
  "title": "Short Title",
  "featureGroup": "Group Name",
  "metadata": {
    "status": "pending",
    "size": "S",
    "milestone": "v1.0",
    "dependencies": ["WI-00"]
  },
  "description": "High-level goal of the item.",
  "details": [
    "Specific task or requirement 1",
    "Specific task or requirement 2",
    "[Test] Unit test objective"
  ],
  "timeline": {
    "created": "YYYY-MM-DD",
    "completed": "YYYY-MM-DD"
  }
}
```

### Field Definitions

- **`id`**: Unique identifier. Numeric part is auto-calculated by `add-wi.js`.
- **`featureGroup`**: Must exactly match the names defined in `project-management.md §1.4`.
- **`metadata.status`**: Defines the data phase of the work item. Valid values:
  - `proposed`: **Roadmap**. A long-term idea or future feature; requires a `milestone` (e.g., `v1.1`) and is filtered out of the active backlog.
  - `pending`: **Backlog**. Scoped and ready for implementation; appears in the active backlog.
  - `done`: **Completed**. Implementation verified; reflected in the Dependency Roadmap and available via on-demand changelog generation.
  - `aborted`: **Terminated**. Cancelled or superseded; reflected in the Dependency Roadmap and available via on-demand changelog generation.
- **`metadata.dependencies`**: List of IDs. If no dependencies, use an empty array `[]`.
- **`metadata.milestone`**: (Optional) Target release version (e.g., `v1.0`, `v1.1`, `Backlog`).
  - Items with `status: "proposed"` MUST include a milestone representing their future placement.
  - Generative logic in `generate-docs.js` uses this field to partition the Future Roadmap view.

---

## 3. Versioning & Filtering Rules

Data generation scripts partition JSON data into specific views based on `status` and `milestone` values.

### 3.1 Milestone Format

- **`vX.Y`**: Explicit release targets (e.g., `v1.0`, `v1.1`).
  - **Mapping**: Maps to `package.json` version `X.Y.Z` (ignores patch version `Z`).
  - Example: `1.0.0` or `1.0.5` both identify `v1.0` as the current active target.
- **`Backlog`**: Long-term items not yet assigned to a specific version.

### 3.2 Design Rationale

The mapping of `X.Y.Z` (SemVer) to `vX.Y` (Milestone) is designed for:
- **Fault Tolerance**: Patch updates (`Z`) for bugfixes do not disrupt the project's documentation scope or active backlog filtering.
- **Lifecycle Clarity**: Shifting from `1.0.x` to `1.1.0` is a deliberate architectural act that automatically migrates the project context (Roadmap items → Backlog).
- **Automation Efficiency**: Ensures deterministic filtering logic for CI/CD and AI agent task management.

### 3.3 View Filter Rules

| View | Output | Filter Logic |
| :--- | :--- | :--- |
| **Active Backlog** | `work-items.md` | `status: "pending"` AND `milestone: CURRENT_MILESTONE` |
| **Future Roadmap** | `future-roadmap.md` | `status: "proposed"` OR (`status: "pending"` AND `milestone: NOT CURRENT_MILESTONE`) |
| **Project Changelog** | *(on-demand)* | `status: "done"` OR `status: "aborted"` — generated manually |
| **Dependency Roadmap** | `project-roadmap.md` | All items; node style is derived from WI `status` and Feature Group stabilization state |

---

## 4. Script Behavior Logic

The management of the JSON files is strictly controlled by a suite of scripts in the `scripts/` directory.

### 4.1 `add-wi.js` (Creation)

- **ID Assignment**: When `AUTO` is passed as the ID, the script scans all JSON files, finds the maximum numeric ID, and assigns `max + 1`.
- **Content Resolution**: Supports the `@` prefix to read long descriptions or details from external text files.
- **Atomic Sync**: Automatically calls `generate-docs.js` for the `backlog`, `roadmap`, and `future` views upon successful write. The `changelog` view is excluded.

### 4.2 `update-wi.js` (Lifecycle)

- **Lookup**: Searches for the target ID across all JSON files in the data directory.
- **State Transition**: Updates the `status` field. If the status is set to `done` or `aborted`, it automatically appends the current date to `timeline.completed`.
- **Sync**: Triggers documentation refresh via `generate-docs.js` for the `backlog`, `roadmap`, and `future` views. The `changelog` view is **excluded** from auto-sync and must be generated on-demand.

### 4.3 `generate-docs.js` (Rendering)

- **Unified Generator**: Replaces older separate scripts. It reads the `package.json` version dynamically to assign the `CURRENT_MILESTONE`.
- **Outputs (Usage: `node scripts/generate-docs.js <viewType> <outputPath|"-">`)**:
  - `backlog`: Renders the active tasks for the `CURRENT_MILESTONE`.
  - `roadmap`: Renders the Mermaid dependency graph showing all tasks and their states. Node styles are computed as follows:
    1. **Stabilized Group** (all WIs in the group are `done` or `aborted`): every node in that group is rendered with `fill:#f1f5f9,stroke:#94a3b8,stroke-dasharray:2` (low-contrast grey) regardless of individual WI status.
    2. **Aborted WI** (group not fully stabilized): `fill:none,stroke-dasharray:5`.
    3. **Done WI** (group not fully stabilized): full feature color with `stroke:#000,stroke-width:2.5px`.
    4. **Pending WI**: full feature color with the group's default stroke.
  - `future`: Renders the future planning view, grouping items by their upcoming, non-active milestone.
  - `changelog`: Renders historical (`done` or `aborted`) tasks, grouped by feature. **On-demand only** — run manually when a historical snapshot is needed:

    ```bash
    node scripts/generate-docs.js changelog docs/CHANGELOG.md
    ```

---

## 5. Maintenance Principles

1. **Never Edit Markdown Manually**: Files like `work-items.md` and `project-roadmap.md` are read-only. Manual changes will be overwritten during the next sync.
2. **Schema Integrity**: Adding custom fields to JSON is permitted, but they will not appear in standard Markdown reports unless the generation scripts are updated.
3. **Atomic Commits**: Always commit the JSON data changes along with the auto-generated Markdown updates.
