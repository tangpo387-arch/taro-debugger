---
title: Project - Documentation Standards
scope: documentation, doc-guard, standards, process
audience: [Human Engineer, Lead_Engineer, Product_Architect, Quality_Control_Reviewer]
last_updated: 2026-04-28
related:
  - project-management.md
---

# Documentation Standards

This document defines the mandatory standards and automated protocols for all documentation in the Taro Debugger project.

## 1. Core Principles

- **US English Only**: All documentation MUST be written in US English.
- **Audience Declaration**: Every file must declare its `audience` (e.g., `Human Engineer`, `Lead_Engineer`) in the YAML frontmatter.
- **Kebab-Case Naming**: All filenames must use `kebab-case` (e.g., `system-specification.md`).
- **DRY Principle**: Define a concept once. Use cross-links instead of duplicating information.

## 2. Document Types & Requirements

| Type | Directory | Required Sections |
| :--- | :--- | :--- |
| **Architecture** | `docs/architecture/` | Overview, Responsibilities, API Contract, Constraints. |
| **Project** | `docs/project/` | Goal, Scope, Lifecycle, Verification. |
| **Guides** | `docs/guides/` | Goal, Prerequisites, Steps, Verification. |
| **Reviews** | `docs/reviews/` | Acceptance Criteria, Diff Summary, Tests Added. |

## 3. Automated Guard Protocol (`doc-guard.js`)

The `doc-guard.js` tool automates compliance and reduces manual overhead.

### 3.1 Specification Initialization

When the **Complexity Gate** is passed (Size M+ or architectural change), the `Product_Architect` must use the `init-spec` command to create the initial document.

```bash
node scripts/doc-guard.js init-spec <WI-ID> <type> [Filename]
```

### 3.2 Verification & Linting

The `verify` command (aliased to `npm run lint:docs`) is a mandatory pre-check for all developers.
- **Lead_Engineer**: Must run before submitting a Review Package.
- **Quality_Control_Reviewer**: Must run at the start of every review.

## 4. Maintenance Rules

- **Modifying Docs**: Edits must not silently add or remove expressed content unless explicitly requested.
- **Archiving**: When a feature is retired or a spec is superseded, move the file to `docs/archive/`.
- **References**: Always update the `Master Index` (`docs/architecture.md`) when adding or moving architecture documents.
