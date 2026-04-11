---
title: Architecture - Visual Design
scope: architecture, visual-design, css, density, typography
audience: [Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-10
related:
  - ../architecture.md
  - ui-layer.md
---

# Visual Design Architecture

## 1. Guiding Principles

> **Guiding Principle: Flush IDE Layouts & Material Design 3 (M3)**
> When architecting the visual layer, we resolve the conflict between modern IDE aesthetics and default Material Design 3 (M3) paradigms through two core rules:
> 1. **Adopt M3 Colors, Reject M3 Shapes**: We fully adhere to M3's System Color Tokens (`--mat-sys-surface`, `--mat-sys-outline`) to ensure flawless Light/Dark mode transitions. Conversely, we aggressively strip away M3's default large rounded corners (`border-radius`) and floating shadows (`elevation`), forcing components back to the sharp, orthogonal geometries expected in professional developer tools.
>    * **Exception (Control Overlays & Toolbar Buttons)**: High-priority floating interaction capsules (e.g., the `DebugControlGroupComponent`) are explicitly exempt, using an `8px` container radius. All standalone toolbar buttons and internal interactive buttons use a `4px` radius to establish a distinct visual hierarchy against the sharp primary layer while maintaining micro-level shape consistency.
> 2. **Maximum Spatial Efficiency (Flush-fit)**: Zero-pixel margins and simple 1px dividers are mandated between side panels and the core editor. This edge-to-edge architecture eliminates wasted peripheral whitespace, maximizing the readable area for critical debugging data.

To optimize the reading experience across different usage contexts, the interface implements an environment-aware **UI Density Scale System** utilizing CSS Custom Properties combined with Angular components.

## 2. Responsive Density Scaling (Zero-JS Architecture)

**Mechanism**: The UI Density system is completely decoupled from the runtime environment and requires absolutely no manual CSS class binding (e.g., no `.ui-density-panel` states to manage).

Instead, it relies inherently on **CSS Media Queries (RWD)**. Both the Desktop and Web versions of the application utilize standard, comfortable layouts by default. When the viewport width drops below a predefined breakpoint (e.g., `800px`), the global CSS Custom Properties automatically scale down. This triggers an instant compression of structural padding, block gaps, and base body text to maximize information density in narrow layouts.

**Exception: Brand Visibility & Density Standards**:
- **Desktop Mode (Electron)**: The `.brand-title` is always disabled to prioritize horizontal space for file paths and debug controls.
- **WebApp Mode (Browser)**:
  - **Wide Screens (>= 800px)**: The `.brand-title` is visible.
  - **Compact Screens (< 800px)**: The `.brand-title` is disabled to maximize space for the debugger controls and file path in narrow viewports.

**CSS Custom Properties (Design Tokens)**
The global `styles.scss` defines root CSS variables representing dynamic spacing and dimensions:
- `--sys-density-toolbar-height`
- `--sys-density-panel-padding`
- `--sys-density-variable-row`
- `--sys-density-item-gap`
- `--sys-density-btn-size` / `--sys-density-btn-icon-size` (Standard sizes for standalone buttons)
- `--sys-density-btn-size-sm` / `--sys-density-btn-icon-size-sm` (Compact sizes for inner control capsules)
- `--text-base` *(overridden per density mode)*

The base `:root` values assume a comfortable layout constraint. Under `@media (max-width: 800px)`, these tokens are redefined to significantly compress physical dimensions, maximizing information density for confined screen real estate. Notably, button dimensions (`--sys-density-btn-size` and `-sm`) dynamically shrink to prevent layout overflow when parent container heights contract (e.g. `28px` buttons shrinking to `20px` to continuously fit inside a `24px` row).

**TypeScript Synchronization & Integration**
Select Angular CDK / Material components require TypeScript-level synchronization rather than pure CSS, particularly due to internal math and viewport estimations. Instead of checking the OS/Environment, components must use the Angular CDK `BreakpointObserver` matching the same `800px` threshold:
- **Virtual Scroll Computations**: `VariablesComponent` evaluates the viewport width via `BreakpointObserver` to dynamically bind the `[itemSize]` property. This guarantees that `cdk-virtual-scroll` height calculations precisely track the CSS `.variable-row` rendering height to prevent spatial jitter.
- **Material Tree Indentation**: `FileExplorerComponent` binds `[matTreeNodePaddingIndent]` dynamically (`8px` for narrow viewports vs `12px` for wide ones). This tightly constrains deep-nested folder structures from exhausting horizontal space.

## 3. Typography System

All UI type must use the tokens defined in `styles.scss`. The following table defines the **authoritative semantic mapping** and viewport-driven density scaling — hardcoding any font scalar is a style guide violation.

| Token | Semantic Usage | Wide (>=800px) | Compact (<800px) |
| :--- | :--- | :--- | :--- |
| `--text-xs` | Reserved for badges, chip labels, or peripheral metadata | `0.75rem` | `0.75rem` (fixed) |
| `--text-sm` | Status bar text, log timestamps, file tree secondary labels | `0.8125rem` | `0.8125rem` (fixed) |
| **`--text-base`** | **Default body text: log content, variable values, editor UI** | **`0.875rem`** | **`0.75rem`** |
| `--text-lg` | Panel section headers (Variables, Call Stack, Explorer) | `1rem` | `1rem` (fixed) |
| `--text-xl` | Toolbar title / app branding label | `1.125rem` | `1.125rem` (fixed) |
| `--text-2xl` | Reserved for empty-state headings or modal titles | `1.375rem` | `1.375rem` (fixed) |

> [!IMPORTANT]
> All derived typographic scale tokens (`--text-sm`,  etc.) are **ratio-fixed** in `styles.scss` and do **not** change per density — only `--text-base` shifts. Components that use `--text-sm` for timestamps or `--text-lg` for panel titles automatically inherit the density-appropriate visual weight by virtue of the base cascade.

**Authoritative Weight Semantics:**

| Token | Value | Semantic Usage |
| :--- | :--- | :--- |
| `--weight-regular` | 400 | Code content, log body text, file names, variable values |
| `--weight-medium` | 500 | Panel section titles (Variables, Call Stack), active tab labels |
| `--weight-bold` | 700 | Critical error badges, primary CTA buttons |

> [!CAUTION]
> **`font-weight: 600` (Semi-Bold) is explicitly rejected** from this design system. It falls outside the closed three-value token set and is not permitted in any component SCSS. Panel titles that require emphasis must use `--weight-medium` (500).

## 4. Spacing & Grid Rules

The UI adheres to an **8px base grid** as its canonical spacing modulus.

| Rule | Value | Notes |
| :--- | :--- | :--- |
| Base grid modulus | `8px` | All spacing values must be multiples of 4px or 8px |
| Panel internal padding | `12px` | Maps to `--sys-density-panel-padding`. Applied at content level. Container padding must be restricted to top-only (`padding-top`) to anchor content; lateral bounds must remain 0 to permit edge-to-edge separators. |
| Panel header bar height | `32px` (Desktop/Panel) | Fixed. Do NOT bind to `--sys-density-toolbar-height` (which is reserved exclusively for the top-level `mat-toolbar`). |
| Editor side margins | `0px` | The editor area must be flush with sidebars to maximize readability (§8.5) |
| File tree node indent | `16px` per level | Fixes readability regression for deep paths |

## 5. Divider & Border Standards

All panel boundaries and section dividers must use **Material Design system tokens**, not hardcoded color values. This ensures correct behavior in both light and dark themes.

| Rule | Required Token / Spec |
| :--- | :--- |
| **Sidebar Shapes** | `border-radius: 0 !important` (Enforce sharp IDE geometries) |
| **Section Dividers** | `1px solid var(--mat-sys-outline-variant)` |
| **Tool Window Headers** | `surface-container-high` background, Uppercase typography |
| **Unified Highlight** | `primary-container` background + `4px primary` left accent |
| **Active Alignment** | `padding-left: calc(var(--sys-density-panel-padding) - 4px)` |
| **Forbidden** | Hardcoded hex/rgba values for borders or backgrounds |

## 6. Component-Specific Layout Rules

### 6.1 Editor Component Rules

These rules govern the Monaco Editor integration in `EditorComponent`.

| Rule | Specification | Priority |
| :--- | :--- | :--- |
| **Opaque overlay removal** | Any non-transparent overlay `div` or backdrop obscuring the code area must be eliminated | 🔴 Critical (Bug Fix) |
| **Execution line highlight** | Background must use an `rgba`-based semi-transparent tint (opacity ≤ 0.12) applied via `deltaDecorations` | High |
| **Highlight z-index** | The decoration layer's `z-index` must be positioned **below** the text rendering layer. Using inline style or className decoration that creates a new stacking context above text is forbidden | High |
| **Scrollbar Consistency** | Monaco's built-in scrollbar must be configured and CSS-forced to visually mimic the global `::-webkit-scrollbar` (14px track, 6px thumb, constant opacity, no shadows) to prevent behavioral drift from the native panels | High |

### 6.2 Right Panel (Variables & Call Stack) Rules

| Element | Rule |
| :--- | :--- |
| Side-to-Side Flush | The editor area and sidebars must have **zero external margins** between them. |
| Edge-to-Edge Separator | `border-bottom` on panel titles must span the full 100% width of the sidebar. |
| Content Padding | Individual content items (Variable rows, Call Stack frames) must implement internal `--sys-density-panel-padding` to prevent text from touching edges. |
| Section title spacing | Minimum `8px` vertical padding between the title separator and the first data row. |
| Variable name color | Must use `var(--mat-sys-on-surface)` (primary foreground — typically dark) |
| Variable value color | Must use `var(--mat-sys-primary)` (Material primary accent — typically blue/teal) |
| Value color fallback | Never hardcode hex/rgb values for variable name or value text |

### 6.3 Logs & Output (LogViewerComponent) Rules

| Property | Rule | Rationale |
| :--- | :--- | :--- |
| Log row line-height | `line-height: 1.5` (unitless ratio) | Eliminate visual crowding in high-frequency log output |
| Timestamp color | `color: var(--mat-sys-outline)` | De-emphasize timestamps; direct focus to message content |
| Log content font | `font-family: var(--font-mono)` | Monospaced for DAP protocol data readability |
| Timestamp font size | `font-size: var(--text-sm)` | Smaller than body to reinforce visual hierarchy |

### 6.4 Side Panel Navigation (File Explorer & Call Stack)

| Feature | Requirement |
| :--- | :--- |
| **Auto-Revelation** | The file tree MUST automatically expand parent nodes and `scrollIntoView` the active file on every execution stop or manual frame click. |
| **Highlight Strategy** | Use `border-left` directly on the item container. Using `::before` pseudo-elements is discouraged for MDC-based components to avoid layering conflicts. |
| **Transition** | `background-color 0.2s ease` on hover/active states for smooth visual feedback. |
