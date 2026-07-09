## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Failing Playwright e2e (`apps/web/e2e`) for **Dashboard**: assert each cert card renders a ReadinessBar track under the readiness %, the content column uses the standard width (not the narrow 720 column), the card's inner sections are flat hairline-divided (not boxed panels), and the cert code pill + sentence-case "Mock exam" / "5-min review" render
- [x] 0.2 Failing Playwright e2e for **Cert detail**: assert recent-session rows each show a delta badge, the four stats render as individually-bordered cards with sub-captions, the "View all sessions →" link renders, the "Domain scores" label is used, and no extra "View progress" link sits between the header and tabs
- [x] 0.3 Failing Playwright e2e for **Progress**: assert the TrajectoryCallout renders at the bottom of the readiness section (after the chart), the chart shows X-axis date labels + area fill, a "This month" section with per-stat bordered cards renders, and mastering a domain persists across a reload (with the Mastered divider/strikethrough treatment and NO Unretire control)
- [x] 0.4 Confirm all three specs fail for the right reason

## 1. Dashboard — ReadinessBar + card polish (`web-dashboard`)

- [x] 1.1 RED: component test asserting `CardReadiness` renders a progress track filled to the readiness %, white-tinted on the hero card and status-colored on standard cards
- [x] 1.2 RED: component test asserting the cert code pill renders beside the vendor name (verify the enrollment card exposes `code`; if not, surface it via a minimal include first)
- [x] 1.3 RED: component test asserting the card's inner sections render as full-width hairline-divided stacks (not boxed `CardPanel` grid), and recent sessions as the multi-column split
- [x] 1.4 RED: component test asserting the review button shows the play icon and buttons read "Mock exam" / "5-min review" (sentence case)
- [x] 1.5 GREEN: implement the ReadinessBar, code pill, flat sections, multi-column sessions, button icon/copy
- [x] 1.6 REFACTOR: token the bar/divider colors per `openspec/design/Dashboard.html`; keep the reviews-due hide-when-zero behavior intact (do NOT always-render)
- [x] 1.7 RED→green guard: assert the diagnostic re-prompt nudge remains mounted on the dashboard (shown/hidden by its own query) — reaffirmed as a conditional feature, not removed by the widening/flattening work

## 2. Dashboard — standard content width (`web-dashboard`)

- [x] 2.1 RED: component/e2e test asserting the dashboard content column uses the manifest `standard` width (centered, ~1100px), not `max-w-[720px]`
- [x] 2.2 GREEN: replace the `max-w-[720px]` wrapper with the standard content-width treatment in `pages/index.vue`
- [x] 2.3 REFACTOR: confirm hero + cards fill the widened pane per the design

## 3. Cert detail — wired delta badges + accuracy coloring (`web-cert-detail`)

- [x] 3.1 RED: component test asserting `OverviewTab` passes per-session delta data to `RecentSessionsPanel` so a delta badge renders on each row (verify the session data exposes the delta; surface it if missing)
- [x] 3.2 RED: component test asserting recent-session accuracy is color-coded by score band and rows are separated by dividers; row content matches the design (date, duration + · Mock, accuracy, delta) without the "Kind · focus" label
- [x] 3.3 GREEN: bind the delta, apply score-band color, add dividers, adjust row content
- [x] 3.4 REFACTOR: share the score-band color helper with other readiness surfaces if present

## 4. Cert detail — stat cards, right column, links, labels (`web-cert-detail`)

- [x] 4.1 RED: component test asserting each of the four stats renders as its own bordered card with the design's sub-caption ("completed" / "answered" / "per session")
- [x] 4.2 RED: component test asserting Suggested-next and Recent-sessions stack in a fixed right column beside the domain-scores column, with a "View all sessions →" link below Recent sessions
- [x] 4.3 RED: component test asserting the domain section label reads "Domain scores" and no extra "View progress" link sits between the header and the tab bar
- [x] 4.4 GREEN: implement the bordered stat cards + sub-captions, the right-column stacking + View-all link, the label rename, and remove the extra link
- [x] 4.5 REFACTOR: keep the trajectory stat sub-label as-is (reaffirmed); tidy grid markup

## 5. Progress — trajectory placement, chart, This-month, history (`web-progress`)

- [x] 5.1 RED: component test asserting the TrajectoryCallout renders at the bottom of the readiness section (after the chart + accuracy bars), not before the stats
- [x] 5.2 RED: component test asserting the readiness chart renders X-axis date labels (first/middle/last), an area fill under the line, and a dashed projection segment toward the target when trajectory data exists
- [x] 5.3 RED: component test asserting a "This month" section label renders with each stat in its own bordered card, section headers show live counts, and history rows show a time-of-day sub-line
- [x] 5.4 RED: component test asserting only the last accuracy bar shows its % with a short date caption beneath each bar; section labels read "Readiness over time" / "Domain scores"; content uses the `standard` width
- [x] 5.5 GREEN: implement the reorder, chart enrichments, This-month cards, counters, history time, accuracy-bar polish, labels, width
- [x] 5.6 REFACTOR: reconcile chart geometry against `openspec/design/Progress.html`

## 6. Progress — persist mastering with the design treatment (`web-progress`)

- [x] 6.1 RED: component/integration test asserting "Mark mastered" calls `enrollmentReviewControllerSuppressDomain`, invalidates the affected queries, and the retired state persists across a reload (not a local-only ref)
- [x] 6.2 RED: component test asserting a mastered domain renders under a "Mastered" divider group with strikethrough name, dimmed bar, and a "Mastered" pill, and that NO functional "Unretire" control is offered (one-way contract)
- [x] 6.3 GREEN: wire mastering to the suppress-domain endpoint + derive the mastered state from fetched data; add the visual treatment; omit Unretire
- [x] 6.4 REFACTOR: remove the dead local `mastered` ref; confirm `useDomainScores` reflects the persisted state

## 7. Acceptance Test — Outer Loop GREEN

- [x] 7.1 Confirm the section-0 e2e specs pass end-to-end
- [x] 7.2 Visually diff each surface against its artboard; reconcile residual drift
- [x] 7.3 REFACTOR: clean up selectors and shared fixtures

## 8. Change Review — Subagent Verification

- [x] 8.1 Dispatch a reviewer subagent against `proposal.md`, the three spec deltas, and the diff
- [x] 8.2 Triage: fix CRITICAL, resolve/accept WARNING (one-line reason each), note SUGGESTIONs; re-run affected tests

## 9. Polish

- [x] 9.1 `yarn lint`
- [x] 9.2 `yarn format`
- [x] 9.3 `yarn workspace apps/web typecheck` (zero errors)
- [x] 9.4 `yarn workspace apps/web test:coverage` (≥80% for touched components)
