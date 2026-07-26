---
name: readion
version: alpha
description: Design system for Readion, the certification exam prep app. Dark-mode-first, clean and minimal — low visual noise to keep the learner focused on content.

colors:
  background:
    base: "#0f172a"
    surface: "#1e293b"
    elevated: "#0a0f1e"
    overlay: "#16213e"
  primary:
    default: "#1d4ed8"
    hover: "#1e40af"
    muted: "#1e40af"
    subtle: "#334155"
  accent:
    label: "#7c8cf8"
    labelMuted: "#93c5fd"
    gradient: "#4f46e5"
  text:
    primary: "#e2e8f0"
    secondary: "#94a3b8"
    muted: "#64748b"
    subtle: "#475569"
  status:
    poor: "#f87171"
    warning: "#fb923c"
    medium: "#fbbf24"
    good: "#34d399"
  border:
    default: "#1e293b"
    strong: "#334155"

typography:
  base:
    fontFamily: "Inter, ui-sans-serif, system-ui"
    fontSize: "14px"
    fontWeight: "400"
    lineHeight: "1.5"
  heading:
    fontFamily: "Inter, ui-sans-serif, system-ui"
    fontSize: "20px"
    fontWeight: "700"
    lineHeight: "1.25"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui"
    fontSize: "11px"
    fontWeight: "500"
    lineHeight: "1"
    textTransform: "uppercase"
    letterSpacing: "0.1em"
  readinessScore:
    fontFamily: "Inter, ui-sans-serif, system-ui"
    fontSize: "28px"
    fontWeight: "700"
    lineHeight: "1"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: "400"
    lineHeight: "1.6"

rounded:
  sm: "3px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"

components:
  certCardHero:
    backgroundColor: "linear-gradient(135deg, {colors.primary.default}, {colors.accent.gradient})"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  certCard:
    backgroundColor: "{colors.background.surface}"
    textColor: "{colors.text.primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  quizOption:
    backgroundColor: "{colors.background.base}"
    textColor: "{colors.text.secondary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  quizOptionSelected:
    backgroundColor: "{colors.primary.default}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  agentPanel:
    backgroundColor: "{colors.background.elevated}"
    textColor: "{colors.text.primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  agentBubbleUser:
    backgroundColor: "{colors.background.surface}"
    textColor: "{colors.text.secondary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  agentBubbleAssistant:
    backgroundColor: "{colors.primary.default}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  readinessChip:
    backgroundColor: "{colors.primary.default}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  weakAreaBadgePoor:
    backgroundColor: "transparent"
    textColor: "{colors.status.poor}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  weakAreaBadgeWarning:
    backgroundColor: "transparent"
    textColor: "{colors.status.warning}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  weakAreaBadgeMedium:
    backgroundColor: "transparent"
    textColor: "{colors.status.medium}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  weakAreaBadgeGood:
    backgroundColor: "transparent"
    textColor: "{colors.status.good}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

## Overview

The learning tool design system is dark-mode-first and intentionally minimal. The goal is to keep learners focused on content — not on the UI around it. Visual decoration is used sparingly; colour carries meaning (status, hierarchy, urgency) rather than decoration.

The system is built on top of Nuxt UI and TailwindCSS. Design tokens defined here map directly to TailwindCSS custom properties and Nuxt UI theme overrides.

## Colors

The palette uses Tailwind Slate for backgrounds and neutrals, with a Blue/Indigo primary for interactive elements and the hero cert card gradient.

**Background layers** create depth without borders: `base` (#0f172a) is the page background, `surface` (#1e293b) is used for cards and panels, `elevated` (#0a0f1e) is for the sidebar and recessed areas, and `overlay` (#16213e) is for navigation bars.

**Status colours** map directly to weak area scores and are used consistently throughout the app — red for poor (< 50%), orange for warning (50–65%), yellow for medium (65–80%), green for good (> 80%). Never use status colours for decoration.

**Primary** (#1d4ed8) is used for CTAs, selected states, and the agent chat assistant bubbles. The gradient from primary to accent (#4f46e5) is reserved for the hero certification card only.

### Semantic tokens and color modes

Dark mode is the default presentation, but dark and light are equally supported product modes. Frontend code must use the `--readion-*` semantic tokens (and their `readion-*` utility aliases) for backgrounds, borders, text, focus, status, and interaction states. Fixed Slate, white, or black utilities are permitted only for deliberately invariant artwork whose contrast has been verified in both modes; they must not encode ordinary UI meaning.

Token names describe purpose, not a particular hex value. Use the background layers (`background-base`, `background-surface`, `background-elevated`, `background-overlay`), text hierarchy (`text-primary`, `text-secondary`, `text-muted`, `text-subtle`, `text-on-primary`), border hierarchy, primary and danger interaction states, status tones, warning, and focus tokens. A mode switch changes token values at the document root and persists the user's choice; components must not branch on the mode.

| semantic role | dark | light |
|---|---:|---:|
| background base / surface / elevated / overlay | `#0f172a` / `#1e293b` / `#0a0f1e` / `#16213e` | `#f8fafc` / `#ffffff` / `#e2e8f0` / `#f1f5f9` |
| text primary / secondary / muted / subtle | `#e2e8f0` / `#94a3b8` / `#64748b` / `#475569` | `#0f172a` / `#334155` / `#475569` / `#64748b` |
| text on primary | `#ffffff` | `#ffffff` |
| primary / hover / active | `#1d4ed8` / `#1e40af` / `#1e3a8a` | same semantic values |
| danger / hover / active | `#b91c1c` / `#991b1b` / `#7f1d1d` | same semantic values |
| border default / strong | `#1e293b` / `#334155` | `#cbd5e1` / `#94a3b8` |
| accent label | `#7c8cf8` | `#4338ca` |
| focus | `#60a5fa` | `#2563eb` |
| poor / warning / medium / good | `#f87171` / `#fb923c` / `#fbbf24` / `#34d399` | `#b91c1c` / `#c2410c` / `#a16207` / `#047857` |

The danger tokens carry destructive intent; do not reuse the poor status tone for destructive controls, or the primary tone for a destructive confirmation. Accent label is the hover-border and label accent, and is the one token whose light value is a deliberately different hue rather than a lightness inversion.

The token values live in `apps/web/app/assets/css/main.css` (document-root custom properties and their Tailwind aliases) and `apps/web/app/design/tokens.ts` (the typed source the theme tests assert against); `useReadionColorMode` owns the root `dark`/`light` class and the persisted preference, defaulting to dark when nothing is stored. Define a new token in the dark block, the light block, and the typed map together — a value present in dark but missing in light silently falls back and breaks contrast.

Normal-size text must have at least 4.5:1 contrast against its rendered background. Large text and essential non-text indicators, including borders that communicate state and focus indicators, must have at least 3:1 contrast. Disabled controls may be visually muted, but their label and unavailable state must remain understandable. Validate computed rendered pairs in both modes rather than assuming that a token name guarantees contrast.

## Interaction states

Every primary, secondary, destructive, toggle, and icon control has a complete state contract:

- **Rest** communicates role and hierarchy without implying selection or progress.
- **Hover** changes a semantic surface, border, or text color.
- **Active/pressed** provides immediate in-place feedback, such as a stronger surface or a small transform, without moving surrounding layout.
- **Focus-visible** uses the Readion focus token, clears nearby clipping, and reaches at least 3:1 contrast.
- **Disabled** is unavailable and muted; it does not show a spinner, progressive copy, or `aria-busy`.
- **Selected** is visually distinct and exposes `aria-pressed`, `aria-selected`, `aria-checked`, `aria-current`, or the equivalent native state.
- **Busy** identifies only the accepted action, exposes `aria-busy="true"`, rejects duplicate activation, and shows a spinner with operation-specific copy such as “Starting…”, “Saving…”, “Adding…”, “Approving…”, or “Deleting…”.

Busy and resting labels share a stable layout footprint. Controls must not change width, height, or the position of adjacent content when progress begins. Routine feedback transitions use color, border, opacity, or an in-place transform and complete in approximately 120–180ms. Under `prefers-reduced-motion: reduce`, remove non-essential transforms, animated spinners, and transitions while retaining a distinguishable state.

Mutation state is action-local. In a row with adjacent actions, only the initiating action shows its busy identity; conflicting actions may be disabled but must not impersonate it. Guard the handler as well as the visual control so repeated pointer, keyboard, or programmatic activation cannot submit a duplicate non-idempotent request. Preserve user input and surrounding evidence on failure. Announce successful non-destructive outcomes politely and destructive failures assertively.

New controls inherit this contract from `ReadionButton` (`variant`: `primary` | `secondary` | `destructive` | `toggle` | `icon`, plus `busy`, `busyLabel`, `selected`, `statusMessage`, `statusTone`) rather than restating state classes per page. It renders resting and busy labels in the same grid cell so the footprint is stable, and disables itself while busy. Controls that cannot use the component still carry the `readion-interactive-control` class, which supplies the reduced-motion overrides.

## Asynchronous regions

Every HTTP-backed region explicitly and exclusively represents these states:

- **Initial loading** — bounded skeleton or status placeholder with `aria-busy="true"`; no content, success, or empty copy is shown yet.
- **Content** — the last successful non-empty result.
- **Empty** — shown only after a successful response establishes that no content exists.
- **Error + Retry** — concise, section-local failure copy and a Retry action that issues one read per activation.
- **Background refresh** — preserves the last successful content and exposes non-blocking progress instead of replacing content with an initial skeleton.

Mutations use the control-level busy contract rather than replacing a whole successfully loaded region. A mutation error stays next to the initiating action and leaves that action explicitly retryable. Status announcements use `role="status"` or `aria-live="polite"` for normal progress and completion, and `role="alert"` for destructive or blocking failures.

`ReadionAsyncRegion` implements the five states as one exclusive machine driven by `loading`, `error`, `empty`, and `refreshing`, with a `retry` event and slots for section-specific skeleton, error, empty, and content markup. Prefer it over page-local branching so a region cannot accidentally show empty copy before its first successful response. Sibling regions own their own state: one failing read must not blank a successfully loaded neighbour.

## Modal behavior and focus

Opening a modal stores the opener and moves focus to the first meaningful control or field; the backdrop is never the initial focus target. Tab and Shift+Tab cycle within the dialog. Escape and backdrop activation close the dialog when the flow permits dismissal, while a destructive request already in flight may temporarily prevent closure. Closing restores focus to the opener. Icon-only close controls have an accessible name, and focus behavior must be covered without arbitrary timing sleeps.

## Typography

Inter is the sole typeface. The `label` style is uppercase with letter-spacing and is used for section headings inside cards (e.g. "WEAK AREAS", "RECENT SESSIONS"). The `readinessScore` style is used exclusively for the large readiness percentage display. `mono` is used for code blocks in reading content and agent responses.

## Layout

The app uses a full-height layout with a top navigation bar. Page content is centred with a max-width container.

**Dashboard** — single column, full-width cert cards stacked vertically. The hero card uses the gradient background; subsequent cards use the surface background.

**Session view** — split panel: content (reading block or quiz card) on the left, agent chat panel on the right. The agent panel is collapsible. A fixed header contains the session timer and progress bar.

**Mock exam** — full-screen, no sidebar, question navigation panel on the right.

Spacing between major sections uses `xl` (24px). Internal card padding uses `xl` (24px). Gaps between inline elements use `sm` (8px) or `md` (12px).

### Responsive containment

Implemented learner and shared-shell screens support a 375px viewport even when the imported Claude snapshot is desktop-only. The desktop artboard hierarchy, content order, and maximum-width behavior remain the desktop reference; narrow support is a product contract rather than a request to redraw that hierarchy.

At 375px, page and shell containers use `min-width: 0` and stay within the document viewport. Long labels, validation messages, certification names, and action groups wrap. Fixed rows stack only where necessary, focus rings retain clearance, and wide tables, charts, code, or evidence use bounded local overflow. Horizontal scrolling belongs to the smallest meaningful region, never the document. Desktop layouts must retain their intended columns, widths, and alignment after mobile containment is added.

## Elevation & Depth

Depth is communicated through background colour layers rather than shadows. Avoid `box-shadow` on dark backgrounds — it looks muddy. Use background colour contrast instead: `elevated` → `surface` → `base` communicates the same hierarchy more cleanly.

The one exception: the hero cert card may use a subtle inner glow (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.1)`) to add dimension to the gradient.

## Shapes

`sm` (3px) is used for small interactive elements: quiz options, input fields, badges, chips.
`md` (6px) is used for panels, agent chat bubbles, and secondary buttons.
`lg` (8px) is used for cards and primary buttons.
`xl` (12px) is used for modals and the agent panel.
`full` (9999px) is used for the readiness score chip and inline status pills.

## Components

**Cert card (hero)** — gradient background (`primary.default` → `accent.gradient`), white text, `lg` radius, `xl` padding. Used for the top-ranked certification (lowest readiness score). Contains the readiness score in `readinessScore` typography, weak area badges, and recent sessions.

**Cert card (standard)** — `surface` background, `primary` text, same radius and padding. Used for all other enrolled certifications.

**Quiz option** — `base` background at rest, `primary.default` on selection with white text. Never use green/red for correct/incorrect during the quiz — reveal only after the user submits. On reveal: correct answer gets `status.good` text, incorrect selection gets `status.poor` text.

**Agent chat bubbles** — user messages use `surface` background with `secondary` text. Assistant messages use `primary.default` with white text. Tool result cards (progress, session history, explanations) use distinct card-within-bubble styling to distinguish them from prose responses.

**Readiness chip** — `primary.default` background, white text, `full` radius. Used inline wherever a compact readiness score display is needed.

**Weak area badges** — transparent background, coloured text using the status scale. Score determines colour: < 50% = `status.poor`, 50–65% = `status.warning`, 65–80% = `status.medium`, > 80% = `status.good`.

## Do's and Don'ts

**Do** use uppercase `label` typography for section labels inside cards — it creates visual hierarchy without adding weight.

**Do** use the status colour scale consistently — if a number represents a score, it must use the appropriate status colour.

**Do** collapse the agent panel when the user hasn't initiated a conversation — default to giving content maximum space.

**Don't** use the hero gradient for anything other than the top-ranked cert card. It signals urgency; overusing it dilutes the meaning.

**Don't** reveal correct/incorrect quiz answers with red/green during answering — only on submission. Premature feedback breaks the learning flow.

**Don't** use `box-shadow` for depth — use background colour layers instead.

**Don't** add decorative colour. If colour isn't communicating status, hierarchy, or interaction state, remove it.
