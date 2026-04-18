---
title: SetupComponent — Unit Spec Plan
scope: unit-test
audience: [Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/taro-debugger-frontend/projects/taro-debugger-frontend/src/app/setup/setup.component.ts
related-wi: ~
last_updated: 2026-04-13
---

# SetupComponent — Unit Spec Plan

## Overview

Fully isolated tests for `SetupComponent`. Focuses on form validation logic and Launch / Attach mode state switching.

---

## Test Cases

* **Form Validation**
  * When required fields (DAP Server address, executable path) are not filled, the form should be invalid; when connection address format is incorrect, it should trigger the corresponding validation error.

* **State switching**
  * When toggling Launch / Attach mode, button text and visible fields should change correctly.
