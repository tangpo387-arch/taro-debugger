---
title: Documentation Index
scope: index, reading-order, navigation
audience: [Beginner, Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-28
---

# Taro Debugger Documentation Index

> [!IMPORTANT]
> This index is the primary navigation hub. Always refer to the specialized sub-directories for detailed specifications and architecture rules.

## 1. Documentation Taxonomy

The project documentation is organized into functional tiers to separate permanent design rules from historical records.

| Directory | Purpose |
| :--- | :--- |
| `architecture/` | **The Laws**. Permanent design rules, layer responsibilities, and system-level specs. |
| `project/` | **Governance**. Project management, roadmaps, and documentation standards. |
| `guides/` | **Knowledge**. Procedural guides, FAQs, and developer resources. |
| `archive/` | **History & Reviews**. Technical blueprints (`specs/`) and QCR handoff documents (`reviews/`). |

## 2. Core Navigation

### System Design & Architecture

- 📄 **[System Architecture (architecture.md)](architecture.md)**: The master index for all sub-system architecture documents.
- 📄 **[System Specification (system-specification.md)](system-specification.md)**: Global functional requirements and DAP feature matrix.
- 📄 **[Source File Responsibility Map (file-map.md)](file-map.md)**: Quick-reference for locating code by feature area.

### Engineering & Quality

- 📄 **[Work Items (work-items.md)](work-items.md)**: Current active backlog and ticket status.
- 📄 **[Test Plan (test-plan.md)](test-plan.md)**: Test pyramid strategy and coverage standards.
- 📄 **[Documentation Standards (project/documentation-standards.md)](project/documentation-standards.md)**: Rules for writing and verifying project docs.

### Strategic Planning

- 📄 **[Project Roadmap (project-roadmap.md)](project-roadmap.md)**: Milestone tracking and feature dependency visualization.
- 📄 **[Future Roadmap (project/future-roadmap.md)](project/future-roadmap.md)**: Post-v1.0 backlog and long-term vision.

## 3. Getting Started

1. **New Developers**: Read the **[System Architecture](architecture.md)** to understand the Three-Layer Pattern (Transport, Session, UI).
2. **Implementing Features**: Check the **[Work Items](work-items.md)** for your assigned ticket and review the related spec in `docs/architecture/`.
3. **Submitting Code**: Follow the **[Project Management Guide](project/project-management.md)** to move your WI to `done` and create a Review Package.
