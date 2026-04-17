# Work Item Data Governance & Schema

> **Work Item (WI)**: The formal, atomic, and trackable unit of execution within the project. It serves as the primary artifact for planning, dependency resolution, and quality control across all project phases.

This document defines the technical structure and behavioral logic of the data-driven Work Item management system.

---

## 1. Storage Architecture

All project tasks are stored in a **JSON-first Single Source of Truth (SSOT)**. This ensures that documentation is derived from structured data, allowing for automated syncing, validation, and analytics.

- **Root Directory**: `work-items/`
- **File Organization**: Tasks are partitioned into JSON files based on their Feature Group (e.g., `editor-features.json`, `dap-transport-layer.json`).
- **File Naming**: Filenames are derived from group names in lowercase with hyphens (e.g., "Core Infrastructure" → `core-infrastructure.json`).

---

## 2. Work Item Schema

Every JSON file in the registry MUST follow this top-level structure:

```json
{
  "groupDefinition": {
    "name": "Group Name",
    "color": {
      "fill": "#hex",
      "stroke": "#hex"
    },
    "description": "Functional boundary statement."
  },
  "items": [
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
        "[Test] Unit test objective"
      ],
      "timeline": {
        "created": "YYYY-MM-DD",
        "completed": "YYYY-MM-DD"
      }
    }
  ]
}
```

### Field Definitions

#### 2.1 groupDefinition

- **`name`**: The authoritative name of the Feature Group.
- **`color.fill`** / **`color.stroke`**: Hex color strings applied as Mermaid node `fill` and `stroke` styles in `project-roadmap.md`.
- **`description`**: A mandatory one-sentence description of the group's functional scope.

#### 2.2 Work Item (item)

- **`id`**: Unique identifier. Numeric part is auto-calculated by `manage-wi.js add`.
- **`featureGroup`**: Must exactly match the `groupDefinition.name` within the same file.
- **`metadata`**: **(Mandatory Object)** Defines the lifecycle and sizing of the work item.
  - `status`: **Required**. Controls view routing (see [§3.3 View Filter Rules](#33-view-filter-rules)):
    - `pending` — Active backlog; appears in `work-items.md`.
    - `proposed` — Future roadmap; requires a `milestone` value.
    - `done` — Completed; archived in changelog, reflected in roadmap.
    - `aborted` — Terminated; treated identically to `done` in view routing.
  - `size`: **Required**. T-shirt sizing (`S`, `M`, `L`).
  - `milestone`: **Required for `proposed` status**. Target version (e.g., `v1.1`).
  - `dependencies`: **Required**. Array of WI ID strings; use `[]` if none.
- **`description`**: **Required**. High-level goal statement.
- **`details`**: **Required**. Array of tasks; must include at least one `[Test]` entry.
  - `[Test]` entries describe **verifiable test scenarios** — not implementation steps. Each entry must answer: *"What behavior should the test confirm?"*
  - Example: `"[Test] Verify debounce window resets on rapid consecutive calls"`
- **`timeline`**: **(Mandatory Object)** Tracking chronology.
  - `created`: **Required**. `YYYY-MM-DD`.
  - `completed`: **Required if status is `done` or `aborted`**. `YYYY-MM-DD`.

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

### 4.1 `manage-wi.js` (Creation & Content Management)

**Owner**: `Product_Architect`.

| Subcommand | Purpose | Triggers Sync? |
| :--- | :--- | :---: |
| `add <ID\|AUTO> <Group> <Title> [Desc] [Details] [Deps] [Size] [Milestone]` | Creates a new WI entry in an existing Feature Group. | ✅ Yes |
| `edit <WI-##> [--title <v>] [--desc <v>] [--details <v>] [--deps <v>] [--size <v>] [--milestone <v>]` | Updates specific content fields of an existing WI. | ✅ Yes |
| `show <WI-##>` | Prints the enriched JSON of a WI (includes dependency statuses) to stdout. | ❌ No |
| `add-group <Name> <Fill> <Stroke> <Description>` | Creates a new JSON file with a group definition and empty items list. | ✅ Yes |
| `show-group [Name]` | Lists all registered groups or shows a specific group's definition. | ❌ No |

- **Dependency Enrichment**: The `show` command automatically computes and appends a synthetic `_dependencyStatuses` field to the JSON output, mapping each dependency ID to its current status (e.g., `done`, `pending`, `missing`). This allows for quick bottleneck identification without manual lookups.
- **Group Validation**: `add` verifies if the `Group` exists in any `groupDefinition.name`. If not found, the script exits with an error and instructs the user to use `add-group`.
- **ID Assignment**: `AUTO` scans all items in all JSON files to find the next available ID.
- **Content Resolution**: Supports `@` prefix to read values from external text files (for `add` and `edit --details / --desc`).
- **`[Test]` Validation**: Both `add` and `edit --details` emit a warning if no `[Test]` entry is present in the details list.
- **Atomic Sync**: On `add` and `edit`, automatically invokes `generate-docs.js` for `backlog`, `roadmap`, and `future` views. The `changelog` view is excluded.

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

1. **Schema Integrity**: Adding custom fields to JSON is permitted, but they will not appear in standard Markdown reports unless the generation scripts are updated.
2. **Atomic Commits**: Always commit the JSON data changes along with the auto-generated Markdown updates.
3. **Feature Group Permanence**: Feature Groups are **never retired or deleted** — they remain in the active SSOT permanently as a record of delivered capabilities.
