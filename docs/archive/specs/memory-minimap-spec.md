---
title: Specification - Memory Segment Minimap
scope: Low-Level Inspection
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
  - memory-view-spec.md
---

# Memory Segment Minimap (WI-145)

> [!NOTE]
> **Source Work Item**: Memory Segment Minimap
> **Description**: Implement a high-density vertical minimap track next to the memory view scrollbar to visualize and navigate virtual memory segments.

---

## Purpose

The Memory Segment Minimap provides developers with a high-density vertical overview of the target process's virtual memory segments (e.g., active stack frame regions or local heap segments). Because a pure 64-bit virtual memory space is effectively infinite, this track visualizes a bounded active segment, placing indicators for variables, pointer anchors, and stack locations, and enables quick drag-to-scroll positioning.

---

## Scope

### In-Scope

- **Address-to-Pixel Projection**: Linear translation of virtual 64-bit memory addresses (`bigint`) within a local segment to vertical pixel coordinates ($0 \dots H_{\text{track}}$) on the minimap bar.
- **Dynamic Indicators**: Colored, high-density marker lines overlaying the track representing:
  - In-scope pointer variables (Indigo).
  - Instruction pointer / Program Counter anchors (Green).
  - Stack frame boundaries (Blue).
- **Drag-to-Scroll**: Interactive click-and-drag navigation across the minimap track that dispatches aligned physical address scroll events back to the parent hex view viewport.

### Out-of-Scope

- **Process-Wide Global Address Map**: We do not map the entire OS memory map (e.g., `/proc/self/maps`); visualization is confined to the currently loaded memory range and its immediate active context (heap/stack frame bounds).
- **Writing Memory from Minimap**: Modifications must be done strictly via the Hex grid inline editor (WI-121).

---

## Behavior

### 1. Address-to-Pixel Projection Coordinate System

To map addresses onto the vertical bar height ($H$ in pixels):
Let the bounded segment start address be $A_{\text{start}}$ and end address be $A_{\text{end}}$. The total address span is:
$$\text{Span} = A_{\text{end}} - A_{\text{start}}$$
For any target physical memory address $A$, its relative pixel offset $Y$ from the top of the minimap track is calculated as:
$$Y = \frac{A - A_{\text{start}}}{\text{Span}} \times H$$

### 2. Indicator Markings

The component receives an input list of metadata markers `MemoryMarker[]`:

```typescript
export interface MemoryMarker {
  address: bigint;
  label: string;
  type: 'variable' | 'pointer' | 'stack';
}
```

Markers are plotted onto the vertical minimap track using corresponding CSS styling:
- **Variable (`type === 'variable'`)**: Solid Indigo line (`#6366f1`) with hover tooltip.
- **Pointer (`type === 'pointer'`)**: Solid Emerald line (`#10b981`) representing reference addresses.
- **Stack (`type === 'stack'`)**: Semi-transparent blue block overlay (`#3b82f6` with `0.2` opacity) representing the active stack frame region.

### 3. Drag Navigation Interaction

- **Click Event**: Clicking any location $Y_{\text{click}}$ on the track calculates the corresponding physical memory address:
  $$A = A_{\text{start}} + \frac{Y_{\text{click}}}{H} \times \text{Span}$$
  This triggers a jump event to the calculated address, reloading the hex grid view.
- **Drag Interaction**: Dragging the slider thumb on the track recalculates the target address in real-time, scrolling the hex grid synchronously.

---

## Acceptance Criteria

- [ ] **Minimap Track Layout**: Renders a vertical high-density navigation column next to the standard hex viewport scrollbar.
- [ ] **Projection Verification**: Visual markers are precisely mapped to their relative pixel offsets according to their physical 64-bit addresses.
- [ ] **Interactive Scrolling**: Click or drag-to-scroll on the minimap track scrolls the memory viewport or triggers standard hex address alignment.
- [ ] **Design Density**: The markers use cohesive theme-harmonized HSL colors with micro-transitions on hover.
- [ ] **[Test]**: Unit test confirms coordinates mapping from physical addresses to pixel offsets.
