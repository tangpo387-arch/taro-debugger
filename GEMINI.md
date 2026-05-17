# Taro Debugger — Project Instructions

This file provides the technical baseline and architectural guardrails for the Taro Debugger project. It acts as the primary "Operating System" for AI agents.

## 1. Technical Baseline

- **Framework**: Angular 21+ (Standalone Components ONLY).
- **Environment**: Electron (Desktop) or Browser (Web).
- **Protocol**: Debug Adapter Protocol (DAP).
- **Styling**: Angular Material + SCSS. **TailwindCSS is STRICTLY FORBIDDEN.**

## 2. Monorepo Structure

- `projects/taro-debugger-frontend`: Main Angular shell.
- `projects/dap-core`: Core DAP logic, session management, and transport.
- `projects/ui-*`: Feature-specific UI libraries (Console, Editor, Inspection, Assembly).
- `docs/`: Comprehensive architecture, file maps, and project management docs.

## 3. Workflow & State Management

The project is driven by **Work Items (WI)**. No code should be written without an associated WI.
- **Planning**: Architect designs the spec and creates the WI.
- **Execution**: Lead Engineer implements and updates the WI to `done`.
- **Review**: QC Reviewer audits the "Review Package" and moves the WI to `accepted`.
- **Scripts**: All status transitions MUST be performed via `node scripts/update-wi.js`.

## 4. Operational Source of Truth

To minimize context bloat, detailed technical commands and stack requirements are centralized. You MUST refer to these files for execution:
- **Commands & Terminology**: [`.agents/project-context.md`](.agents/project-context.md)
- **Role Constraints**: [`AGENTS.md`](AGENTS.md)
- **File Navigation**: [`docs/file-map.md`](docs/file-map.md)
- **Style Guide**: [`rules/code-style-guide.md`](rules/code-style-guide.md)

---
*Note: This is the entry point. For detailed "how-to", proceed to project-context.md.*
