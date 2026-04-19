---
title: Architecture - Visual Design
scope: architecture, visual-design, css, density, typography
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-12
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
* **Desktop Mode (Electron)**: The `.brand-title` is always disabled to prioritize horizontal space for file paths and debug controls.
* **WebApp Mode (Browser)**:
  * **Wide Screens (>= 800px)**: The `.brand-title` is visible.
  * **Compact Screens (< 800px)**: The `.brand-title` is disabled to maximize space for the debugger controls and file path in narrow viewports.

**CSS Custom Properties (Design Tokens)**
The global `styles.scss` defines root CSS variables representing dynamic spacing and dimensions:
* `--sys-density-toolbar-height`
* `--sys-density-panel-padding`
* `--sys-density-variable-row`
* `--sys-density-item-gap`
* `--sys-density-btn-size` / `--sys-density-btn-icon-size` (Standard sizes for standalone buttons)
* `--sys-density-btn-size-sm` / `--sys-density-btn-icon-size-sm` (Compact sizes for inner control capsules)
* `--text-base` *(overridden per density mode)*

The base `:root` values assume a comfortable layout constraint. Under `@media (max-width: 800px)`, these tokens are redefined to significantly compress physical dimensions, maximizing information density for confined screen real estate. Notably, button dimensions (`--sys-density-btn-size` and `-sm`) dynamically shrink to prevent layout overflow when parent container heights contract (e.g. `28px` buttons shrinking to `20px` to continuously fit inside a `24px` row).

**TypeScript Synchronization & Integration**
Select Angular CDK / Material components require TypeScript-level synchronization rather than pure CSS, particularly due to internal math and viewport estimations. Instead of checking the OS/Environment, components must use the Angular CDK `BreakpointObserver` matching the same `800px` threshold:
* **Virtual Scroll Computations**: `VariablesComponent` evaluates the viewport width via `BreakpointObserver` to dynamically bind the `[itemSize]` property. This guarantees that `cdk-virtual-scroll` height calculations precisely track the CSS `.variable-row` rendering height to prevent spatial jitter.
* **Material Tree Indentation**: `FileExplorerComponent` binds `[matTreeNodePaddingIndent]` dynamically (`8px` for narrow viewports vs `12px` for wide ones). This tightly constrains deep-nested folder structures from exhausting horizontal space.

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

### 5.1 Sidenav Border Authority Rules

> [!IMPORTANT]
> The following rules prevent recurring double-border and visual-gap bugs that arise from the interaction between Angular Material's `mat-sidenav` internal styles and the application's custom layout CSS.

| Rule | Specification |
| :--- | :--- |
| **Single Border Source** | The vertical separator between a sidenav and the main content MUST be declared only on the **sidenav container** (`.sidenav-left`, `.sidenav-right`), NOT on internal child elements (e.g., `.header-title-row`, `.panel-title`). Declaring `border-right/left` on both the container and a child element causes a double-border visual artifact. |
| **Override Requirement** | Angular Material's `.mat-drawer` applies its own `border` styles with high specificity. All sidenav border overrides MUST use `!important` to guarantee application. |
| **Panel Title `border-top`** | `.panel-title` elements MUST NOT have `border-top`. The top boundary of a sidenav is owned exclusively by the sidenav container's `border-top`. Adding `border-top` to `.panel-title` creates asymmetric 1px gaps. |
| **Horizontal Alignment** | All panel header bars (`.panel-title`, `mat-tab-header`, `.sidenav-header .header-title-row`) MUST share a fixed height of `32px` and render their bottom border at the exact same Y-coordinate. Do NOT mix `border-top` on some elements but not others in the same horizontal strip. |
| **Negative Margin Prohibition** | Using `margin-top: -1px` on sidenavs to absorb a 1px gap is fragile and produces asymmetric rendering at non-integer device pixel ratios. Instead, ensure the toolbar's `border-bottom` and the sidenav's `border-top` share the same token so browsers resolve the overlap deterministically. |

## 6. Component-Specific Layout Rules

### 6.1 Editor Component Rules

These rules govern the Monaco Editor integration in `EditorComponent`.

| Rule | Specification | Priority |
| :--- | :--- | :--- |
| **Opaque overlay removal** | Any non-transparent overlay `div` or backdrop obscuring the code area must be eliminated | 🔴 Critical (Bug Fix) |
| **Execution line highlight** | Background must use an `rgba`-based semi-transparent tint (opacity ≤ 0.12) applied via `deltaDecorations` | High |
| **Gutter Highlight Sync** | The `current-line-highlight` CSS class is applied by Monaco only to `.view-lines`, NOT to `.margin-view-overlays` (the gutter). A companion rule `.monaco-editor .margin-view-overlays .current-line-highlight` MUST be declared inside `::ng-deep` to extend the highlight into the gutter, preventing a grey background leak on the active line. | High |
| **Highlight z-index** | The decoration layer's `z-index` must be positioned **below** the text rendering layer. Using inline style or className decoration that creates a new stacking context above text is forbidden | High |
| **Scrollbar Consistency** | Monaco's built-in scrollbar must be configured and CSS-forced to visually mimic the global `::-webkit-scrollbar` (14px track, 6px thumb, constant opacity, no shadows) to prevent behavioral drift from the native panels | High |
| **No external border** | `EditorComponent`'s host `.editor-container` MUST NOT declare a `border` property. When placed inside `mat-tab-body` (which provides a flush layout), any border on the editor container creates a visible 1px margin gap inconsistent with adjacent borderless components (e.g., `AssemblyViewComponent`). The panel separation is the responsibility of the parent `mat-sidenav` container. | High |

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
| **Console Panel Separator** | `.consoles-container` MUST declare `border-top: 1px solid var(--mat-sys-outline-variant)`. Relying on background-color contrast alone is insufficient and breaks the global horizontal divider language. | Consistent panel separation |

### 6.4 Side Panel Navigation (File Explorer & Call Stack)

| Feature | Requirement |
| :--- | :--- |
| **Auto-Revelation** | The file tree MUST automatically expand parent nodes and `scrollIntoView` the active file on every execution stop or manual frame click. |
| **Highlight Strategy** | Use `border-left` directly on the item container. Using `::before` pseudo-elements is discouraged for MDC-based components to avoid layering conflicts. |
| **Transition** | `background-color 0.2s ease` on hover/active states for smooth visual feedback. |

### 6.5 Status Bar Layout Rules

The status bar is a fixed-height single-line flex container. The following rules prevent text wrapping and content truncation bugs.

| Rule | Specification |
| :--- | :--- |
| **Single-line enforcement** | `.status-bar` MUST declare `flex-wrap: nowrap` and `overflow: hidden`. Without `flex-wrap: nowrap`, flex children can wrap onto a second line when the viewport is narrow, causing the container's fixed height to clip wrapped content. |
| **Truncation Priority** | Informational metadata (e.g., server address) MUST truncate before critical state labels. Apply `flex-shrink: 0; white-space: nowrap` to high-priority elements (connection state, execution state). Apply `min-width: 0; overflow: hidden; text-overflow: ellipsis` to low-priority elements (server address). |

## 7. SCSS & `::ng-deep` Usage Policy

`::ng-deep` is **deprecated** in Angular and must be treated as a **last resort**, not a default solution.

**Permitted only when ALL of the following conditions are met:**
1. The target CSS class is an Angular Material internal class (e.g., `.mat-mdc-*`) with **no corresponding CSS Custom Property** exposed by the library.
2. The override is required for **structural layout** (flex growth, height propagation), not for cosmetic changes (colors, fonts, spacing).
3. Every `::ng-deep` selector **must** be prefixed with `:host &` to constrain the style penetration to the current component's subtree only.

```scss
// ✅ Correct: scoped, justified, documented
:host & ::ng-deep .mat-mdc-tab-body-wrapper {
  flex: 1;
  min-height: 0; // Required for flex shrink to work correctly
}

// ❌ Forbidden: unscoped, will leak to all instances globally
::ng-deep .mat-mdc-tab-body-wrapper {
  flex: 1;
}

// ❌ Forbidden: use for cosmetic overrides (use CSS variables instead)
:host & ::ng-deep .mat-mdc-tab-label {
  font-size: 12px;
}
```

**Preferred alternatives (in priority order):**
1. **Angular Material CSS Custom Properties** — check the component's theming API first (e.g., `--mat-tab-header-active-label-text-color`).
2. **Layout restructuring (Method D)** — if the child component is sized via `position: absolute; inset: 0`, Material internals may inherit height without `::ng-deep`.
3. **Global `styles.scss` with precise host selector** — use `app-my-component .mat-mdc-*` if the component is used in only one known context.
4. **`::ng-deep` with `:host &` scope** — only if all alternatives above are not viable.

**Mandatory comment**: Every permitted `::ng-deep` usage must include an inline comment explaining why no alternative exists:

```scss
// Material does not expose a CSS variable for .mat-mdc-tab-body-wrapper
// flex growth — ::ng-deep required to propagate height through tab internals.
:host & ::ng-deep .mat-mdc-tab-body-wrapper {
  flex: 1;
}
```

## 8. Tabbed Panel Navigation (Modern IDE Style)

To achieve a professional "Flush IDE" aesthetic, all `mat-tab-group` instances — including the **main editor tabs** (Source/Disassembly) and the **console/output tabs** (Debug Console/Output) — must be configured to resemble a native editor tab bar rather than standard Material navigation.

> [!IMPORTANT]
> These rules apply to **all tab groups** in the application. When adding a new `mat-tab-group`, it must implement this specification by default.

### 8.1 Universal Tab Rules

| Rule | Specification | Rationale |
| :--- | :--- | :--- |
| **Alignment** | `justify-content: flex-start` on `.mat-mdc-tab-labels` | VS Code / IntelliJ standard. Prevents tabs from stretching to fill the full header width. |
| **Sizing** | `flex: 0 1 auto !important` on `.mat-mdc-tab` | Tab width is content-determined. Set a `min-width` appropriate for the context (editor: `100px`, console: `80px`). |
| **Indicator Removal** | `display: none` on `.mat-mdc-tab-indicator`, `.mdc-tab-indicator`, `.mdc-tab-indicator__content` | Disables the default Material bottom ink-bar. Set `--mat-tab-header-active-indicator-color: transparent` (no `!important`) as a secondary guard. |
| **Vertical Grid** | Header: `height: 32px; box-sizing: border-box`. Tabs: `height: 32px; box-sizing: border-box` | All heights are identical at 32px. Active state uses `z-index: 1` only — **no `margin-top: -1px`** (§5.1 Negative Margin Prohibition). |
| **Typography** | `text-transform: uppercase; letter-spacing: 0.8px; font-size: var(--text-sm); font-weight: var(--weight-medium)` | Matches the `.panel-title` weight to maintain a unified header strip across all panels. |
| **Tab Dividers** | `border-right: 1px solid var(--mat-sys-outline-variant)` on each tab | Provides visual separation between tabs without the need for the ink-bar. |
| **Hover State** | `background-color: var(--mat-sys-surface-container-highest)` on `:hover:not(.mdc-tab--active)` | Consistent with the tree-node and variable-row hover patterns. |

### 8.2 Context-Specific Active State (Surface Fusion)

The **active tab** must visually "fuse" with its content area by matching the content area's background color. This creates a physical metaphor where the tab is the "open" state of the panel below.

| Context | Active Tab Background | Content Area Background |
| :--- | :--- | :--- |
| **Main Editor** (Source / Disassembly) | `var(--mat-sys-surface)` | Monaco Editor / Assembly View background |
| **Console / Output** | `var(--mat-sys-surface-container-low)` | `.console-viewport` background |
