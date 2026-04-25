---
title: Spec Plan - Application Frame & Global Controls Integration
scope: Testing
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
---

# Spec Plan: Application Frame & Global Controls Integration (WI-81)


## 1. Test Strategy

Verify that the unified application frame and global controls correctly handle layout toggling, mode detection, and footer state presentation according to the Flush IDE specification.

## 2. Test Cases

### **Mode Detection (Electron vs Web)**

- **Electron mode**: `isElectron` should be true if `window.electronAPI` is present.
- **Web mode**: `isElectron` should be false if `window.electronAPI` is absent.
- **Brand Title Visibility**: `brand-title` should be hidden in Electron mode.
- **Close Session Button Visibility**: `logout` button should be hidden in Electron mode.

### **Layout Toggling**

- **Toggle Left Sidenav**: Triggering `VIEW_TOGGLE_EXPLORER` should toggle `leftVisible`.
- **Toggle Right Sidenav**: Triggering `VIEW_TOGGLE_INSPECTION` should toggle `rightVisible`.
- **Toggle Console**: Triggering `VIEW_TOGGLE_CONSOLE` should toggle `consoleVisible`.
- **Reset Layout**: Triggering `VIEW_RESET_LAYOUT` should reset all dimensions and visibility to default.

### **Status Bar (Footer)**

- **State Label removal**: Footer should NOT contain the "State: " prefix.
- **Execution State presentation**: Footer should correctly display the execution state using titlecase.

### **Debug Control Group: Status LED**

- **Running state**: LED should have `running` class and `Running` tooltip.
- **Stopped state**: LED should have `stopped` class and `Stopped` tooltip.
- **Tooltip accuracy**: LED `[title]` should exactly match the current `executionState$`.
