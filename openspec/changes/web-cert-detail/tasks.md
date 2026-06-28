## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Confirm the committed Orval client (`apps/web/src/api`) already exposes every endpoint the page consumes — `userCertificationsControllerDetail`, `certificationsControllerDetail`, `readinessControllerRead`, `userCertificationsControllerListWeakAreas`, `sessionsControllerList`, `sessionSummaryControllerSummary`, `enrollmentReviewControllerQueue` (due count via `meta.dueCount`), `enrollmentMockExamControllerList` — so **no `yarn codegen`** is needed (no API change). Note the generated method names for the composables (per design.md Context)
- [x] 0.2 Extend the `web-dashboard` e2e seed helper (`apps/web/e2e/support/dashboard-seed.ts`) — or add a sibling cert-detail seed — to land a known enrollment with weak-area domains, study + review sessions, at least one mock/diagnostic attempt, and a due review, against the real running API + DB (direct rows where the LLM path can't run locally, as the dashboard seed already does)
- [x] 0.3 Write failing acceptance test `cert-detail.e2e.ts` covering SPEC → Frontend → Dashboard (cert detail) + IMPLEMENTATION-ORDER → `web-cert-detail`: log in → open the dashboard → click a cert card → land on `/user-certifications/:id` → Overview shows the readiness/trajectory stat row, the per-domain breakdown, suggested next focus, and recent sessions → Sessions tab shows the full history table and the Study/Review type filter narrows it → Exam History tab lists the mock/diagnostic attempt with status and score
- [x] 0.4 Confirm it fails for the right reason (page/route/tabs/components missing — not a harness/seed/config error)

## 1. Cert-detail page shell, route, and dashboard entry point

- [x] 1.1 RED: Component-test `pages/user-certifications/[id]/index.vue` — fetches the enrollment (`userCertificationsControllerDetail`) and certification (`certificationsControllerDetail`), renders the name/provider header and an Overview/Sessions/Exam-History tab strip defaulting to Overview; shows a not-found state when the enrollment lookup 404s
- [x] 1.2 RED: Component-test the dashboard `CertCard` entry point — its header links to `/user-certifications/:id` for the card's enrollment
- [x] 1.3 GREEN: Implement the page shell with the tab strip + active-tab state, and add the navigation link to `CertCard` (the only dashboard change)
- [x] 1.4 REFACTOR: Add cert-detail query keys under the existing `dashboardQueryKeys` scheme (or a co-located `certDetailQueryKeys`); reuse `web-foundation`/`web-auth` shell and route protection

## 2. Overview tab — stat row, domain scores, suggested next focus, recent sessions

- [x] 2.1 RED: Unit-test the per-domain join helper — joins `certification.domains` with the weak-areas list, producing a row per domain with score + status colour (reusing `statusColorForScore`) and a "no data yet" state for unanswered domains
- [x] 2.2 RED: Unit-test the suggested-next-focus selector — takes the latest completed session's `summary.nextFocus.domain`, falls back to the lowest-scoring weak-area domain, and yields a neutral placeholder when neither exists
- [x] 2.3 RED: Unit-test the stat-row formatter — readiness percentage vs "not yet calibrated" (reusing `formatReadiness`), the informational "exam-ready in ~N weeks" line only when `trajectory` is present, total-sessions count, and due-review count
- [x] 2.4 RED: Component-test the Overview tab — renders the stat row, the full domain-score breakdown (status-coloured + "no data" placeholders), the suggested-next-focus panel, and the recent-sessions list (last 3, accuracy from per-session summary via the reused `fetchRecentSessionSummaries`, with date/focus-area fallback and a "no sessions yet" placeholder)
- [x] 2.5 GREEN: Implement the Overview composables (readiness, weak-areas, sessions+summaries, review count) over the existing client with vue-query, the pure helpers, and the Overview components
- [x] 2.6 REFACTOR: Keep presentational logic out of composables; co-locate pure helpers with their unit tests; degrade each panel independently (per-panel skeleton/empty rather than a whole-tab failure)

## 3. Sessions tab — full history table + client-side type filter

- [x] 3.1 RED: Unit-test the client-side type filter — given mixed `study`/`review` rows, All shows both, Study shows only `study`, Review shows only `review`
- [x] 3.2 RED: Component-test the Sessions tab — paginated table from `sessionsControllerList` (date, kind, focus area, duration, status), accuracy from per-session summary for completed rows on the visible page (rows without a summary show no accuracy), the All/Study/Review filter narrows the loaded rows, each row links to its session route, and an empty state shows when there are no sessions
- [x] 3.3 GREEN: Implement the sessions-history composable (paginated list + bounded per-visible-page summary fan-out, cached per session id) and the table + filter components, using `runnerRoutes` for the row link
- [x] 3.4 REFACTOR: Bound and cache the summary fan-out to the visible page; document that the type filter is a view over loaded rows (no server kind param)

## 4. Exam History tab — mock + diagnostic attempts

- [x] 4.1 RED: Component-test the Exam History tab — lists attempts from `enrollmentMockExamControllerList` with date, type (mock/diagnostic), status (in_progress/submitted/expired), score, and pass/fail; submitted attempts link into the mock-exam review route; an empty state shows when there are no attempts
- [x] 4.2 GREEN: Implement the exam-history composable and list component (header fields only — do not render the full per-attempt `questions[]` payload)
- [x] 4.3 REFACTOR: Share row/pill styling with the sessions table where it makes sense; centralise the mock review route via `runnerRoutes`

## 5. Acceptance Test — Outer Loop GREEN

- [x] 5.1 Confirm the `cert-detail.e2e.ts` acceptance test passes end-to-end
- [x] 5.2 Verify the affected apps start in the local environment (smoke test) — boot `apps/web` (and the `apps/api` it depends on) and confirm no startup/config errors and the cert-detail page renders for a seeded user reached from the dashboard
- [x] 5.3 REFACTOR: Clean up e2e seeding helpers and any duplicated test scaffolding

## 6. Change Review — Subagent Verification

- [x] 6.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 6.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 7. Polish

- [x] 7.1 Run linter and fix all errors (`yarn lint`)
- [x] 7.2 Run formatter and apply fixes (`yarn format`)
- [x] 7.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [x] 7.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
- [ ] 7.5 When DesignSync becomes available: re-pull `CertDetail.html` into `design/CertDetail.html`, re-diff the design.md reconciliation table against it, and reconcile any divergence (flagged in design.md — DesignSync was absent at authoring time)
