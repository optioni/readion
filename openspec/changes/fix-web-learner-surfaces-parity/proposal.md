## Why

The parity diff compared the three learner overview surfaces — Dashboard, Cert detail, Progress — against `Dashboard.html`, `CertDetail.html`, `Progress.html` (30 findings). Most are genuine presentational fidelity gaps; several reconcile against existing specs/data and are handled specially (see `design.md` for the full table). No net-new capability — this is fidelity plus one behavioral correction (mastered-domain persistence).

**Dashboard (`web-dashboard`) — fixes:** add the **ReadinessBar** track under the readiness % on every cert card; widen the content column from `max-w-[720px]` to the manifest **`standard`** width (centered ~1100px); flatten the card's internal sections to full-width hairline-divided stacks with the design's multi-column recent-sessions row; add the cert **code pill**; add the review-button play icon; sentence-case "Mock exam" / "5-min review".

**Cert detail (`web-cert-detail`) — fixes:** wire the **per-row session delta badges** (the panel supports them but `OverviewTab` never passes the delta, so none render); give each stat its own bordered card with the design's sub-captions ("completed"/"answered"/"per session"); stack Suggested-next + Recent-sessions in the design's 260px right column; add row dividers, the "View all sessions →" link, and score-band accuracy coloring; relabel "Domain Breakdown" → "Domain scores"; remove the extra "View progress" link the design doesn't have.

**Progress (`web-progress`) — fixes:** move the **TrajectoryCallout** to the bottom of the readiness section (it currently renders first, before the chart it concludes from); add the readiness chart's X-axis date labels, area fill, and dashed projection line; add the "This month" section label with per-stat bordered cards; add section-header counters and session-history time-of-day; show the per-bar % only on the last accuracy bar with short date captions; adopt the `standard` content width; relabel section headers ("Readiness over time", "Domain scores"). Also **wire mastering to persist**: the spec requires `enrollmentReviewControllerSuppressDomain` with query invalidation, but the app uses a local-only `mastered` ref that resets on reload — a bug. Fix the persistence and add the design's visual treatment (Mastered divider group, strikethrough, dimmed bar, pill).

**Reconciled specially:**

- **Content width (dashboard, progress)** — fix to the manifest's `standard` token (centered ~1100), *not* the artboard's literal uncapped full-bleed.
- **Reviews-due row always shown (dashboard)** — **reaffirm**: `web-dashboard` already specs "when `dueCount` is zero the row MUST NOT be rendered." The app is correct; the artboard's always-bound row does not override the spec.
- **Diagnostic re-prompt nudge (dashboard)** — **reaffirm**: a speced conditional feature; the two-certs artboard simply doesn't depict that state.
- **Readiness sub-label metric (cert detail)** — **reaffirm the app**: `web-cert-detail` specs a "readiness and trajectory stat row"; the trajectory label ("exam-ready in ~N weeks") is intentional. The design's week-over-week delta is a different metric; not adopted.
- **"Unretire" button (progress)** — **reaffirm omission**: the mastered contract is one-way (no un-master endpoint per `web-progress`); the design's Unretire control stays omitted.
- **Data dependencies to verify (not blockers):** the cert **code pill** needs the enrollment card to surface the cert `code`; the **per-row session delta** needs per-session accuracy-delta data. If either field is missing, a small `packages/shared` + generated-client include; otherwise none.

## What Changes

- **web-dashboard** — ReadinessBar on cert cards; `standard` content width; flat hairline-divided card sections + multi-column recent sessions; cert code pill; review-button icon; sentence-case button copy. (Reviews-due hide-when-zero and the diagnostic banner are unchanged/reaffirmed.)
- **web-cert-detail** — wired per-row delta badges; individually-bordered stat cards with sub-captions; 260px right column stacking Suggested-next + Recent-sessions; row dividers; score-band accuracy coloring; "View all sessions →" link; "Domain scores" label; remove the extra "View progress" link. (Trajectory sub-label reaffirmed.)
- **web-progress** — TrajectoryCallout at the bottom of the readiness section; chart X-axis labels + area fill + projection line; "This month" section + per-stat bordered cards; section counters; session-history time-of-day; last-bar-only accuracy %; `standard` content width; section-label copy; **persist mastering via `suppressDomain`** + the mastered visual treatment (Unretire stays omitted).

## Capabilities

### Modified Capabilities

- `web-dashboard`: readiness progress bar, standard content width, flat divided card sections, cert code pill, review-button polish.
- `web-cert-detail`: wired per-row delta badges, bordered stat cards with sub-captions, right-column stacking, row dividers, accuracy coloring, "View all sessions" link, label reconciliation, extra-link removal.
- `web-progress`: trajectory-callout placement, richer readiness chart, "This month" per-stat cards, section counters, history time-of-day, accuracy-bar polish, standard content width, persistent mastering with the design treatment.

## Impact

- **apps/web** — mostly presentational:
  - Dashboard: `CardReadiness.vue`, `CertCard.vue`, card section components, `RecentSessionsPanel.vue`, `ReviewQuickStart.vue`, `QuickStartButtons.vue`, `pages/index.vue` (width).
  - Cert detail: `OverviewTab.vue` (pass the delta prop, stat cards, right column, label), `RecentSessionsPanel.vue`, `ProgressStatCard.vue`, `pages/user-certifications/[id]/index.vue` (remove extra link).
  - Progress: `pages/user-certifications/[id]/progress.vue` (reorder, width), `ReadinessTrend.vue` (X labels, area, projection), `AccuracyBars.vue`, `ProgressSessionHistoryTable.vue`, `ProgressStatCard.vue`, `ProgressDomainRow.vue` + `useDomainScores.ts` (persist mastering).
- **Behavioral fix:** mastering wired to `enrollmentReviewControllerSuppressDomain` so it persists across reloads (currently a local-only ref).
- **Possible minor contract touch (verify first):** enrollment card DTO surfacing cert `code`; per-session accuracy delta. If missing, a small `packages/shared` + generated-client update.
- **Tests** — Playwright e2e per surface + component unit tests; integration tests only if a DTO field is added or the suppress-domain wiring is exercised end-to-end.
- **Descoped/reaffirmed:** dashboard reviews-row hide-when-zero and diagnostic banner (unchanged); cert-detail week-over-week readiness sub-label (app keeps trajectory); the mastered "Unretire" action (one-way contract).
