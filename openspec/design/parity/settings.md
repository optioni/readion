# Parity — Settings

5 active findings — 4 high · 1 medium · 0 low

## Reconciliation — ui-interaction-state-parity

This report keeps 10 snapshot observations as evidence. Counts and the parity index include only the 5 entries still marked `open`; `resolved` and `superseded` entries below are historical.

- Static Claude frames remain the visual hierarchy reference. Live loading/content/empty/error+Retry/background-refresh states, operation-specific busy labels and duplicate guards, semantic dark/light modes, accessibility/focus behavior, and tested 375px containment are intentional product contracts even when no static frame depicts them.
- Busy identity belongs only to the initiating action; adjacent disabled actions do not display its spinner or progressive label. Dimensions remain stable and reduced-motion preferences are honored.
- Resolved snapshot findings: “'Session preferences' section title”; “Intro/behavioral description text”; “Field row layout (label column + hint aside content)”; “'Default duration per session' hint text”; “Pill/chip shape and selected-state styling”.

- **[high] Session length control** — divergent/composition
  - design: Custom slider card: 'Duration' label with live value readout ('20 min'), a filled track with a draggable thumb, and tick labels 5m/15m/30m/45m/60m beneath.
  - app: Discrete pill/button row (like every other field) offering raw numeric values 15, 30, 60, 90 with no unit suffix, live readout, track, or tick marks.
  - evidence: `Design: openspec/design/Settings.html:224-240 (FieldRow 'Session length' + slider markup). App: apps/web/app/components/OnboardingSessionPrefs.vue:50-56,102-119 renders `duration` via the same generic pill-button field as everything else; values sourced from packages/shared/src/users/index.ts:6 `sessionDefaultDurations = [15, 30, 60, 90]`.`
- **[high] Difficulty pill labels** — divergent/composition
  - design: Human-readable option labels: 'Adaptive', 'Easy', 'Medium', 'Hard' (Adaptive shown selected).
  - app: Raw enum slugs rendered verbatim as button text: 'beginner', 'intermediate', 'advanced', 'adaptive' — different wording, casing, and set membership (no 'Easy'/'Medium'/'Hard').
  - evidence: `Design: openspec/design/Settings.html:242-250 (difficulty options array). App: apps/web/app/components/OnboardingSessionPrefs.vue:117 `{{ option }}` prints raw values from packages/shared/src/users/index.ts:8-13 `sessionDefaultDifficulties = ['beginner','intermediate','advanced','adaptive']` with no label mapping.`
- **[high] Content mix pill labels** — divergent/composition
  - design: Options 'Questions', 'Mixed', 'Concepts first' (Mixed selected).
  - app: Raw enum slugs 'balanced', 'reading-heavy', 'quiz-heavy' rendered unformatted, with no correspondence to the design's copy.
  - evidence: `Design: openspec/design/Settings.html:242-243. App: apps/web/app/components/OnboardingSessionPrefs.vue:117 with values from packages/shared/src/users/index.ts:7 `sessionDefaultContentMixes = ['balanced','reading-heavy','quiz-heavy']`.`
- **[high] Learning style pill set** — divergent/composition
  - design: Two options: 'Spaced rep.', 'Intensive' (Spaced rep. selected).
  - app: Three raw enum options rendered verbatim: 'weak-area-focus', 'spaced-repetition', 'scenario-based' — different count, wording, and default selection ('weak-area-focus').
  - evidence: `Design: openspec/design/Settings.html:245. App: apps/web/app/components/OnboardingSessionPrefs.vue:117 with values from packages/shared/src/users/index.ts:15-19,26 (`sessionDefaultLearningStyles`, `DEFAULT_SESSION_DEFAULTS.learningStyle = 'weak-area-focus'`).`
- **[medium · resolved] 'Session preferences' section title** — missing/composition
  - design: SettingsSection renders a bold 13px title 'Session preferences' above the field group.
  - app: No section heading is rendered before the fields; StudyDefaultsTab goes straight into OnboardingSessionPrefs's field list.
  - evidence: `Design: openspec/design/Settings.html:218 (`<SettingsSection title="Session preferences">`). App: apps/web/app/components/StudyDefaultsTab.vue:41-48 has no heading element.`
- **[medium · resolved] Intro/behavioral description text** — missing/behavioral
  - design: Explanatory copy: 'These are your default starting values for each new session. Readion adjusts them over time based on your performance,' setting user expectations that these are starting defaults, not fixed settings.
  - app: No equivalent copy anywhere in StudyDefaultsTab or OnboardingSessionPrefs; the adaptive-adjustment behavior is undocumented in the UI.
  - evidence: `Design: openspec/design/Settings.html:219-221. App: apps/web/app/components/StudyDefaultsTab.vue:41-48 (no descriptive text node).`
- **[medium · resolved] Field row layout (label column + hint aside content)** — divergent/layout
  - design: Two-column FieldRow: fixed 160px-wide label (+ optional hint) on the left, control on the right, all rows vertically aligned into a form-table layout.
  - app: Stacked single-column layout: an uppercase mono-font label sits above its pill row, one full-width block per field, no left-hand label column.
  - evidence: `Design: openspec/design/Settings.html:120-128 (`FieldRow` component). App: apps/web/app/components/OnboardingSessionPrefs.vue:96-121 (`<div class="flex flex-col gap-2">` per field, label above buttons).`
- **[medium · resolved] 'Default duration per session' hint text** — missing/composition
  - design: Session length FieldRow shows a secondary hint line under the label: 'Default duration per session'.
  - app: No hint/sub-text is rendered for any field; only the field label itself.
  - evidence: `Design: openspec/design/Settings.html:224. App: apps/web/app/components/OnboardingSessionPrefs.vue:98-101 (label only, no hint slot).`
- **[medium] Extra 'Focus area' field** — divergent/composition
  - design: Study defaults tab defines exactly three pill fields: Content mix, Difficulty, Learning style (plus the Session length slider) — no Focus area field.
  - app: A fifth field, 'Focus area' (options: auto, weak-areas, new-material, review), is rendered between Difficulty and Learning style, with no design counterpart in this tab.
  - evidence: `Design: openspec/design/Settings.html:242-250 (only 3 pill fields defined). App: apps/web/app/components/OnboardingSessionPrefs.vue:69-74 (`focusArea` field) rendered via the shared `fields` array at :50-81.`
- **[low · resolved] Pill/chip shape and selected-state styling** — divergent/composition
  - design: Fully rounded pill chips (`border-radius: rFull`), unselected state has no border-only-transparent background, selected state fills solid primary color with white text and medium weight.
  - app: Buttons use `rounded-lg` (soft rectangle, not full pill) with visible border in both states and slate background/text for unselected state.
  - evidence: `Design: openspec/design/Settings.html:150-156 (`OBPills` component, `borderRadius: T.rFull`). App: apps/web/app/components/OnboardingSessionPrefs.vue:109-114 (`class="rounded-lg border px-4 py-2 ..."`).`
