# Documentation Guard Checklist & Templates

> [!IMPORTANT]
> This resource provides an at-a-glance reference for applying the `doc-guard.js` protocol within the Work Item lifecycle. For the full specification, see [docs/doc-guard-protocol-spec.md](../../../docs/doc-guard-protocol-spec.md).

## 1. Specification Types (init-spec)

Use these types when promoting a Work Item that meets the Complexity Gate.

| Type | Intended Content | Sections Generated |
| :--- | :--- | :--- |
| `feature` | High-level requirements and behavior | Purpose, Scope, Behavior, Acceptance Criteria |
| `service` | Technical implementation details | Overview, Layer Responsibilities, API Contract, Constraints |
| `guide` | Procedural step-by-step instructions | Goal, Prerequisites, Steps, Verification |
| `troubleshoot` | Bug analysis and fixing steps | Symptom, Root Cause, Resolution, Prevention |

## 2. Verification Rules (verify)

Ensure these criteria are met before any document is considered ready for review.

1. **Frontmatter**: Must include `title`, `scope`, and `audience`.
2. **Language**: US English only. No Chinese characters in `*.md`, `*.ts`, `*.html`, or `*.scss`.
3. **Naming**: kebab-case filenames (e.g., `feature-name-spec.md`).
4. **Hierarchy**: Proper heading levels (H1 -> H2 -> H3). No skipped levels.

## 3. Mandatory Integration

- **Scoping**: Run `init-spec` for all Size M+ Work Items.
- **Submission**: Run `lint:docs` before producing a Review Package.
- **Review**: QCR must run `lint:docs` before inspecting code.
