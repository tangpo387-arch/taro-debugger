---
name: "[META:RULE] AI Skill Engineering"
description: Structure, constraints, and negative boundaries for writing or modifying AI skill files in the .agents/ directory.
---

# Agent Skill Authoring Rules

## 1. Applicable Roles

| Role | Required When |
| :--- | :--- |
| `Product_Architect` | Before authoring, designing, or modifying any AI skill file |
| `Quality_Control_Reviewer` | Before reviewing changes to the AI skill registry |

## 2. When to Load This Skill

---

Load before any of the following tasks:
- Creating a new skill directory and `SKILL.md` file under `.agents/skills/`
- Refining or adding new constraints to an existing AI skill
- Restructuring prompt hierarchies to improve LLM adherence

---

## 3. Mandatory Formatting Rules (Context Injected)

> [!IMPORTANT]
> To ensure the AI model immediately registers these rules without needing to resolve external links, these core formatting constraints are explicitly duplicated here.

### 3.1 Path Classifications & Naming Conventions

The `.agents/` workspace houses different context profiles. You MUST apply these structural mappings:

<constraints>

| Path Classification | Purpose | File Naming Rule | Constraint Coverage |
| :--- | :--- | :--- | :--- |
| **`.agents/skills/`** | Dynamic AI workflows loaded for specialized tasks. | MUST be `[kebab-case]/SKILL.md` | Full adherence to **all** rules in this document (§3 and §4). |
| **`.agents/rules/`** | Static operating procedures (e.g., `code-style-guide.md`) injected globally. | Intuitive `kebab-case.md` | MUST follow Prompt Engineering (§4), but YAML frontmatter (§3.2) is not required. |
| **`.agents/project-context.md`** | Mandatory global startup index. | Exactly `.agents/project-context.md` | Structural exception to skill naming. MUST strictly implement Prompt Engineering (§4) tags and boundaries. |

- **Language**: All `.agents/` instructions, rules, and examples MUST be written in **US English**.

</constraints>

### 3.2 YAML Frontmatter

Every `SKILL.md` file must open with a valid YAML block containing exactly two fields:

```yaml
---
name: Human Readable Skill Name
description: A 1-2 sentence summary of what this skill teaches the AI to do.
---
```

---

## 4. Prompt Engineering Directives

When writing instructions for an AI agent, you are programming a probabilistic model. Narrative flow is useless; deterministic constraints are mandatory.

### 4.1 Strict Negative Boundaries

AI models naturally attempt to be "overly helpful," which leads to hallucination and scope creep. You must explicitly define what the agent cannot do.
- Use **`STRICTLY FORBIDDEN`** to outline hard boundaries.
- Use **`MUST NOT`** instead of "should not" or "avoid".
- **Example**: *"STRICTLY FORBIDDEN from guessing file paths. You MUST use the view_file tool to confirm."*

### 4.2 XML Tag Isolation

AI models process structured data significantly better than flat prose. Use XML tags to encapsulate specific rule sets, workflows, or constraint lists to prevent context bleed.
- **Valid Tags**: `<constraints>`, `<workflow>`, `<critical-instruction>`, `<examples>`
- Do not mix instructions for different roles in the same paragraph; isolate them in tags.

### 4.3 Deterministic State Triggers

Do not leave decision-making ambiguous. Define explicit if/then triggers that force the AI to halt or ask for permission.

| ❌ Vague (Prone to failure) | ✅ Deterministic (AI respects this) |
| :--- | :--- |
| "Be careful deleting large files." | "If a file is larger than 300 lines, you MUST STOP and wait for the user's approval before deleting." |
| "Make sure the test passes." | "You MUST run the Vitest command. If it fails, you are FORBIDDEN from proceeding to the next step." |

### 4.4 High Signal-to-Noise Ratio

Do not write conversational introductions. The AI is a machine parsing context tokens.
- **Omit**: *"This skill will help you understand how to write better code..."*
- **Keep**: *"**Rule 1**: All Angular components must use the `inject()` pattern."*

### 4.5 XML Tag Rendering Rules

<constraints>

- **Blank Line Separation**: You MUST leave at least one empty line immediately after an opening XML tag, and before a closing XML tag.
- **Header Placement**: You MUST NOT place Markdown headers (e.g., `##`) inside XML tags.
- **No Indentation**: You are STRICTLY FORBIDDEN from indenting XML tags. They MUST be flush-left to prevent unintended conversion into raw code blocks.

</constraints>

---

## 5. Verification Checklist

Before saving an AI skill file, you must verify:
- [ ] Is the file named exactly `SKILL.md` inside a `kebab-case` directory?
- [ ] Is the YAML frontmatter present with `name` and `description`?
- [ ] Are all negative boundaries stated using `STRICTLY FORBIDDEN` or `MUST NOT`?
- [ ] Has all narrative fluff been stripped out in favor of deterministic triggers?
- [ ] Are complex rule lists properly isolated inside XML tags (e.g., `<constraints>`)?
- [ ] Are all XML tags left-aligned and separated by empty buffer lines to preserve Markdown rendering?
