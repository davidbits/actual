---
name: Actual Budget
description: Local-first personal finance, built around envelope budgeting
# All color values are the light-theme palette mapping; dark and midnight
# remap the same semantic roles via `theme.*` tokens (see The Semantic Token Rule).
colors:
  actual-purple: '#8719e0'
  actual-purple-hover: '#a368fc'
  navy-ink: '#102a43'
  navy-slate: '#627d98'
  navy-mist: '#e8ecf0'
  navy-frost: '#f7fafc'
  page-text: '#272630'
  surface-white: '#ffffff'
  positive-green: '#147d64'
  negative-red: '#e12d39'
  link-blue: '#1980d4'
  warning-gold: '#b88115'
typography:
  # Font families below abbreviate the fallback stack in desktop-client/index.html.
  display:
    fontFamily: 'Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '30px'
    fontWeight: 600
  headline:
    fontFamily: 'Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '20px'
    fontWeight: 700
    letterSpacing: '0.5px'
  title:
    fontFamily: 'Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '15px'
    fontWeight: 500
  body:
    fontFamily: 'Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '16px'
    fontWeight: 400
  label:
    fontFamily: 'Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '13px'
    fontWeight: 400
rounded:
  sm: '4px'
  tableTop: '6px'
  sheet: '18px'
  pill: '999px'
spacing:
  xxs: '2px'
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
components:
  button-primary:
    backgroundColor: '{colors.actual-purple}'
    textColor: '{colors.surface-white}'
    rounded: '{rounded.sm}'
    padding: '5px 10px'
  button-primary-hover:
    backgroundColor: '{colors.actual-purple-hover}'
    textColor: '{colors.surface-white}'
  button-normal:
    backgroundColor: '{colors.surface-white}'
    textColor: '{colors.navy-ink}'
    rounded: '{rounded.sm}'
    padding: '5px 10px'
  input:
    backgroundColor: '{colors.surface-white}'
    textColor: '{colors.page-text}'
    rounded: '{rounded.sm}'
    padding: '5px'
---

# Design System: Actual Budget

## 1. Overview

This document combines design guidance with a summary of current components.
Rules describe how new work should behave, not a claim that every legacy
screen already complies. The application reads its values from
[tokens.ts](packages/component-library/src/tokens.ts),
[styles.ts](packages/component-library/src/styles.ts), and the
[theme definitions](packages/component-library/src/themes/source/colors.ts).
The frontmatter is documentation, not runtime configuration. `tableTop` above
describes `styles.tableContainer`; it is not a shared radius token.

**Creative North Star: "The Home Office"**

Actual feels like a tidy personal desk: familiar, unpretentious, everything within reach. It is a tool people open weekly for years to reconcile accounts and move envelope money around, so the interface optimizes for routine, not first impressions. Density is moderate-to-high (this is a table-driven app), feedback is instant, and decoration is close to zero. The financial numbers are the interface; everything else exists to keep them legible and trustworthy.

The system rejects fintech-startup gloss (gradient heroes, glassmorphism, crypto-dashboard neon) and corporate banking UI (navy-and-gold enterprise-portal density). Check new work in the built-in light, dark, and midnight themes, plus relevant custom-theme behavior.

**Key Characteristics:**

- Table-first layouts with tabular numerals everywhere money appears
- One accent (Actual Purple) used sparingly for primary actions and selection
- Semantic color tokens only; components never hardcode hex values
- Utilitarian, compact components built for daily repetition
- Flat-first surfaces; shadows reserved for transient overlays

## 2. Colors

A calm navy-neutral base with one confident purple accent and strict semantic roles for money.

Hex values below describe selected light-theme roles. Actual mappings live in
[colors.ts](packages/component-library/src/themes/source/colors.ts) and
[palette.ts](packages/component-library/src/themes/source/palette.ts). Dark,
midnight, and custom themes can use different values. Use `theme.*` tokens in
components, not the sample hexes. The redesigned sidebar has a separate
[light-theme override](packages/component-library/src/themes/sidebar-redesign-light.css).

### Primary

- **Actual Purple** (#8719e0): Primary button background and selected table borders in the light theme. Related purple shades serve navigation and other selections. Primary button hover uses **Lifted Purple** (#a368fc).

### Neutral

- **Navy Ink** (#102a43): Classic sidebar background and normal button text.
- **Page Ink** (#272630): Default body text on light surfaces.
- **Navy Slate** (#627d98): Light page text and subdued table text. Table headers use Navy 600 (#486581).
- **Navy Mist** (#e8ecf0): Page background, table borders, dividers.
- **Navy Frost** (#f7fafc): Hover rows, raised header rows.
- **Surface White** (#ffffff): Tables, cards, menus, modals.

### Tertiary (semantic money and status colors)

- **Positive Green** (#147d64): Positive amounts and funded budgets.
- **Negative Red** (#e12d39): Negative amounts, overspending, failures.
- **Link Blue** (#1980d4): Links and informational highlights.
- **Warning Gold** (#b88115): Underfunded templates, pending states.

### Named Rules

**The Semantic Token Rule.** New component colors should use the `theme.*`
semantic layer (`--color-*` custom properties). Palette references and raw
values belong in theme definitions, where per-theme behavior can be checked.

**The One Accent Rule.** Reserve accent color for primary actions, current
selection, and navigation. This is a design guideline, not a measured screen
coverage limit.

**The Never-Color-Alone Rule.** Positive/negative money state is conveyed by sign and context as well as color; green/red are reinforcement, never the only signal.

## 3. Typography

**Body Font:** Inter Variable (with platform font fallbacks)
**Label/Mono behavior:** Same family; financial figures switch on tabular OpenType features

The complete fallback stack and the `--font-family` override are defined in
[index.html](packages/desktop-client/index.html). Frontmatter abbreviates that
stack for readability.

**Character:** One workhorse sans at compact sizes. No display serif, no font pairing games: hierarchy comes from weight and size, and the typographic star is the number column.

### Hierarchy

- **Display** (600, 30px): Page-level headings and large balances. Rare.
- **Headline** (700, 20px, 0.5px letter-spacing): Section titles.
- **Title** (500, 15px): Emphasized in-table and card text.
- **Sheet title** (600, 18px): Centred title of a mobile bottom sheet. Mobile only.
- **Body** (400, 16px): Default text.
- **Label** (400, 13px): Table meta, menus, dense secondary text; 12px and 10px steps exist for the tightest spots.

### Standard Component Sizes

`Button`, `Text`, and `Input` accept `size`: `small` | `medium` | `large` |
`extra-large`, defined by `ComponentSize` in `tokens.ts`. `small` and `medium`
stay fixed; `large` and `extra-large` have responsive values. Breakpoint groups
are narrow <512, small 512–729, medium 730–1099, and wide ≥1100.

Text values (fontSize / lineHeight, px):

| Size        | narrow  | small   | medium  | wide    |
| ----------- | ------- | ------- | ------- | ------- |
| small       | 12 / 16 | 12 / 16 | 12 / 16 | 12 / 16 |
| medium      | 13 / 18 | 13 / 18 | 13 / 18 | 13 / 18 |
| large       | 16 / 22 | 15 / 20 | 15 / 20 | 15 / 20 |
| extra-large | 17 / 24 | 17 / 24 | 16 / 22 | 16 / 22 |

Framed Button values (paddingY / paddingX / min-height, px):

| Size        | narrow       | small       | medium      | wide        |
| ----------- | ------------ | ----------- | ----------- | ----------- |
| small       | 3 / 8 / 24   | 3 / 8 / 24  | 3 / 8 / 24  | 3 / 8 / 24  |
| medium      | 5 / 10 / —   | 5 / 10 / —  | 5 / 10 / —  | 5 / 10 / —  |
| large       | 8 / 12 / 36  | 6 / 12 / 32 | 6 / 12 / 32 | 6 / 12 / 32 |
| extra-large | 10 / 14 / 40 | 8 / 12 / 36 | 8 / 12 / 36 | 8 / 12 / 36 |

Inputs and bare buttons use the table's `paddingY` on **all** sides; framed
buttons use both padding columns. `size="medium"` uses 13px text, inherited
line-height, and no minimum height. Other control sizes apply the text scale's
line-height. `Text` with a size sets font size and line-height; without a size
it supplies neither by default.

At narrow width, `extra-large` controls have a 40px minimum height; `large`
controls have only 36px. For a 40px touch target, use `extra-large` or an
explicit minimum height. `small` remains 24px at every breakpoint.

### Named Rules

**The Tabular Number Rule.** Every standalone financial figure renders with `font-feature-settings: "tnum", "ss01", "ss04"` (via `FinancialText` or `styles.tnum`) so digits align in columns and disambiguate. A proportional-figure money column is a bug.

## 4. Elevation

Flat-first with ambient shadows. Structure comes from 1px borders (Navy Mist) and background shifts (White on Mist, Frost on hover), not depth. Shadows exist only to lift **transient** surfaces above the page: menus, tooltips, popovers, modals. Persistent surfaces like tables and cards sit flat or carry the faint card shadow at most.

### Shadow Vocabulary

- **Card** (`box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)`): Resting cards and small raised widgets.
- **Ambient** (`box-shadow: 0 2px 4px 0 rgba(0,0,0,0.1)`): Focused inputs, subtle lift.
- **Large** (`box-shadow: 0 15px 30px 0 rgba(0,0,0,0.11), 0 5px 15px 0 rgba(0,0,0,0.08)`): Tooltips, popovers, floating panels.

### Named Rules

**The Transient-Only Rule.** Prefer borders for persistent surfaces and reserve
large shadows for temporary overlays. Existing cards may use `cardShadow`.

## 5. Components

Utilitarian and quick: compact paddings, instant state feedback, built for daily repetition. All values below are the light theme; every color routes through the semantic token layer.

### Buttons

- **Shape:** Gently rounded (4px radius), compact padding (5px 10px)
- **Primary:** Actual Purple background, white text; hover lifts to Lifted Purple with a soft shadow transition (`box-shadow .25s`)
- **Normal:** White background, Navy Ink text, 1px theme border
- **Bare:** Transparent, 5px padding; background tint on hover/press. The workhorse for in-table actions

### Inputs / Fields

- **Style:** White background, 1px border, 4px radius, 5px padding
- **Focus:** Border switches to the selected accent; big inputs drop the border and take the ambient shadow instead
- **Big variant:** Without an explicit size, `BigInput` uses 10px padding and 15px text, but sets no minimum height. An explicit size uses the corresponding size scale instead.

### Cards / Containers

- **Corner Style:** 6px radius on table containers (top corners), 4px elsewhere; mobile bottom sheets use 18px top corners and a flat bottom edge
- **Background:** Surface White on Navy Mist page background
- **Shadow Strategy:** Card shadow at most; structure via 1px Navy Mist border
- **Internal Padding:** 16-20px

### Navigation

- **Classic sidebar:** Navy Ink background and light navy text; hover uses Navy 800, with purple selection tokens. Pending/positive/failed states use gold/green/red tokens.
- **Redesigned sidebar:** The built-in light theme uses a white surface and dedicated `sidebarRedesign*` tokens. Custom themes and CSS overrides can change these values.
- **Mobile:** Purple header, white nav bar, purple selected item
- **Mobile sheets:** Menus open as bottom sheets on the modal surface (`modalBackground`) with a grab handle in `pageTextSubdued` and hairline row dividers in `tooltipBorder`. Rows are full-width bare buttons, destructive rows in `errorText`, section labels in sentence case only when a sheet has two or more groups. Dismiss by swipe down, tap outside or Escape; no close button

### Pills / Chips

- **Style:** Editor pills: tinted background, 4px radius, 3px 5px padding. Used for rule conditions and inline tokens

### Signature Component: The Money Table

The core surface of the app. In the light theme: white rows, Navy Mist borders,
Frost hover, purple selection borders, and semantic table-header text. Money
columns should align tabular figures. Alternate-row striping is controlled
by theme tokens.

## 6. Do's and Don'ts

### Do:

- **Do** route every color through `theme.*` semantic tokens so light, dark, and midnight themes all work. Test all three.
- **Do** wrap standalone financial numbers in `FinancialText` or apply `styles.tnum`.
- **Do** keep components compact and quick: 4px radii, 5-10px paddings, instant hover/press states.
- **Do** reuse the existing component library (`@actual-app/components`) before writing new UI.
- **Do** keep Actual Purple scarce: primary action and selection only.
- **Do** respect breakpoints: 512px, 730px, and 1100px. Aim for mobile touch targets at least 40px tall; not every size preset guarantees that height.

### Don't:

- **Don't** use fintech-startup gloss: gradient heroes, glassmorphism, neon accents, crypto-dashboard styling (PRODUCT.md anti-reference).
- **Don't** use corporate banking UI patterns: navy-and-gold, enterprise-portal density, legalese energy (PRODUCT.md anti-reference).
- **Don't** hardcode hex values or raw `--palette-*` colors in components; the semantic layer is the only entry point.
- **Don't** rely on color alone for positive/negative amounts.
- **Don't** add large shadows to persistent surfaces; reserve them for transient overlays. Existing cards may use the small `cardShadow`.
- **Don't** use `border-left`/`border-right` thicker than 1px as a colored accent stripe.
- **Don't** animate layout properties; transitions are for color, opacity, and shadow (like the button's `box-shadow .25s`).
