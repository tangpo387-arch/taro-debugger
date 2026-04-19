---
title: Documentation Index
scope: index, reading-order, navigation
audience: [Beginner, Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-14
---

# DAP Debugger Frontend — Documentation Index

> [!IMPORTANT]
> This index is a navigation hub only. It is not authoritative on implementation
> detail, WI status, or DAP behavior — always follow the link to the referenced
> document before drawing conclusions.

## 1. Core Specifications & Design

* 📄 **[System Specification (system-specification.md)](system-specification.md)**
  * **Contents**: The project's top-level guiding document. Includes functional and UI layout specifications, Web/Electron dual-deployment mode differences, and the supported DAP request matrix.
  * **When to read**: When you need to understand the overall system goals, what the UI should look like, or to confirm whether a given DAP feature is within the v1.0 scope.

* 📄 **[System Architecture (architecture.md)](architecture.md)**
  * **Contents**: Detailed explanation of the "Session / Transport / UI" three-layer architecture, the state machine, and RxJS data flow.
  * **When to read**: Before writing code, when you need to understand architectural dependencies and determine which layer a given feature belongs to (e.g., never call WebSocket directly from the UI layer).

## 2. Engineering & Testing

* 📄 **[Project Roadmap (project-roadmap.md)](project-roadmap.md)**
  * **Contents**: The full atomic dependency map and strategic visual roadmap of all features, task groups, and implementation milestones.
  * **When to read**: To understand how different modules depend on each other, determine development order, or visualize project scope and completed feature paths.

* 📄 **[Project Management Guide (project-management.md)](project-management.md)**
  * **Contents**: WI/TI lifecycle process, naming conventions, and feature group definitions.
  * **When to read**: When creating, progressing, or retiring any work item.

* 📄 **[Test Plan (test-plan.md)](test-plan.md)**
  * **Contents**: Describes the project's test pyramid strategy, including the scope of unit tests, integration tests, and E2E tests, along with coverage requirements.
  * **When to read**: When you've finished developing a new feature and need to write tests, or when you want to understand the project's CI/CD testing standards.

* 📄 **[Work Items (work-items.md)](work-items.md)**
  * **Contents**: Active backlog of pending and in-progress work items, grouped by Feature Group with a strategic milestone progress view.
  * **When to read**: When looking for the next ticket to pick up, or to understand the overall project progress.

## 3. Troubleshooting & Technical Guides

* 📄 **[DAP Integration FAQ (dap-integration-faq.md)](dap-integration-faq.md)**
  * **Contents**: Detailed answers and best practices for the most common pitfalls encountered during Debug Adapter Protocol implementation (e.g., duplicate Launch issues, `loadedSources` timing, async `configurationDone` problems).
  * **When to read**: When encountering unexpected behavior while integrating with a DAP Server, or when dealing with race conditions in session state management.
