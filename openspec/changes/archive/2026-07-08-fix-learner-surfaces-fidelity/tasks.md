## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up / reuse the Playwright e2e harness (`apps/web/e2e`) with seeded fixtures that exercise the exact regression states: an enrollment whose `trajectory.weeksToReady === 1`, an enrollment with a single-day current streak (one session started today), and a calibrated enrollment whose completed-session summaries report `questionsAnswered === 0`.
- [x] 0.2 RED: Write a failing Playwright e2e asserting the cert-detail Overview trajectory line reads `exam-ready in ~1 week` (singular) — not `~1 weeks` — for the `weeksToReady === 1` fixture.
- [x] 0.3 RED: Write a failing Playwright e2e asserting the progress activity row's Current streak reads `1 day` (singular) — not `1 days` — for the single-day-streak fixture.
- [x] 0.4 RED: Write a failing Playwright e2e asserting that on cert-detail, when `questionsAnswered === 0`, the fourth Overview stat shows `0` questions with NO accuracy percentage (no `0%`) — a neutral placeholder/em dash instead.
- [x] 0.5 RED: Write a failing Playwright e2e asserting the design-fidelity anchors are present on each surface: dashboard PageHeader eyebrow "Your certifications" + hero showing the cert NAME as the heading; cert-detail full-bleed header bar with a "Dashboard" breadcrumb and an "Exam history" tab; progress session-history table with a visible column-header row (Date / Type / Duration / Questions / Accuracy / Readiness).
- [x] 0.6 Confirm every 0.x test fails for the right reason (wrong copy / missing element), not a harness/setup error.

## 1. Shared pluralization — singular-aware formatter (`web-cert-detail`, `web-progress`)

- [x] 1.1 RED: Unit-test that the singular-aware formatter (the `paceFormatter.ts` rule) returns `week` for a count of 1 and `weeks` otherwise, and `day` for 1 and `days` otherwise — extract/expose a reusable `pluralizeUnit(count, singular)` helper if one does not already exist.
- [x] 1.2 GREEN: Add/expose the reusable singular-aware unit helper co-located with `paceFormatter.ts`, keeping `formatPaceString` behaviour intact.
- [x] 1.3 REFACTOR: Ensure both trajectory and streak call sites consume this one helper — no second copy of the count→word rule.

## 2. Cert-detail: `~N week(s)` trajectory + QUESTIONS-0 accuracy suppression (`web-cert-detail`)

- [x] 2.1 RED: Unit-test `formatCertStatRow` — `trajectoryLabel` for `weeksToReady: 1` is `exam-ready in ~1 week` and for `weeksToReady: 3` is `exam-ready in ~3 weeks`.
- [x] 2.2 GREEN: Change `certStatRow.ts` to build the trajectory label via the singular-aware helper instead of the hardcoded `weeks`.
- [x] 2.3 RED: Unit-test `formatCertStatRow` — when `questionsAnswered === 0`, `accuracyLabel` is `null` (no `0%`) regardless of the `accuracy` input; when `questionsAnswered > 0` the accuracy label and status colour are still produced.
- [x] 2.4 GREEN: Update `certStatRow.ts` to suppress the accuracy label (and its colour class) when `questionsAnswered === 0`.
- [x] 2.5 REFACTOR: Fold the suppression into the existing accuracy-null branch cleanly; no duplicated null handling.

## 3. Progress: `N day(s)` streak unit (`web-progress`)

- [x] 3.1 RED: Component/unit-test the Current-streak card renders `1 day` for a one-day streak and `2 days` for two — driven by the singular-aware helper, not a fixed `unit="days"`.
- [x] 3.2 GREEN: Update `progress.vue` (and/or `ProgressStatCard`) so the streak unit is singular-aware.
- [x] 3.3 REFACTOR: Remove the hardcoded `unit="days"` literal so the streak count is the single source for the unit form.

## 4. Dashboard design fidelity (`web-dashboard`)

- [x] 4.1 RED: Component-test the dashboard renders the shared PageHeader — eyebrow "DASHBOARD", h1 "Your certifications", and a right-aligned "N active" indicator with a green dot.
- [x] 4.2 RED: Component-test the hero card hierarchy — the certification NAME is the primary heading with a "NEEDS ATTENTION" eyebrow, and the readiness percentage is a secondary figure (not the h1).
- [x] 4.3 RED: Component-test weak areas render as inline DomainBadge chips (dot + label + %) rather than a bordered text list, and recent sessions render as a compact when / duration / +delta row.
- [x] 4.4 RED: Component-test the Mock exam + Start session actions render in the card's bottom row (not the top-right corner), the review-due row renders as a count + "reviews due" + pill, and the add-cert card shows the "Track another exam alongside this one" subtitle.
- [x] 4.5 RED: Component-test the diagnostic/welcome banner renders as an accent-tinted callout with a shield icon rather than plain text.
- [x] 4.6 GREEN: Create the net-new shared `PageHeader` (eyebrow + h1 + active-count indicator) and `DomainBadge` (status dot + label + %) components, then implement the dashboard layout changes to satisfy 4.1–4.5, matching `openspec/design/Dashboard.html` and `openspec/design/App Shell.html`.
- [x] 4.7 REFACTOR: Reuse the new shared PageHeader and DomainBadge components at their dashboard call sites; remove any bespoke header/weak-area markup superseded by them.

## 5. Cert-detail design fidelity (`web-cert-detail`)

- [x] 5.1 RED: Component-test the page uses the full content width with a full-bleed cert header bar — breadcrumb "← Dashboard / CODE" plus Mock exam and Start session actions — not a narrow centred column.
- [x] 5.2 RED: Component-test the Overview stat strip is Readiness / Sessions / Questions / Avg accuracy (not Readiness / Sessions / Due reviews / Questions).
- [x] 5.3 RED: Component-test each domain row shows a per-domain signed delta (e.g. "↑7%") derived from the latest summary's `weakAreaDeltas`, and the suggested-focus box is an accent-tinted box carrying the required score-based rationale (e.g. "Lowest domain score (45%)."); the optional "Last studied N days ago" clause is derived client-side from the newest session whose `focusArea` includes the domain and is omitted (not fabricated) when not derivable.
- [x] 5.4 RED: Component-test the tab label casing reads "Exam history" (not "Exam History").
- [x] 5.5 GREEN: Implement the cert-detail layout/stat/delta/focus/tab changes to satisfy 5.1–5.4, matching `openspec/design/CertDetail.html`.
- [x] 5.6 REFACTOR: Share the cert header bar / breadcrumb and per-domain delta rendering with the existing domain-score-bar component where possible.

## 6. Progress design fidelity (`web-progress`)

- [x] 6.1 RED: Component-test readiness and accuracy compose into ONE surface card (readiness line on top, divider, accuracy bars below) with a visible 80% target line, not two side-by-side cards.
- [x] 6.2 RED: Component-test the low-data states — a not-yet-calibrated readiness figure and an empty accuracy series render a friendly empty/early state, not a flat slider-looking line with a handle dot.
- [x] 6.3 RED: Component-test the session-history table renders a column-header row (Date / Type / Duration / Questions / Accuracy / Readiness) and formats dates in the friendly form (e.g. "Today, Jun 23") rather than a raw locale string like "7.7.2026".
- [x] 6.4 GREEN: Implement the combined readiness+accuracy card with the 80% target, the low-data empty states, and the table header + date formatting to satisfy 6.1–6.3, matching `openspec/design/Progress.html`.
- [x] 6.5 REFACTOR: Reuse the shared `statusColor` and date-formatting helpers; remove duplicated flat-line rendering.

## 7. Acceptance Test — Outer Loop GREEN

- [x] 7.1 Confirm the Playwright e2e tests from section 0 all pass end-to-end.
- [x] 7.2 Manually spot-check the three surfaces against `openspec/design/Dashboard.html`, `CertDetail.html`, and `Progress.html` for the pluralization, QUESTIONS-0, and layout anchors.
- [x] 7.3 REFACTOR: Clean up test fixtures and shared assertions.

## 8. Change Review — Subagent Verification

- [x] 8.1 Dispatch a subagent to review the change against `proposal.md`, the three spec deltas, and the design HTML plus the diff and this task list (reviewer reports findings only, does not edit code).
- [x] 8.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests. (No CRITICALs. WARNING-1 recent-sessions duration: FIXED. WARNING-2 focus-rationale null edge: consciously ACCEPTED — only fires when a session next-focus domain has no loaded weak-area score; the domain name is still shown and forcing a score line would fabricate/misattribute, so omission is the correct non-fabrication behavior. SUGGESTIONs noted, match the design mock, no action.)

## 9. Polish

- [x] 9.1 Run the linter and fix all errors (`yarn lint`).
- [x] 9.2 Run the formatter and apply fixes (`yarn format`).
- [x] 9.3 Run the type checker with zero errors for `apps/web`.
- [x] 9.4 Run the coverage report and confirm ≥80% lines/branches/functions.
