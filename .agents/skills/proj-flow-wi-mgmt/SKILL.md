---
name: "[PROJ:FLOW] Work Item Management"
description: Managing the creation, progression, and archival of Work Items (WI) per project standards.
---

# Work Item Management Skill

> [!IMPORTANT]
> **Principles & Nomenclature**: For authoritative naming conventions, lifecycle state definitions, and Feature Group mappings, refer to the project guide:
> [docs/project-management.md](../../../docs/project-management.md)
> [docs/doc-guard-protocol-spec.md](../../../docs/doc-guard-protocol-spec.md)
> [resources/doc-guard-guidelines.md](resources/doc-guard-guidelines.md)

---

## 0. Context Management & Efficiency

> [!CAUTION]
> **Context Protection Rule**: You are STRICTLY FORBIDDEN from reading `references/wi-data-governance.md` for routine CLI operations (add, edit, update).
> You MUST only load the governance reference if your task involves:
> 1. Modifying the underlying JSON schema.
> 2. Debugging or extending the logic within the `scripts/` directory.
> 3. Resolving a data corruption issue in the SSOT.

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

### 3.1 Content Standards

Before creating or editing a Work Item, you MUST adhere to the following content definitions:

<constraints>

- **Title**: MUST be concise and outcome-oriented. It MUST represent a distinct capability rather than a developer action. It MUST conceptually align with one of six types: `feature`, `refactor`, `doc update`, `bug`, `chore`, or `test`.
- **Description**: MUST be a single, high-level goal statement defining the functional deliverable.
- **Details**: MUST be a list of specific tasks.
  - You MUST include at least one `[Test]` entry describing a verifiable test scenario.
  - You MUST include a `[Doc]` entry (e.g., `[Doc] docs/archive/specs/feature-spec.md`) if the item size is `M` or above, or if it triggers the Complexity Gate.
- **Size**: MUST be `S`, `M`, or `L`.
- **Dependencies (`deps`)**: MUST list IDs of items that must be `✅ Accepted` before this one can start.

</constraints>

### Step 1 — Create

Use `manage-wi.js add` to create the task. The script auto-assigns the next ID, validates the group, and syncs all derivative Markdown files.

> [!TIP]
> **Delegated Authorization**: While `Product_Architect` remains the primary owner for requirements, `Lead_Engineer` is authorized to use this subcommand to self-initiate **Technical WIs** (e.g., refactoring, performance optimization, and architectural alignment).

```bash
# Usage:
# node scripts/manage-wi.js add <ID|AUTO> <Group> <Title> [Desc] [Details] [Deps] [Size] [Milestone]

node scripts/manage-wi.js add AUTO "Editor Advanced Interaction" "Search UI" "Add global search filter" "Matches regex|Case sensitive|[Test] Confirm regex flag toggles filter correctly" "WI-12" "M"
```

- **AUTO**: Let the system allocate the numeric ID.
- **Group**: Must match an existing Feature Group name. Use `show-group` to list available names or `add-group` to create a new one if needed.
- **Details**: Use `|` to separate multiple sub-tasks (see §3.1 Content Standards for formatting rules).
- **Deps**: Comma-separated list of dependent IDs (or `none`).

### Step 2 — Long Content Handling

If the `Description` or `Details` are too complex for a shell command, use `@` to reference a temporary file:

```bash
node scripts/manage-wi.js add AUTO "Core" "Refactor" "Short desc" "@temp_details.txt"
```

### Step 3 — Edit an Existing Work Item

Use `manage-wi.js edit` to update content fields. Only the fields specified via flags are changed.

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
> Status lifecycle (for example, `pending` → `done`) is **not** managed here.
> Use `update-wi.js` for status transitions.

### Step 4 — Inspect a Work Item

Use `manage-wi.js show` to print the full details of a single WI to stdout before editing or referencing it.

```bash
node scripts/manage-wi.js show WI-38

# Filter for a specific field (e.g. details, status, deps)
node scripts/manage-wi.js show WI-38 details
```

### Step 5 — Verification

After any `add` or `edit`, verify that the item appears correctly in `docs/work-items.md` and the Mermaid graph in `docs/project-roadmap.md` has been updated.

---

## 4. Progressing a Work Item

**Owner**: `Product_Architect`, `Lead_Engineer`, `Quality_Control_Reviewer`

Implementation status is updated via the `update-wi.js` script. You are STRICTLY FORBIDDEN from editing Markdown files manually.

| Action | Command | Result | Owner |
| :--- | :--- | :--- | :--- |
| **Commit** | `node scripts/update-wi.js WI-## pending` | Moves to ⏳ Pending | `Product_Architect` |
| **Submit** | `node scripts/update-wi.js WI-## done` | Moves to 🔍 Done | `Lead_Engineer` |
| **Approve** | `node scripts/update-wi.js WI-## accepted` | Moves to ✅ Accepted | `Quality_Control_Reviewer` |
| **Reject** | `node scripts/update-wi.js WI-## rework` | Moves to 🛠️ Rework | `Quality_Control_Reviewer` |
| **Abort** | `node scripts/update-wi.js WI-## abort` | Moves to ❌ Aborted | All Agents |
| **Propose** | `node scripts/update-wi.js WI-## proposed` | Moves to 💡 Proposed | `Product_Architect` |

> [!CAUTION]
> **Strict State Transition Constraint**: For ALL major Work Item transitions (`proposed` -> `pending`, `pending` -> `done`, and `done` -> `accepted`/`rework`), you (the AI model) are STRICTLY FORBIDDEN from executing `update-wi.js` autonomously.
> You MUST NOT proactively ask the user "Should I proceed to the next stage?" or propose a stage change. Instead, when finishing your current tasks, simply ask if the user has any further instructions.
> ONLY transition the state if the user explicitly commands it (e.g., "proceed to next stage").

The script automatically handles timestamps for `accepted` and `aborted` statuses and refreshes all derivative views.

---

## 5. Machine-Readable Archival

- **Single Source of Truth**: All Work Item records are governed by a centralized SSOT. Markdown views are derived artifacts — never edit them directly.
- **Governance Reference**: For the authoritative schema, lifecycle rules, and script contracts, see [Work Item Data Governance & Schema](references/wi-data-governance.md).
- **Utility**: `node scripts/generate-docs.js <type> <output_path|"-">` generates specific views on-demand.

> [!IMPORTANT]
> **Exclusion Boundaries**: This skill covers the following operations only: WI creation, content editing, status progression, and Feature Group management (create and inspect).
> - Do not use this skill to modify Mermaid rendering logic — see `generate-docs.js`.
> - Do not use this skill to alter the SSOT schema structure — see `wi-data-governance.md`.

---

## 6. End-to-End Work Item Handoff Flow

> [!NOTE]
> The authoritative sequence logic and Phase definitions are stored in `docs/project-management.md`. The steps below strictly define the **CLI operational constraints** for Agents executing these phases.

### 6.1 Phase 1: Scoping & Promotion (Product_Architect)

**Goal**: Transition a WI from `Proposed` to `Pending`.

**Steps**:
1. **Creation**: User and PA define the idea and create a `Proposed` record using `manage-wi.js add`.
2. **Review**: Verify WI record completeness against §3.1 Content Standards.
3. **Complexity Gate**: Evaluate the Complexity Gate. If the WI meets ANY of the following conditions:
   - Introduces a new architectural pattern or design rule.
   - Requires coordinating changes across ≥3 files or layers.
   - Involves non-obvious protocol constraints (e.g., async sequencing, DAP edge cases).
   - Size is `M` or above.

   **Then you MUST**:
   - Initialize a spec document using `node scripts/doc-guard.js init-spec <WI-ID> feature [Filename]`. Reference [resources/doc-guard-guidelines.md](resources/doc-guard-guidelines.md) for template details.
   - Complete the generated template under `docs/archive/specs/` (name based on kebab-case).
   - Update related project documents to reflect the new design.

<critical_instruction>

**Link the Spec**: You MUST append the spec document link to the WI details (e.g., `|[Doc] docs/archive/specs/feature-spec.md`). Use `manage-wi.js show <WI-ID>` to read existing details, then `manage-wi.js edit <WI-ID> --details "<original>|[Doc] docs/archive/specs/feature-spec.md"`. You are STRICTLY FORBIDDEN from moving to the Promotion step without verifying the `[Doc]` link is present in the Work Item's `details`.

</critical_instruction>

1. **Promotion**: You are STRICTLY FORBIDDEN from executing `node scripts/update-wi.js WI-## pending` autonomously. Do NOT ask permission to promote the Work Item. Instead, ask the user for further instructions and wait until the user explicitly commands the transition (e.g., "proceed to next stage").

**Verification**:
- WI status is updated to `Pending` and appears in `work-items.md`.

### 6.2 Phase 2: Implementation & Submission (Lead_Engineer)

**Goal**: Execute `node scripts/update-wi.js WI-## done` to submit the Review Package to the QCR.

**Prerequisites**:
- A valid `docs/archive/reviews/{WI-ID}.review-package.md` MUST exist.

**Steps**:
1. Implement the feature and create the Review Package.
2. When LE prepare to transit work item state to done, Update the architecture and file map documents.
3. **Submission**: You are STRICTLY FORBIDDEN from executing `node scripts/update-wi.js WI-## done` autonomously. Do NOT ask permission to submit the Work Item. Instead, ask the user for further instructions and wait until the user explicitly commands the transition.

### 6.3 Phase 3: Quality Control Review (Quality_Control_Reviewer)

**Prerequisites**:
- WI status is `done`.
- `docs/archive/reviews/{WI-ID}.review-package.md` exists and is complete.

**Steps**:
1. **Execute `node scripts/manage-wi.js show {WI-ID}` to verify the WI is in the `done` state.**
2. `Quality_Control_Reviewer` follows the review protocol in `Skill: [PROJ:PROT] Review Package`.
3. Formulate an APPROVED verdict, or note precise, actionable findings for a REJECTED verdict.
4. You are STRICTLY FORBIDDEN from executing `node scripts/update-wi.js {WI-ID} <accepted|rework>` autonomously.
5. Do NOT ask permission to execute the status transition. Simply state your review verdict and ask the user for further instructions.
6. Execute the transition script ONLY after the user explicitly commands the transition.

**Verification**:
- Verify status in `project-roadmap.md` reflects the verdict.

---

## 7. Package Release Flow

> [!IMPORTANT]
> - `Product_Architect` MUST explicitly state "Version bump approved" in the conversation to authorize a transition.
> - `Lead_Engineer` MUST NOT execute release transition before this authorization is granted.

### 7.1 Stage Definitions

| Stage | Version Pattern | Objective |
| :--- | :--- | :--- |
| **Active Development** | `X.Y.Z-dev` | Default state. Features are being implemented. |
| **Release Candidate** | `X.Y.Z-rc.N` | Feature-complete. Regression and integration testing. |
| **Formal Release** | `X.Y.Z` | Stable, production-ready build. |

### 7.2 Transition to Release Candidate (`-dev` → `-rc.1`)

**Goal**: Freeze feature development and begin integration testing.

**Prerequisites**:
- [ ] No `⏳ Pending` items in `docs/work-items.md`.
- [ ] `npm run test -- --watch=false` passes with 0 failures.

**Steps**:
1. `Lead_Engineer` verifies prerequisites and requests transition approval.
2. `Lead_Engineer` updates `package.json` version to `X.Y.Z-rc.1`.

### 7.3 Transition to Formal Release (`-rc.N` → Formal Release)

**Goal**: Publish the stable build.

**Prerequisites**:
- [ ] No open regression issues.
- [ ] `electron-builder` packages verified on all target platforms.
- [ ] If a blocker is fixed during the RC phase, increment `N` (e.g., `-rc.1` → `-rc.2`) and re-verify.

**Steps**:
1. `Lead_Engineer` confirms prerequisites and requests final sign-off.
2. `Lead_Engineer` updates `package.json` to `X.Y.Z` (removing the `-rc.N` suffix).

---

## 9. Trivial Changes & Maintenance

**Definition of "Trivial Changes"**: Pure maintenance operations that do not involve logic changes (e.g., typo fixes, comment optimization, IDE setting adjustments, bug fixes, small enhancements), for which the WI flow may be bypassed.

> [!IMPORTANT]
> **User Authorization**: You are STRICTLY FORBIDDEN from bypassing the standard WI flow for trivial changes without explicit authorization or a direct hint/instruction from the **USER**.

1. **WI Exemption**: If a change meets the definition above and is authorized/hinted by the USER, it does not require a dedicated Work Item.
2. **Review Requirement**: Any code or documentation change MUST still be reviewed by the `Quality_Control_Reviewer`.
3. **Submission**: Submit the Review Package directly for QCR evaluation without a formal Work Item ID.
4. **Commits**: Reference "Minor tweak" or "Refactor" in the commit message.

### 9.1 Dialog Example (Authorization Handshake)

**USER**: "Fix the typo in the DAP configuration guide."
**Lead_Engineer**: "I have identified this as a **Trivial Change** (documentation typo). Pursuant to the protocol, may I have your authorization to bypass the formal WI flow and submit this directly for review?"
**USER**: "Approved. Proceed."
**Lead_Engineer**: "Understood. I will execute the fix and notify QCR for a trivial review."

**Example 2 (User Hint)**:
**USER**: "Fix the copyright year in the footer. You can treat this as a trivial change."
**Lead_Engineer**: "Understood. Following your hint, I will bypass the standard WI flow and submit the fix for review immediately."
