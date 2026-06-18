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

## Typography

Inter is the sole typeface. The `label` style is uppercase with letter-spacing and is used for section headings inside cards (e.g. "WEAK AREAS", "RECENT SESSIONS"). The `readinessScore` style is used exclusively for the large readiness percentage display. `mono` is used for code blocks in reading content and agent responses.

## Layout

The app uses a full-height layout with a top navigation bar. Page content is centred with a max-width container.

**Dashboard** — single column, full-width cert cards stacked vertically. The hero card uses the gradient background; subsequent cards use the surface background.

**Session view** — split panel: content (reading block or quiz card) on the left, agent chat panel on the right. The agent panel is collapsible. A fixed header contains the session timer and progress bar.

**Mock exam** — full-screen, no sidebar, question navigation panel on the right.

Spacing between major sections uses `xl` (24px). Internal card padding uses `xl` (24px). Gaps between inline elements use `sm` (8px) or `md` (12px).

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
