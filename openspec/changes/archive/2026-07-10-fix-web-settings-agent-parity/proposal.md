## Why

The parity diff compared the Study-defaults settings tab and the standalone Agent chat against `Settings.html` and `AgentChat.html` (19 findings). The prior `fix-web-fidelity-polish` change handled the settings column/tab-underline and the agent header/empty-state; these are the remaining, distinct gaps. The headline is a genuine embarrassment: **settings renders raw enum slugs as button text** ("beginner", "reading-heavy", "weak-area-focus"). Most findings are genuine fixes; a few reconcile against the spec and the authoritative shared enums (see `design.md`).

**Settings (`web-settings`) — fixes:**

- **Human-readable option labels.** Difficulty, Content mix, and Learning style render their raw enum slugs verbatim. Add a value→label map so users see human labels (Difficulty → Beginner/Intermediate/Advanced/Adaptive, Content mix → Balanced/Reading-heavy/Quiz-heavy, etc., following the design's intent). The **enum value sets stay authoritative** — we map to labels, we do NOT adopt the design's reduced/renamed sets where they conflict (the artboard's 2-option learning style and "Easy/Medium/Hard" relabeling would drop or rename real enum values).
- **Session length slider.** Replace the duration pill row with the design's slider (filled track, draggable thumb, live "N min" readout), snapping to the **real** duration options `[15, 30, 60, 90]` from `packages/shared` — not the design's arbitrary 5/15/30/45/60 ticks.
- **FieldRow layout + section framing.** Adopt the two-column FieldRow (fixed label column + optional hint, control on the right); add the "Session preferences" section title, the intro copy ("These are your default starting values… Readion adjusts them over time"), and the "Default duration per session" hint. Fully-rounded pill chips with a solid-primary selected state (vs the app's `rounded-lg` bordered buttons).
- **Reaffirm the Focus area field** — `web-settings` specs "all five session defaults" (duration, content mix, difficulty, **focus area**, learning style); the artboard omitting it is the design being incomplete, not a field to remove.

**Agent chat (`web-agent-chat`) — fixes (all genuine):**

- **Full-height chat shell.** `agent.vue` inherits the default padded, non-height-constrained layout, so the whole page scrolls and the panel is boxed in padding. Opt into the minimal/full-height layout (as the session runner and mock exam already do): header pinned top, message region scrolls, composer pinned to the bottom, thread centered at the manifest `~760px` width.
- **Un-swap the bubble colors.** User and assistant bubble styles are the exact inverse of the design (and the manifest): user bubbles should be surface + secondary text, assistant bubbles primary + white. Swap them back.
- Per-message assistant sparkle avatar; inline streaming cursor at the end of the last paragraph (white-on-primary) instead of a muted sibling block after the list; render assistant turns as discrete paragraphs (split the stored turn) instead of one pre-wrapped string; conditional Send-button state (greyed until the textarea has text); TTL clock icon; New-chat refresh icon; ellipsis character in the placeholder.

## What Changes

- **web-settings** — human-readable labels via a value→label map (authoritative enums kept); a duration slider over the real options; two-column FieldRow with section title/intro/hint; fully-rounded solid-selected pills. The Focus area field is reaffirmed (all five defaults retained).
- **web-agent-chat** — full-height minimal layout with pinned header/composer + centered thread; corrected (un-swapped) bubble colors; per-message avatar; inline white streaming cursor; paragraph rendering; conditional send state; TTL/new-chat icons; placeholder ellipsis.

## Capabilities

### Modified Capabilities

- `web-settings`: human-readable option labels, a duration slider, the FieldRow layout with section framing, and pill styling on the Study-defaults tab (all five fields retained).
- `web-agent-chat`: full-height chat shell, corrected bubble color roles, per-message avatar, inline streaming cursor, paragraph rendering, conditional send, and icon/placeholder polish.

## Impact

- **apps/web** — presentational + a layout opt-in:
  - Settings: `OnboardingSessionPrefs.vue` (labels, slider, FieldRow, pills), `StudyDefaultsTab.vue` (section title/intro). A value→label map (colocated or in `packages/shared`).
  - Agent chat: `agent.vue` (`definePageMeta` layout, composer/cursor/send/icons), `AgentBubble.vue` (bubble colors, avatar, paragraphs), `agentMessages.ts` (paragraph splitting).
- **No API/DB changes.** The session-default enum sets in `packages/shared` are unchanged — we map to labels, we do not remap values.
- **Tests** — Playwright e2e for both surfaces + component unit tests (label mapping, slider snapping, bubble roles, layout). No integration tests.
- **Reaffirmed:** the Focus area field stays (five speced defaults); enum value sets unchanged.
