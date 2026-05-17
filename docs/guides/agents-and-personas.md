# Agents and Personas Guide

This guide explains how to effectively use the AI agents in the Taro Debugger project. Whether you are using the Gemini CLI's technical features or following our project-specific development roles, this document will help you understand "who" you are talking to and "how" to call them.

---

## 1. The Two Types of AI Assistance

There are two distinct ways to interact with AI in this project: **Technical Subagents** and **Project Personas**.

| Feature | Custom Subagents | Project Personas (Personas) |
| :--- | :--- | :--- |
| **What it is** | A "Technical Specialist" | A "Workflow Guardian" |
| **Context** | **Isolated**: Starts a fresh "mini-session" to save tokens. | **Shared**: Runs in your main session with full history. |
| **Best For** | Heavy lifting, research, or batch tasks. | Feature development and project governance. |
| **Trigger** | Automatic or `@name`. | Manual request or task-based switching. |

---

## 2. Project Personas (In-Session Roles)

These are defined in `AGENTS.md`. They are designed to manage the development lifecycle and ensure we follow our monorepo standards.

### The Team Roles

- **Product_Architect**: Designs systems, writes specs, and manages the Roadmap. *Constraint: Never writes code.*
- **Lead_Engineer**: Implements features, fixes bugs, and writes tests. *Constraint: Must follow the Architect's design.*
- **Quality_Control_Reviewer**: Audits code changes for quality and protocol compliance. *Constraint: Cannot submit without a passing review.*

### How to "Call Out" a Persona

1. **Explicitly**: Start your message with the name, e.g., `Lead_Engineer: Refactor the session service.`
2. **Implicitly**: Give the agent a task (e.g., "Review this PR") and it will automatically adopt the **Quality_Control_Reviewer** persona based on the rules in `.agents/project-context.md`.

---

## 3. Technical Subagents (Isolated Specialists)

Subagents are a feature of the Gemini CLI. They are ideal for tasks that don't need the full context of your conversation history, saving you money (tokens) and time.

### Why use a Subagent?

- **Massive Data**: If you need to search 1,000 files for a specific string.
- **Speculative Research**: If you want the agent to "try 5 different ways" to fix something without cluttering your main chat.
- **Focused Expertise**: You can create a subagent that *only* knows about CSS or *only* knows about GDB commands.

### How to use a Subagent

Use the `@` syntax in the CLI:
`@codebase_investigator Find all occurrences of "DapSession" in the workspace.`

---

## 4. Summary for Beginners

- **Default to Personas** for regular coding and design work. They "know" what you've been doing.
- **Use Subagents** when you need a "deep dive" or a technical "drone" to perform a specific, isolated task.
- **Check `.agents/project-context.md`** to see which persona is "hired" for which type of task.
