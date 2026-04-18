---
name: Documentation Authoring Rules
description: Structure, tone, context, and verification standards for writing or reviewing any project Markdown document.
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
---

# Documentation Authoring Rules

## 1. Applicable Roles

| Role | Required When |
| :--- | :--- |
| `Product_Architect` | Before authoring or approving any spec, README, or guide under `docs/` |
| `Quality_Control_Reviewer` | Before reviewing any documentation PR |

## 2. When to Load This Skill

---

Load before any of the following tasks:

- Creating or rewriting a `docs/*.md` or `.agents/*.md` file
- Reviewing an existing document for quality or completeness
- Generating section templates or documentation scaffolds

---

## 3. Structural Requirements

### 3.0 File Conventions

- **File naming**: All `*.md` files use `kebab-case` (e.g., `system-specification.md`, `dap-integration-faq.md`).
- **Language**: All Markdown content must be written in **US English**. Non-English content is forbidden in `*.md` files.

### 3.1 Self-Contained Sections

Each section must stand alone — a reader should not need to read another section to understand it. Minimize implicit cross-section dependencies.

### 3.2 Explicit Hierarchy

Use Markdown headings (`#`, `##`, `###`) consistently. Do not skip levels. Heading hierarchy is the primary signal for content relationships.

### 3.3 Required Section Checklist

Every document must declare its mandatory sections in the frontmatter or opening note. Standard required sections by document type:

| Document Type | Required Sections |
| :--- | :--- |
| Feature Spec | Purpose, Scope, Behavior, Acceptance Criteria |
| Service/Architecture Doc | Overview, Layer Responsibilities, API Contract, Constraints |
| How-To Guide | Goal, Prerequisites, Steps, Verification |
| Troubleshooting | Symptom, Root Cause, Resolution, Prevention |

> [!IMPORTANT]
> Agents must not omit required sections without explicit user approval.

### 3.4 Edit Integrity

**"Modifying an existing document"** means any task whose stated goal is reformatting, restructuring, fixing errors, or improving clarity — **not** tasks that explicitly request new content, additional sections, or extended scope.

When a task falls under this definition, edits **must not add or remove expressed content**. Only reformatting or structural reorganization of existing meaning is permitted.

- **Permitted**: Fixing grammar, reordering list items for clarity, converting prose to a table, correcting formatting.
- **Prohibited**: Inserting new constraints, deleting existing rules, or silently narrowing/broadening scope — even if the change seems minor.
- **Exception**: Additions or removals are allowed only when explicitly requested by the user or required to correct a factual inaccuracy confirmed against authoritative project sources.

---

## 4. Style & Tone

### 4.1 Objective and Precise

Write as a "professional mentor": factual, direct, evidence-based. Replace subjective adjectives with engineering criteria:

| ❌ Avoid | ✅ Prefer |
| :--- | :--- |
| "powerful feature" | "reduces round-trips by eliminating N+1 DAP requests" |
| "easy to use" | "requires no configuration beyond `port`" |
| "best practice" | "required by DAP spec §6.3" |

### 4.2 High Signal-to-Noise

Prefer human-readable identifiers over low-level IDs:

| ❌ Avoid | ✅ Prefer |
| :--- | :--- |
| `3f2a1b...` (UUID) | `DapSessionService` |
| `type: 0x04` | `type: "event"` |

### 4.3 Audience Declaration

Every document must explicitly and correctly declare its target audience in the YAML frontmatter (`audience:`). You must select from the following defined audience categories and calibrate the technical density accordingly:

- **Agent Role Play** (e.g., `[Product_Architect, Lead_Engineer, Quality_Control_Reviewer]`): For AI models performing context gathering and task execution. Use strict constraints, explicit inclusion/exclusion boundaries, and precise machine-readable formats.
- **Human Engineer** (Senior Engineer / Architect): For experienced project developers. Omit basic definitions; focus on architectural constraints, API contracts, system trade-offs, and state management flow. Must prioritize smooth human readability, logical narrative flow, and clean, aesthetic Markdown typography (e.g., well-formatted tables, bold emphasis, and structured spacing).
- **Beginner** (New contributors / End users): For onboarding materials or general usage guides. Define all acronyms on first use; provide step-by-step instructions; link to fundamental external references. Must feature highly accessible wording, engaging reading flow, and visually appealing layout (e.g., clear paragraph breaks, callout alerts, and structured lists).

#### 4.3.1 Directory and File Mapping Rules

To ensure content is properly directed, enforce the following assignment rules:

- **`docs/` directory files**: MUST include **`Human Engineer`**. Both human engineers and agents often read these, but human comprehensibility is strictly required.
- **`.agents/` directory files**: MUST exclusively target **`Agent Role Play`** (or specify individual agent personas). Do not include human or beginner audiences here.
- **`README.md` (Root)**: MUST explicitly target **`Beginner`**, as it serves as the project's foundational onboarding entry point.

### 4.4 Conciseness Rules

- **No redundant attributive clauses**: Omit "This document contains…", "The purpose of this file is…", "The following section describes…".
- **No redundant explanatory sentences**: Don't restate what the heading already states.
  - **Exception**: If the heading is ambiguous or uses domain-specific terminology, one opening sentence to clarify scope is permitted.
- **Prefer inline references over standalone bullets**: Sub-resources (auto-generated output, underlying schema) → inline link, not a full bullet.
  - **Guard**: Any document listed as a primary reference in `project-context.md §7 Agent Context Sources` must **not** be demoted — it retains its own bullet entry.
  - **Exception**: If a sub-resource is the sole entry point to a required workflow (i.e., an agent would not find it by other means), keep it as a standalone bullet.
- **Write for skimming**: Omit filler words: "in order to", "it is worth noting that", "as mentioned above".

---

## 5. Precision Requirements for AI Readability

Vague specs produce vague output. Satisfy these before submitting a doc as agent context.

### 5.1 Code Snippets over Prose Rules

A correct code example is more effective than three paragraphs of style description. When documenting a pattern, include a minimal working snippet:

```typescript
// ✅ Preferred: show the pattern directly
private readonly session = inject(DapSessionService);
```

### 5.2 Explicit Tech Stack Versions

List concrete versions when documenting environment-specific behavior. Omitting versions causes AI to generate deprecated syntax:

```yaml
# ✅ Preferred
tech_stack:
  angular: 21
  node: ">=20.x"
  vitest: "^3.x"
```

### 5.3 Explicit Exclusion Boundaries

State what the document must NOT cover. This prevents scope creep and hallucinated content:

> [!IMPORTANT]
> Declare exclusions explicitly, e.g.:
> - "Do not include authentication logic — out of v1.0 scope."
> - "Do not document `SerialTransportService` — status: proposed, not implemented."

---

## 6. Diagrams & Accessibility

### 6.1 Diagram Text Descriptions

Every diagram (`mermaid`, image) must be accompanied by a plain-text description below it. This ensures accessibility and machine-readability:

> [Diagram: Three-layer flow — UI calls `Session.sendRequest()`,
> Session calls `Transport.send()`, Transport writes to WebSocket.]

### 6.2 Troubleshooting Format

Every troubleshooting entry must follow this four-field structure:

| Field | Requirement |
| :--- | :--- |
| **Symptom** | Exact observable behavior (error message, state) |
| **Root Cause** | Specific technical explanation |
| **Resolution** | Numbered steps |
| **Prevention** | Code pattern or config that prevents recurrence |

---

## 7. Verification Checklist

Before finalizing any document, run this self-check:

- [ ] Does each section stand alone (§3.1)?
- [ ] Are all required sections present for this document type (§3.3)?
- [ ] Is a defined `audience:` correctly declared in the frontmatter, and does the content match its technical density (§4.3)?
- [ ] Is every diagram accompanied by a text description (§6.1)?
- [ ] Are all exclusion boundaries stated (§5.3)?
- [ ] Have subjective adjectives been replaced with measurable criteria (§4.1)?
- [ ] Are conciseness rules applied — no redundant clauses, no filler words, inline refs preferred (§4.4)?
- [ ] Is all content derived from existing project documents or confirmed facts — not inferred? If uncertain, ask the user.
- [ ] **Edit integrity (§3.4)**: If this task is a reformatting/restructuring task (as defined in §3.4), has no content been silently added or removed — unless explicitly requested by the user or required to correct a confirmed factual inaccuracy?
