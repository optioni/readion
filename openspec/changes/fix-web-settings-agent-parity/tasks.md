## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Failing Playwright e2e (`apps/web/e2e`) for **Settings → Study defaults**: assert Difficulty/Content mix/Learning style render human-readable labels (no raw slugs like "beginner"/"reading-heavy"), that Session length renders as a slider with a live "N min" readout, that all five fields (incl. Focus area) are present, and that a "Session preferences" section title + intro copy render
- [x] 0.2 Failing Playwright e2e for **Agent chat**: assert the page uses the full-height layout (header pinned, only the message list scrolls, composer pinned to the bottom), that user bubbles use the surface/secondary treatment and assistant bubbles the primary/white treatment (not swapped), and that the Send button is disabled/greyed while the textarea is empty
- [x] 0.3 Confirm both fail for the right reason

## 1. Settings — human-readable option labels (`web-settings`)

- [x] 1.1 RED: unit test for a value→label map covering every difficulty/content-mix/learning-style enum value; component test asserting pills render the mapped labels, never the raw slug
- [x] 1.2 RED: component test asserting the enum value *sets* are unchanged (all difficulty/content-mix/learning-style options still render; none dropped or renamed at the value level)
- [x] 1.3 GREEN: add the label map and render mapped labels in `OnboardingSessionPrefs`
- [x] 1.4 REFACTOR: colocate the map (or place in `packages/shared` beside the enums); ensure the persisted value remains the enum slug

## 2. Settings — duration slider (`web-settings`)

- [x] 2.1 RED: component test asserting Session length renders as a slider with a live "N min" readout, snapping to the real options `[15,30,60,90]` (not free values or the design's 5/15/30/45/60 ticks)
- [x] 2.2 GREEN: replace the duration pill row with the slider control bound to the same field value
- [x] 2.3 REFACTOR: keep the persisted value one of the allowed durations

## 3. Settings — FieldRow layout, section framing, pill shape (`web-settings`)

- [x] 3.1 RED: component test asserting fields use the two-column FieldRow (fixed label column + optional hint, control on the right), a "Session preferences" section title and intro copy render, and the duration field shows the "Default duration per session" hint
- [x] 3.2 RED: component test asserting pill chips are fully rounded with a solid-primary selected state (not `rounded-lg` bordered buttons), and that the Focus area field is still present (five fields)
- [x] 3.3 GREEN: implement the FieldRow layout, section title/intro/hint, and pill styling
- [x] 3.4 REFACTOR: reconcile spacing against `openspec/design/Settings.html`

## 4. Agent chat — full-height shell + composer (`web-agent-chat`)

- [x] 4.1 RED: component/e2e test asserting `agent.vue` uses the minimal/full-height layout — header pinned top, only the message region scrolls, composer pinned to the bottom, thread centered at the ~760px width
- [x] 4.2 RED: component test asserting the Send button is disabled/greyed while the textarea is empty and active once it has text; the placeholder uses the ellipsis character; the TTL pill shows a clock icon and the New-chat button a refresh icon
- [x] 4.3 GREEN: add `definePageMeta({ layout })`, the full-height flex column, pinned composer, conditional send state, and the icons/placeholder
- [x] 4.4 REFACTOR: share the full-height layout treatment with the other minimal-layout scenes where sensible

## 5. Agent chat — bubble roles, avatar, cursor, paragraphs (`web-agent-chat`)

- [x] 5.1 RED: component test asserting user bubbles use surface + secondary-text styling and assistant bubbles use primary + white (the corrected, un-swapped roles)
- [x] 5.2 RED: component test asserting each assistant bubble renders a per-message sparkle avatar, the streaming cursor renders inline at the end of the last paragraph in white-on-primary (not a muted sibling block after the list), and assistant content renders as discrete paragraphs
- [x] 5.3 GREEN: swap the bubble color roles; add the per-message avatar; move the cursor inline; split the stored assistant turn into paragraphs for rendering
- [x] 5.4 REFACTOR: keep persistence unchanged (paragraph split is a render concern)

## 6. Acceptance Test — Outer Loop GREEN

- [x] 6.1 Confirm the section-0 e2e specs pass end-to-end
- [x] 6.2 Visually diff both surfaces against `Settings.html` / `AgentChat.html`; reconcile residual drift
- [x] 6.3 REFACTOR: clean up selectors and fixtures

## 7. Change Review — Subagent Verification

- [ ] 7.1 Dispatch a reviewer subagent against `proposal.md`, the two spec deltas, and the diff
- [ ] 7.2 Triage findings; re-run affected tests

## 8. Polish

- [ ] 8.1 `yarn lint`
- [ ] 8.2 `yarn format`
- [ ] 8.3 `yarn workspace apps/web typecheck` (zero errors)
- [ ] 8.4 `yarn workspace apps/web test:coverage` (≥80% for touched components)
