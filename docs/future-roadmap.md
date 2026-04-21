---
title: Future Roadmap
scope: future features, backlog
audience: [Product_Architect, Lead_Engineer, Human Engineer]
---

# Future Roadmap

> This roadmap outlines features scheduled for future exploration. Current targeted version: **v1.0**.

## Milestone v1.1

### WI-31: DAP 'terminated' Event _restart Payload Passing (Status: proposed)

- **Description**: Support context-aware session restart by forwarding the custom _restart field.
- **Details**:
  - Update the DapSessionService to capture the _restart field
  - Ensure disconnect() cycle cleans up stale RxJS subscriptions
  - Modify startSession() initialization sequence to accept and merge this cached _restart data

### WI-74: Extract @taro/ui-shared Utility Library (Status: pending)

- **Description**: Consolidate duplicated UI components, SCSS tokens, and shared Angular utilities into a unified internal library.
- **Details**:
  - Identify common UI patterns (toolbars, status bars, icons)
  - Extract shared SCSS variables and mixins
  - Standardize shared Angular pipes and directives
  - [Doc] Define library-level visual consistency guidelines
  - [Test] Verify component reusability across at least 2 libraries

### WI-30: Local Variable Modification (Status: proposed)

- **Description**: Allow users to modify the values of local variables during a stopped debug session.
- **Details**:
  - Implement a setVariable DAP request within DapSessionService
  - Update app-variables tree component UI to support inline editing
  - Ensure updated values correctly sync back
