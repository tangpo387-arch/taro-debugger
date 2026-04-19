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

### WI-30: Local Variable Modification (Status: proposed)

- **Description**: Allow users to modify the values of local variables during a stopped debug session.
- **Details**:
  - Implement a setVariable DAP request within DapSessionService
  - Update app-variables tree component UI to support inline editing
  - Ensure updated values correctly sync back
