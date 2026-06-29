## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the `apps/web` e2e harness for both screens: authenticated test session (reuse `web-auth` helpers) and Playwright route fulfilment mocking the contract DTOs for `readinessControllerRead`, `userCertificationsControllerListWeakAreas`, `userCertificationsControllerList`/`Detail`, `certificationsControllerDetail`, `sessionsControllerList`, `sessionsControllerDetail` (review session items, `?include=items`), `sessionSummaryControllerSummary`, `enrollmentReviewControllerQueue`/`Start`/`SuppressDomain`, `reviewItemsControllerMaster`, `quizControllerSubmitAnswer`/`GenerateExplanation`/`ReportQuestion`, `enrollmentMockExamControllerList` (see design.md Test Boundaries)
- [x] 0.2 Write failing acceptance test (Progress): calibrated enrollment renders readiness trend + accuracy chart + status-coloured domain rows with deltas + trajectory call-out + merged session-history table; cert-switcher re-scopes panels; not-yet-calibrated enrollment shows "not yet calibrated" and hides the trajectory
- [x] 0.3 Write failing acceptance test (5-min review): queue-entry shows due count + per-domain breakdown; "Start review" enters the quiz/confidence loop; answering submits `{ answer, confidence, timeTakenMs }`; completion renders the reused summary breakdown with drill-my-misses; and the all-caught-up empty state when nothing is due
- [x] 0.4 Write failing acceptance test (mark-as-mastered): "Mark mastered" on a domain row calls `suppress-domain` and reflects the retired state; no functional un-retire control is wired
- [x] 0.5 Write failing acceptance test (ownership): opening the Progress route for an enrollment the user does not own (API returns 404) renders a not-found state that does not leak the resource's existence
- [x] 0.6 Confirm all acceptance tests fail for the right reason (pages/routes absent), not a harness/setup error

## 1. API client presence + Progress query keys + API wiring

- [x] 1.1 RED: Write a unit/contract test asserting every consumed Orval method exists in the committed client (`apps/web/src/api`) and that no `yarn codegen` is required for this change
- [x] 1.2 GREEN: Add `progressQueryKeys` (and review-loop keys) following the established per-change query-key scheme; add a thin `progressApi`/`reviewLoopApi` composable wrapping the generated methods, reusing `sessionViewApi` where the quiz loop overlaps
- [x] 1.3 REFACTOR: De-duplicate against `web-cert-detail`/`web-session-view` wiring; keep keys colocated and typed

## 2. Derivation composables (pure logic)

- [x] 2.1 RED: Write unit tests for `useReadinessTrend` — builds an ordered `readiness.after` series from completed-session summaries, terminating at the current `readiness.score`; handles not-yet-calibrated (no fabricated line) and single-session cases
- [x] 2.2 GREEN: Implement `useReadinessTrend`
- [x] 2.3 RED: Write unit tests for `useAccuracySeries` — ordered per-session `accuracy` from summaries over a bounded recent window
- [x] 2.4 GREEN: Implement `useAccuracySeries`
- [x] 2.5 RED: Write unit tests for `useDomainScores` — joins `certification.domains` with weak-area records ("no data yet" where absent), attaches per-domain delta from the latest summary's `weakAreaDeltas` only when present, colours via `statusColor`
- [x] 2.6 GREEN: Implement `useDomainScores`
- [x] 2.7 RED: Write unit tests for `useSessionHistoryMerge` — merges `sessionsControllerList` (study/review) with `enrollmentMockExamControllerList` (mock/diagnostic), sorts by start time, attaches Questions/Accuracy/Readiness-delta from bounded per-session summaries, "—" where no summary
- [x] 2.8 GREEN: Implement `useSessionHistoryMerge` (reuse `recentSessionSummaries` fan-out)
- [x] 2.9 RED: Write unit tests for `useDueDomainBreakdown` — derives the per-domain due counts from review-queue items
- [x] 2.10 GREEN: Implement `useDueDomainBreakdown`
- [x] 2.11 REFACTOR: Extract shared summary-fetch/caching helper; ensure all derivation logic is component-free and fully covered

## 3. Progress page components + page (to `../../design/Progress.html`, applying the reconciliation)

- [x] 3.1 RED: Component tests for `ReadinessTrend` (SVG line; current-value label; calibrated vs early state) and `AccuracyBars`
- [x] 3.2 GREEN: Implement `ReadinessTrend` + `AccuracyBars`; drop/de-emphasise the decorative 80% "target" line per reconciliation
- [x] 3.3 RED: Component test for `ProgressDomainRow` — status-coloured score bar, conditional delta, "Mark mastered" action; no functional un-retire control
- [x] 3.4 GREEN: Implement `ProgressDomainRow` wired to `suppress-domain` with query invalidation
- [x] 3.5 RED: Component test for `ProgressSessionHistoryTable` — type pills, accuracy colour, "—" for summary-less rows, mock rows link via `runnerRoutes`
- [x] 3.6 GREEN: Implement `ProgressSessionHistoryTable`
- [x] 3.7 RED: Component test for `TrajectoryCallout` (visible with `weeksToReady`) / insufficient-history state (hidden when null) and the `CertTabs` switcher
- [x] 3.8 GREEN: Implement trajectory call-out + cert-switcher (reuse `readinessFormat`; "+ Add" reuses `AddCertificationModal`)
- [x] 3.9 GREEN: Assemble the Progress page (`pages/user-certifications/[id]/progress.vue`) using the app shell/sidebar; render only honestly-derivable activity figures (session count, optional questions-answered) — drop streak/study-time per reconciliation
- [x] 3.10 REFACTOR: Reuse `web-cert-detail` section-label/status conventions; trim duplication

## 4. Five-minute review run loop + page (to `../../design/QuickReview.html`, applying the reconciliation)

- [x] 4.1 RED: Component test for `ReviewQueueEntry` — due count, per-domain breakdown, "Start review" → `start`; all-caught-up empty state offering a normal session
- [x] 4.2 GREEN: Implement `ReviewQueueEntry`
- [x] 4.3 RED: Component test for the review question step — reuses `QuizCard` + `ConfidenceRating` + `CitationChip`; submitting calls `quizControllerSubmitAnswer` with `{ answer, confidence, timeTakenMs }`; report path; no Again/Hard/Good/Easy buttons; header shows progress (countdown is decorative)
- [x] 4.4 GREEN: Implement the review question step reusing the session-view surfaces
- [x] 4.5 RED: Component test for `ReviewCompletion` — renders reused `SessionSummaryBody` from the review session summary; drill-my-misses CTA; back-to-dashboard
- [x] 4.6 GREEN: Implement `ReviewCompletion` (drill maps to the existing drill endpoint)
- [x] 4.7 GREEN: Assemble the review run-loop page (`pages/user-certifications/[id]/review.vue`) driving entry → loop → completion
- [x] 4.8 REFACTOR: Factor any per-concept `reviewItemsControllerMaster` action into the loop; de-duplicate against session-view

## 5. Navigation wiring

- [x] 5.1 RED: Test that the app-shell/sidebar Progress entry and the dashboard/cert-detail review quick-start route into the new pages via `runnerRoutes`
- [x] 5.2 GREEN: Wire navigation entries; align route names with `runnerRoutes`
- [x] 5.3 REFACTOR: Confirm reuse of existing nav components; no duplicated route constants

## 6. Acceptance Test — Outer Loop GREEN

- [x] 6.1 Confirm all acceptance tests (Progress + review loop + mark-as-mastered) pass end-to-end
- [x] 6.2 Verify `apps/web` starts in the local environment (smoke test) — boot the app and confirm no startup/config errors; confirm no `apps/api`/`apps/worker` changes were needed
- [x] 6.3 REFACTOR: Clean up test setup, route mocks, and fixtures

## 7. Change Review — Subagent Verification

- [x] 7.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code) — including that the QuickReview/Progress reconciliations were honoured (no flashcard self-rating, no fabricated streak/time-series, one-way mastery)
- [x] 7.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 8. Polish

- [x] 8.1 Run linter and fix all errors (`yarn lint`)
- [x] 8.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 8.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [x] 8.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace apps/web test:coverage`)
