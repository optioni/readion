## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Write a failing Playwright e2e (`apps/web/e2e`) for **Settings** fidelity: navigate to `/settings`, assert the contained content column is left-aligned against the sidebar (its left edge sits at the panel's leading padding, not centered with a large left gutter), that at least one field renders as a horizontal FieldRow (sentence-case label in a fixed-width column to the left of its input, not an uppercase label stacked above), that the password action reads "Update password", and that the active tab's underline uses the indigo accent token
- [x] 0.2 Write a failing Playwright e2e for **Agent chat** fidelity: navigate to `/agent`, assert the header shows a star avatar and the title "Study assistant" (not "Ask AI"), and that the empty-state suggestions render as a vertical full-width stack where each chip carries a trailing `→` arrow
- [x] 0.3 Write a failing Playwright e2e for **Login** fidelity: navigate to `/login`, assert the right form pane fills the full height with the `background-surface` treatment and the form is vertically centered and left-aligned (not a bordered card floating in a `background-base` void), that the brand panel lists exactly three feature items each with a green check badge, and that the testimonial is a bordered box
- [x] 0.4 Confirm all three e2e specs fail for the right reason (current markup/copy), not a harness/selector error

## 1. Settings — left-aligned contained column + tab underline (`web-settings`)

- [x] 1.1 RED: component test asserting `SettingsLayout` renders the max-width content column left-aligned against the sidebar (no `mx-auto`/centering) with the design's inner padding
- [x] 1.2 RED: component test asserting the active settings tab renders its underline in the indigo accent token, and inactive tabs render no accent underline
- [x] 1.3 GREEN: left-align the 580px column in `SettingsLayout.vue` and switch the active-tab underline to the indigo accent token
- [x] 1.4 REFACTOR: remove any now-dead centering utilities; confirm spacing matches `openspec/design/Settings.html`

## 2. Settings — horizontal FieldRow label pattern + tokenized label (`web-settings`)

- [x] 2.1 RED: component test for the settings FieldRow primitive asserting it lays out a sentence-case label in a fixed-width column beside the field (horizontal), not an uppercase `font-mono` label stacked above the input
- [x] 2.2 RED: component test asserting field labels resolve to a Readion text token (secondary/muted) rather than a raw `text-slate-400` class
- [x] 2.3 RED: component test asserting the Account tab still renders **no** "Full name" field after the FieldRow refactor (per the design↔contract reconciliation — the `User` entity has no name attribute; the artboard's "Full name" row is deliberately not reproduced)
- [x] 2.4 GREEN: introduce/adjust the horizontal FieldRow layout and rettoken the label colour in `AccountTab.vue` and the shared settings field primitives
- [x] 2.5 REFACTOR: apply the FieldRow pattern consistently across the Account tab fields; de-duplicate label markup

## 3. Settings — "Update password" copy (`web-settings`)

- [x] 3.1 RED: component test asserting the Account tab password action button label is exactly "Update password"
- [x] 3.2 GREEN: change the button copy from "Change password" to "Update password"
- [x] 3.3 REFACTOR: grep for any other "Change password" references in settings copy and reconcile

## 4. Agent chat — star-avatar "Study assistant" identity (`web-agent-chat`)

- [x] 4.1 RED: component test for the agent chat header asserting it renders a circular star avatar and the title "Study assistant" (not "Ask AI"), preserving the "general knowledge · no session context" subtitle
- [x] 4.2 RED: component test for the empty state asserting the circular star avatar renders above the "Study assistant" heading
- [x] 4.3 GREEN: add the star avatar and "Study assistant" title to the header and empty state in `agent.vue` / its subcomponents
- [x] 4.4 REFACTOR: extract a shared star-avatar element if header and empty state duplicate it

## 5. Agent chat — vertical suggestion chips with arrows (`web-agent-chat`)

- [x] 5.1 RED: component test asserting the empty-state suggestion chips render as a vertical, full-width stack (one per row) each with a trailing `→` arrow, and that activating a chip still submits its text as the first user turn
- [x] 5.2 GREEN: restyle the suggestion chips to the vertical full-width layout with trailing arrows without changing the send behaviour
- [x] 5.3 REFACTOR: confirm the chip send path still routes through the existing suggestion handler; tidy markup

## 6. Login — full-height surface form pane (`web-auth`)

- [x] 6.1 RED: component test asserting the login form pane is a full-height `background-surface` panel (`flex: 1`) with the form vertically centered and left-aligned, not a bordered card sitting in a `background-base` void
- [x] 6.2 RED: component test asserting the form content is constrained to a comfortable reading width inside the filled pane while the pane itself fills the right side
- [x] 6.3 RED: component test asserting no "Sign in with SSO" control and no `or` divider are rendered (reaffirming the deliberate omission)
- [x] 6.4 GREEN: make the form pane fill the surface (remove the floating-card container / base-void), center the form vertically, left-align it, and keep the reading-width constraint on the form content
- [x] 6.5 REFACTOR: share the filled-pane layout across all auth states (login/register/forgot/reset/verify) that use the same auth layout

## 7. Login — brand panel feature badges + bordered testimonial (`web-auth`)

- [x] 7.1 RED: component test asserting the brand panel renders exactly three feature items, each with a circular green check badge (not four plain checkmarks)
- [x] 7.2 RED: component test asserting the testimonial renders as a bordered overlay box
- [x] 7.3 GREEN: reduce the feature list to the three design items with green check badges and wrap the testimonial in the bordered box treatment
- [x] 7.4 REFACTOR: token the badge/testimonial colours to the Readion status-good / border tokens per `openspec/design/Login.html`

## 8. Acceptance Test — Outer Loop GREEN

- [x] 8.1 Confirm the three Playwright e2e specs from section 0 now pass end-to-end
- [x] 8.2 Visually diff each surface against its artboard (`Settings.html`, `AgentChat.html`, `Login.html`) and reconcile any remaining spacing/colour drift
- [x] 8.3 REFACTOR: clean up test selectors and any shared fidelity fixtures

## 9. Change Review — Subagent Verification

- [x] 9.1 Dispatch a subagent to review the change against proposal.md, the three spec deltas, and the diff plus this task list (reviewer reports findings only, does not edit code)
- [x] 9.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 10. Polish

- [x] 10.1 Run linter and fix all errors (`yarn lint`)
- [x] 10.2 Run formatter and apply fixes (`yarn format`)
- [x] 10.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [x] 10.4 Run coverage and confirm ≥80% lines/branches for the touched components (`yarn workspace apps/web test:coverage`)
