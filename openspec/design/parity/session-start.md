# Parity — Session start

0 active findings — 0 high · 0 medium · 0 low

## Reconciliation — ui-interaction-state-parity

This report keeps 3 snapshot observations as evidence. Counts and the parity index include only the 0 entries still marked `open`; `resolved` and `superseded` entries below are historical.

- Static Claude frames remain the visual hierarchy reference. Live loading/content/empty/error+Retry/background-refresh states, operation-specific busy labels and duplicate guards, semantic dark/light modes, accessibility/focus behavior, and tested 375px containment are intentional product contracts even when no static frame depicts them.
- Busy identity belongs only to the initiating action; adjacent disabled actions do not display its spinner or progressive label. Dimensions remain stable and reduced-motion preferences are honored.
- Resolved snapshot findings: “Cert identity pill (code + name) above main card”; “Defaults summary values (Content mix / Difficulty / Learning style)”; “MinimalHeader brand mark icon”.

- **[high · resolved] Cert identity pill (code + name) above main card** — missing/composition
  - design: A centered pill above the 'Ready to start?' card showing the cert's mono code (e.g. 'SAA-C03') and full name ('Solutions Architect – Associate'), so the user confirms which certification the session is for.
  - app: absent — SessionStartQuickStart.vue renders only the MinimalHeader and the main card; no cert code/name element exists anywhere on the page for the given enrollmentId.
  - evidence: `design: openspec/design/SessionStart.html:109-114 (Cert pill block in QuickStartScreen) vs app: apps/web/app/components/SessionStartQuickStart.vue:62-119 (no cert badge markup) and apps/web/app/pages/user-certifications/[id]/session/start.vue:14-30 (page passes only enrollmentId, never fetches/display cert code).`
- **[medium · resolved] Defaults summary values (Content mix / Difficulty / Learning style)** — simplified/composition
  - design: Values are humanized/enumerated display labels distinct from raw enum keys, e.g. 'Mixed', 'Adaptive', 'Spaced rep.'
  - app: Values are bound directly to raw SessionDefaults enum strings with no formatting, so they would render as e.g. 'balanced'/'reading-heavy', 'beginner'/'intermediate'/'exam-ready', 'weak-area-focus'/'spaced-repetition'/'cram' instead of user-friendly labels (note 'Adaptive'/'Mixed' as design terms don't even correspond to any value in the shared enum).
  - evidence: `design: openspec/design/SessionStart.html:122-137 (defaults rows array with polished labels) vs app: apps/web/app/components/SessionStartQuickStart.vue:24-35 (summaryRows maps value.contentMix/difficulty/learningStyle with no format function) and packages/shared/src/sessions/index.ts:6-18 (raw enum values: 'balanced', 'beginner', 'spaced-repetition', etc.).`
- **[low · resolved] MinimalHeader brand mark icon** — simplified/composition
  - design: Header shows a 22x22 rounded accent-colored icon chip with a star glyph next to the 'Readion' wordmark.
  - app: Header renders only the 'Readion' text wordmark with no icon/logo chip.
  - evidence: `design: openspec/design/SessionStart.html:84-89 (MinimalHeader icon block) vs app: apps/web/app/layouts/minimal.vue:6-8 (NuxtLink contains only a span with 'Readion' text, no icon element).`
