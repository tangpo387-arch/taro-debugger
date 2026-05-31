---
title: Spec-Plan - MemoryViewComponent Unit Tests
scope: unit-test, ui-inspection, memory-inspection
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-05-15
related:
  - ../archive/specs/memory-view-spec.md
  - ../../projects/ui-inspection/src/lib/memory-view.component.ts
---

# Spec-Plan: MemoryViewComponent Unit Tests

## 1. Objective

Verifies the `MemoryViewComponent` in `@taro/ui-inspection`. Focuses on correct transformation of raw bytes into hex/ASCII rows, address calculation, and highlight logic.

## 2. Test Suite: MemoryViewComponent

### Data Processing

- **Render 16-byte row alignment**
  - **Description**: Verifies that a 32-byte buffer is split into exactly two rows of 16 bytes each.
  - **Arrange**: Set `data` to 32 bytes of zeros.
  - **Act**: Component initialization / `ngOnChanges`.
  - **Assert**: `rows` length should be 2.

- **Address calculation (BigInt)**
  - **Description**: Verifies that row addresses are correctly incremented from the base address.
  - **Arrange**: Set `baseAddress` to `0x00007FFFFFFFDC00`. Set `data` to 32 bytes.
  - **Act**: `ngOnChanges`.
  - **Assert**:
    - Row 0 address: `0x00007FFFFFFFDC00`.
    - Row 1 address: `0x00007FFFFFFFDC10`.

- **Hex and ASCII conversion**
  - **Description**: Verifies that bytes are correctly converted to two-digit uppercase hex and printable ASCII.
  - **Arrange**: Set `data` to `[0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00, 0xFF]`.
  - **Act**: `ngOnChanges`.
  - **Assert**:
    - `rows[0].bytes[0..4]` matches `['48', '65', '6C', '6C', '6F']`.
    - `rows[0].ascii` starts with `Hello..` (where `.` represents 0x00 and 0xFF).

### Highlighting

- **Range highlight logic**
  - **Description**: Verifies that `isHighlighted` returns true only for bytes within the specified `highlightedRange`.
  - **Arrange**: Set `highlightedRange` to `{ start: 2, length: 3 }`.
  - **Act**: Call `isHighlighted(0, 1)`, `isHighlighted(0, 2)`, `isHighlighted(0, 4)`, `isHighlighted(0, 5)`.
  - **Assert**:
    - `isHighlighted(0, 1)` -> `false`.
    - `isHighlighted(0, 2)` -> `true`.
    - `isHighlighted(0, 4)` -> `true`.
    - `isHighlighted(0, 5)` -> `false`.

### Edge Cases

- **Empty data**
  - **Description**: Verifies that providing an empty `Uint8Array` clears the rows.
  - **Arrange**: Set `data` to empty `Uint8Array`.
  - **Act**: `ngOnChanges`.
  - **Assert**: `rows` length should be 0.

- **Partial row padding**
  - **Description**: Verifies that a buffer not divisible by 16 is padded correctly in the UI.
  - **Arrange**: Set `data` to 5 bytes.
  - **Act**: `ngOnChanges`.
  - **Assert**:
    - `rows` length should be 1.
    - `rows[0].bytes[5]` should be `''`.
    - `rows[0].ascii[5]` should be `' '`.

### Infinite Scroll & Anchoring

- **Prepend memory fetch on scroll near top**
  - **Description**: Verifies that scrolling near the top boundary (index <= 10) triggers a prepend read memory fetch at the preceding address.
  - **Arrange**: Set `baseAddress` to `0x2000n`, `data` to 256 bytes. Mock `CdkVirtualScrollViewport` methods and spy on `DapMemoryService.read`.
  - **Act**: Scroll near top (index = 5).
  - **Assert**: `DapMemoryService.read` should be called with `0x1E00n` (preceding address).

- **Correct scroll offset after prepend (Scroll Anchoring)**
  - **Description**: Verifies that scroll offset is correctly adjusted by the prepended rows height to prevent jumps.
  - **Arrange**: Setup mock viewport with `measureScrollOffset` returning `10`.
  - **Act**: Scroll near top (index = 2).
  - **Assert**: `viewport.scrollToOffset` should be called with `778` (`10 + 32 * 24`).

- **Render unmapped placeholders on failed reads**
  - **Description**: Verifies that failing to read preceding memory generates placeholder rows filled with `??`.
  - **Arrange**: Mock `DapMemoryService.read` to resolve with empty array (failed read).
  - **Act**: Scroll near top (index = 2).
  - **Assert**: `rows` length should increase by `32` and the prepended row at index 0 should have `isUnmapped = true` and `??` cells.
