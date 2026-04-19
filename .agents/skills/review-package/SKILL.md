---
name: Review Package
description: Defines the mandatory structured handoff document that Lead_Engineer must produce before requesting a QCR review. Enables QCR to operate entirely from the Review Package without re-discovering context.
---

# Review Package Skill

> [!IMPORTANT]
> **Purpose**: The Review Package exists to eliminate redundant file reads during QCR review by providing a pre-assembled, verified context snapshot. The QCR agent MUST treat this document as its primary input and avoid re-reading source files unless the package explicitly flags an area as requiring deeper inspection.

---

## 1. When to Use This Skill

### Lead_Engineer

Load before completing **any** implementation task:

- You MUST produce a `docs/reviews/{WI-ID}.review-package.md` file **before** requesting a QCR review.
- You MUST run `node scripts/doc-guard.js verify` (or `npm run lint:docs`) and ensure all documents pass before submission.
- STRICTLY FORBIDDEN from submitting to QCR without a complete Review Package.
- Do not generate this file until all tests are passing.

### Quality_Control_Reviewer

Load at the **start** of every review request:

- Begin your review from the Review Package located at `docs/reviews/{WI-ID}.review-package.md`.
- Do NOT redundantly re-read full source files unless the Package explicitly marks a section as requiring deeper inspection (`🔍 Inspect`).
- Restrict your `view_file` / `grep_search` calls to only the line ranges listed in the Package's diff summary.

---

## 2. File Location & Naming

| Field | Value |
| :--- | :--- |
| **Directory** | `docs/reviews/` |
| **Filename format** | `{WI-ID}.review-package.md` |
| **Example** | `docs/reviews/WI-39.review-package.md` |

---

## 3. Review Package Structure (Template)

Every Review Package MUST contain exactly the following sections:

```markdown
---
wi: {WI-ID}
title: {WI title, copied verbatim from manage-wi.js show output}
author: Lead_Engineer
status: ready-for-review
skills-required: [skill-name-1, skill-name-2]
---

# Review Package: {WI-ID}

## 1. Acceptance Criteria

> Copied verbatim from `node scripts/manage-wi.js show {WI-ID}` `.details[]`.

- [ ] criterion 1
- [ ] criterion 2
- [ ] [Test] test criterion

## 2. Diff Summary

> List every modified file with the exact line ranges changed.
> Do NOT paste code — QCR will read only those ranges if needed.

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `projects/taro-debugger-frontend/src/app/foo.service.ts` | L56–62, L252–287 | Added commandInFlightSubject + guard logic |
| `projects/taro-debugger-frontend/src/app/bar.component.ts` | L44–46 | Exposed commandInFlight$ |

## 3. Edge Cases & Design Decisions

> Explain any non-obvious decisions. Flag areas requiring deeper QCR inspection with 🔍.

- Decision: Used silent drop (not error propagation) for in-flight collisions, per R-CS1 spec.
- 🔍 Inspect: The `finally` block in `continue()` — verify it always resets even on rejection.

## 4. Tests Added

| File | Suite | Test Case |
| :--- | :--- | :--- |
| `projects/taro-debugger-frontend/src/app/foo.service.spec.ts` | `Command Serialization (R-CS1)` | should set commandInFlight$ to true |
| `projects/taro-debugger-frontend/src/app/foo.service.spec.ts` | `Command Serialization (R-CS1)` | should drop second call while in-flight |

## 5. Spec-Plan Updates

| Spec-Plan File | Section Added |
| :--- | :--- |
| `docs/tests/unit-dap-session.spec-plan.md` | `Command Serialization (R-CS1)` |

## 6. Self-Verification

> Paste the terminal output proving all tests pass.

\`\`\`
✓ Command Serialization (R-CS1) (2)
  ✓ should set commandInFlight$ to true... 2ms
  ✓ should drop second call while one is in-flight 2ms
Test Files  1 passed (1)
\`\`\`
```

---

## 4. QCR Review Protocol

When given a `QCR review {WI-ID}` request, the QCR MUST follow this exact sequence:

```text
Step 1  Run node scripts/doc-guard.js verify (baseline document quality check)
Step 2  Read docs/reviews/{WI-ID}.review-package.md
Step 3  Load only the Skills listed in `skills-required`
Step 4  Verify Acceptance Criteria — check only the diff line ranges listed
Step 5  Verify Edge Cases — inspect only 🔍-flagged areas
Step 6  Verify Tests — confirm test count and suite names match §4 of the Package
Step 7  Verify Spec-Plan Updates — check §5 of the Package
Step 8  Issue APPROVED or REJECTED verdict with precise, actionable findings
```

> [!CAUTION]
> Skipping Step 1 and reading source files directly is a protocol violation. It inflates context cost and defeats the purpose of the Review Package.

---

## 5. Exclusion Boundaries

- This skill does NOT govern how to write test cases (see `test-case-writing` skill).
- This skill does NOT govern spec-plan content structure (see `test-case-writing` §3).
- This skill does NOT govern WI lifecycle transitions (see `work-item-management` skill).
