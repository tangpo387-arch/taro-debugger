---
title: Unit Test Plan - TaroEmptyStateComponent
scope: UI Shared Component
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
---

# Unit Test Plan - TaroEmptyStateComponent (WI-80)

## Purpose

Verify that the `TaroEmptyStateComponent` correctly renders its input properties (message, icon, description) and adheres to the visual centering rules defined in the specification.

## Test Cases

### 1. **Default Rendering (Required Message)**

- **Setup**: Provide only the `message` input.
- **Assertion**:
  - The message text is rendered.
  - No icon element is present.
  - No description element is present.
  - The `.centered` class is applied by default.

### 2. **Optional Icon Rendering**

- **Setup**: Provide `message` and `icon="visibility_off"`.
- **Assertion**:
  - `mat-icon` element is rendered with the correct icon name.
  - The icon is visible.

### 3. **Optional Description Rendering**

- **Setup**: Provide `message` and `description="Additional details here"`.
- **Assertion**:
  - Description text is rendered correctly below the message.

### 4. **Centering Control**

- **Setup**: Provide `message` and `centered=false`.
- **Assertion**:
  - The `.centered` class is NOT applied to the container.

### 5. **Visual Layout Consistency**

- **Setup**: Provide all inputs.
- **Assertion**:
  - Container has `display: flex` and `flex-direction: column`.
  - Content is vertically and horizontally centered (when `centered=true`).
