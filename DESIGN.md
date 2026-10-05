---
name: Manifest
description: A bounded migration workspace with evidence for every step.
colors:
  form: "#087f72"
  form-strong: "#06685e"
  form-tint: "#eaf5f2"
  ground: "#f7f8fa"
  paper: "#ffffff"
  paper-sunk: "#f8f9fb"
  ink: "#20252c"
  ink-2: "#4b5563"
  muted: "#626d7b"
  rule: "#dfe3e8"
  rule-soft: "#edf0f3"
  action-ink: "#ffffff"
  violet: "#5b2c93"
  violet-tint: "#f0e9fa"
  red: "#b3261e"
  red-tint: "#fde7e5"
  amber: "#7a5200"
  amber-tint: "#fff3c9"
  green: "#17663f"
  green-tint: "#e2f2e8"
  dark-form: "#71d6bd"
  dark-form-strong: "#9de8d3"
  dark-form-tint: "#203830"
  dark-ground: "#14171b"
  dark-paper: "#1b1f24"
  dark-paper-sunk: "#181c21"
  dark-ink: "#edf0f3"
  dark-ink-2: "#bdc5cf"
  dark-muted: "#9ca7b5"
  dark-rule: "#343b44"
  dark-rule-soft: "#2a3038"
  dark-action-ink: "#14171b"
  dark-violet: "#c4a6f2"
  dark-violet-tint: "#2a1f42"
  dark-red: "#ff8f85"
  dark-red-tint: "#3b1a1d"
  dark-amber: "#f1cf72"
  dark-amber-tint: "#352b10"
  dark-green: "#7fd7a5"
  dark-green-tint: "#11301f"
typography:
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  evidence:
    fontFamily: '"Martian Mono", ui-monospace, "SFMono-Regular", monospace'
    fontSize: "12px"
rounded:
  control: "6px"
  section: "10px"
  dialog: "12px"
  status: "5px"
  record: "2px"
spacing:
  compact: "8px"
  control: "14px"
  section: "20px"
  stack: "24px"
  desktop-gutter: "32px"
components:
  button-primary:
    backgroundColor: "{colors.form}"
    textColor: "{colors.action-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.form-strong}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  button-clearance:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  button-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.red}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  section:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.section}"
  status-held:
    backgroundColor: "{colors.red-tint}"
    textColor: "{colors.red}"
    rounded: "{rounded.status}"
    padding: "3px 7px"
  navigation-active:
    backgroundColor: "{colors.form-tint}"
    textColor: "{colors.form-strong}"
    padding: "10px 12px"
---

# Design System: Manifest

## Overview

**Creative North Star: "The Migration Workspace"**

Manifest uses the familiar control grammar of Linear navigation and Supabase data interfaces. Neutral surfaces, restrained borders and teal actions frame dense evidence. Archivo explains tasks; Martian Mono identifies values an operator compares or traces.

The bounded workbench keeps one source, one target and at most 1,000 records visible. Plans remain immutable, dry runs persist, and approval binds to the exact plan hash and dry-run evidence. Retry, reconciliation and rollback retain their existing lifecycle behavior. [PRODUCT.md](PRODUCT.md) owns product scope; [the surface brief](apps/web/.impeccable/surfaces/apps-web.md) owns composition. [globals.css](apps/web/app/globals.css) is the implemented token source.

**Key Characteristics:**

- Familiar workspace navigation and native controls.
- Neutral light and dark surfaces with teal actions.
- Compact tables and inspectable evidence.
- Persistent bottom operator controls.
- Status expressed through text and shape as well as color.

## Colors

Cool neutral surfaces frame a focused teal accent and separate semantic status colors. Frontmatter records light tokens and their dark counterparts; CSS applies both through the same semantic custom properties.

### Primary

- **Workspace Teal**: primary actions, selected navigation, links and focus. Strong and tinted variants provide hover and selection. Action ink contrasts with teal in both themes.

### Secondary

- **Approval Violet**: human clearance and approval.
- **Held Red**: held records, errors and destructive actions.
- **Attention Amber**: drafts, unresolved decisions and hints.
- **Verified Green**: successful loads and matched totals.

### Neutral

- **Ground**: background around sections.
- **Paper**: sections, forms, dialogs and bottom dock.
- **Inset Surface**: rail, evidence readouts and secondary data areas.
- **Primary, Secondary and Quiet Ink**: values, supporting content and metadata.
- **Structural and Soft Rules**: component boundaries and internal separators.

**The Evidence State Rule.** Color supports a written state and a distinct mark or pattern; it never carries record status alone.

## Typography

**Display and Body Font:** Archivo, with system sans-serif fallbacks.

**Evidence Font:** Martian Mono, with monospace fallbacks.

The hierarchy is compact and operational. Page titles provide the strongest hierarchy; section titles stay close to body size. Fonts are served through next/font. Tabular numerals support comparisons.

### Hierarchy

- **Headline**: page titles; reduces to (25px) on phones.
- **Title**: section headings with restrained tracking.
- **Body**: explanations and data; title descriptions use (13px) and a maximum measure of (68ch).
- **Label**: compact controls; supporting metadata generally uses (10–12px).
- **Evidence**: IDs, timestamps, hashes and transform traces; dense preformatted evidence uses (11.5px) with line-height (1.65).

**The Two Voices Rule.** Use Archivo to explain an action and Martian Mono to show the evidence behind it.

## Layout

Desktop uses a fixed neutral rail (224px), grouped into Workspace, Migration and Monitor. The content container is capped at (1,440px), with page gutters (32px), section gaps (24px) and common section body padding (20px). Dense tables scroll within their containers.

At (1,100px), overview records and workflow stack. At (900px), the rail becomes sticky horizontal navigation and content gutters become (18px). At (640px), the brand becomes a compact symbol, endpoints stack vertically, mapping rows become labeled blocks and the dock uses two rows. Smaller data grids reflow at (480px).

The bottom dock persists operator identity, recent runs, New test and theme controls. On phones, the name input and theme occupy the first row, with Your runs and New test beneath. The name field retains “Enter your name.” History opens above the whole dock. Pages reserve bottom padding (100px) on desktop and (140px) on phones.

**The Reachable Evidence Rule.** Fixed controls must leave the last row, action and keyboard focus reachable above the dock.

## Elevation & Depth

Content sections are flat at rest. Thin borders and neutral tonal layers establish structure. Floating history uses the theme-aware shadow; dialogs use a stronger shadow, dimmed backdrop and slight blur.

### Shadow Vocabulary

- **History menu**: the light and dark shadow definitions in the stylesheet.
- **Dialog**: `0 30px 80px -20px rgb(0 0 0 / 0.45)` for modal decisions and evidence.

**The Floating Layer Rule.** Shadows separate temporary overlays from the workspace; ordinary sections rely on rules and tone.

## Shapes

Controls use modest corners; sections use broader corners; dialogs use the largest shared radius. Status chips and record cells have their own smaller radii in frontmatter. Navigation links use (7px) corners; history uses (9px). Standard boundaries are thin (1px) rules. Solid, dashed, hatched, struck and ring marks distinguish states alongside text.

## Components

### Buttons

Compact actions have minimum height (36px). Primary uses teal; secondary uses a neutral surface and rule; approval uses violet; destructive actions use red outlines. Hover shifts the relevant surface or accent; keyboard focus uses a visible teal outline (2px). Disabled controls use inset surfaces and muted text. Pressed buttons move down (1px).

### Chips

Small sentence-case status labels pair semantic text and tint with a distinct mark. Held states use hatching, pending states use dashed marks and running states use a ring. A chip reports stored state.

### Cards / Containers

Flat bordered sections have divided headers, padded bodies and optional metadata footers. Tables use soft row separators and restrained hover tints. Avoid turning every field or count into a floating card.

### Inputs / Fields

Native inputs, selects and textareas use the control radius and a thin rule. Hover strengthens the border; focus remains visible. Operator identity has a group focus outline and descriptive placeholder. Structured text uses mono; errors include readable text.

### Navigation

Lucide icons accompany plain labels. Selected links use teal tint, stronger teal text and increased weight. Responsive navigation scrolls horizontally and preserves full accessible names and aria-current.

### Connected Migration Path

Source and target share a bordered section and connecting line with an arrow. A neutral source and teal target communicate direction. Bounds and target context sit in an inset facts row. The connection turns vertically when endpoints stack.

### Record Map and Workflow

Each source record has a cell: dashed before inspection, solid when accepted, hatched when held and separately marked when landed. Held cells are native buttons opening field-level evidence with pointer or keyboard activation. Counts, legend, live readout and accessible text supplement the map. Landed state uses the transformed target key.

The seven-step workflow derives progress from persisted plans, runs and approvals. Keep the next action beside the page title and distinguish newer drafts from older approved versions. Recent runs link to their kind, version, operator, counts and status evidence.

### Motion and Accessibility

Short eased state changes support feedback. Record cells enter with a brief stagger; dialogs and notices use restrained entry motion. Reduced motion removes delays and reduces transitions and animations to (1ms). Preserve the skip link, native dialogs, visible focus and descriptive names in both themes.

## Do's and Don'ts

### Do:

- **Do** use semantic custom properties to align light and dark themes.
- **Do** pair record states with text and distinguishable shapes or patterns.
- **Do** show versions, hashes and persisted evidence beside consequential actions.
- **Do** keep operator controls at the bottom and reserve space above them.
- **Do** preserve native keyboard controls and reduced-motion behavior.

### Don't:

- **Don't** restore the discarded customs-declaration styling or ornamental stamp language.
- **Don't** imply that accepted records have already landed.
- **Don't** obscure evidence behind decoration or unsupported claims.
- **Don't** let the dock cover history, final rows or focused actions.
