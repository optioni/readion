## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Confirm the committed Orval client (`apps/web/src/api`) already exposes every endpoint the dashboard consumes (user-certifications list/enroll, readiness, weak-areas, enrollment-sessions create, sessions list, session-summary, enrollment-review queue/start, enrollment-mock-exam create, certifications list) — **no `yarn codegen`** is needed (no API change). Note the generated method names for use in composables (per design.md Context)
- [x] 0.2 Add a Playwright e2e harness/spec file under `apps/web/e2e/` for the dashboard against the real Nuxt app + real API (per design.md Test Boundaries); add a helper that seeds an authenticated user with ≥2 enrollments (one calibrated low, one calibrated high, one uncalibrated), graded answers, recent completed sessions, and due reviews via the real API
- [x] 0.3 Write failing acceptance test `dashboard.e2e.ts` covering SPEC → Layout Decisions → Dashboard: log in → land on the dashboard home → see one card per enrollment with name/provider, readiness (incl. "not yet calibrated" for the uncalibrated cert), top-3 weak areas, recent sessions, and the 5-minute-review quick-start where reviews are due → the lowest-readiness calibrated cert is the gradient hero at the top → "+ Add certification" enrolls a new cert and it appears as a card
- [x] 0.4 Confirm it fails for the right reason (dashboard page/cards/modal missing — not a harness/seed/config error)

## 1. Dashboard data composables (over the existing Orval client)

- [x] 1.1 RED: Unit-test an `useEnrollments` composable (mocked HTTP) — fetches `GET /user-certifications?status=active`, resolves each `certificationId` to name/provider from `GET /certifications`, and exposes a combined per-card model
- [x] 1.2 RED: Unit-test per-card composables (mocked HTTP) — readiness (`calibrated`/`score`/`trajectory`), weak areas (top 3), recent sessions (`limit=3`) joined with per-session `summary` for accuracy + the last session's `readiness.delta`, and due-review count (`meta.dueCount`); each degrades to a placeholder/empty state on missing data
- [x] 1.3 GREEN: Implement the composables against the generated client with vue-query, parallel per-card fan-out, caching, and per-panel error/loading states
- [x] 1.4 REFACTOR: Extract shared query keys and the recent-session-summary fan-out (bounded to ≤3) into reusable helpers

## 2. Hero-sort, calibration, and status-colour logic (pure functions)

- [x] 2.1 RED: Unit-test the ordering/hero selector — sorts by `readinessScore` ascending; uncalibrated (`null`) certs ordered after calibrated; hero = lowest calibrated score; when none calibrated, hero = most recently enrolled
- [x] 2.2 RED: Unit-test the status-colour mapper (<50 poor, 50–65 warning, 65–80 medium, >80 good) and the readiness display formatter ("not yet calibrated" when `calibrated === false`, percentage + signed delta otherwise)
- [x] 2.3 GREEN: Implement the pure ordering/hero, status-colour, and readiness-format helpers
- [x] 2.4 REFACTOR: Co-locate with unit tests; ensure no presentational logic leaks into the composables

## 3. Cert card components (hero + standard variants)

- [x] 3.1 RED: Component-test the cert card — renders name/provider, readiness (percentage+delta vs "not yet calibrated"), top-3 status-coloured weak areas, last-3 recent sessions (domain + accuracy, with date/focus-area fallback), and Start-Session/Mock-Exam quick-starts; hero variant uses the gradient + primary action style, standard variant the surface/muted style (design/Dashboard.html + DESIGN.md tokens)
- [x] 3.2 RED: Component-test the due-review quick-start — rendered only when `dueCount > 0`, shows the count, and triggers `POST /user-certifications/:id/review/start` on activation; hidden when `dueCount === 0`
- [x] 3.3 GREEN: Implement `CertCard` (hero + standard) and its weak-areas / recent-sessions / readiness / review-quickstart sub-parts using the wired Readion tokens; **omit** the mockup's exam-date countdown (no backend field — see design.md reconciliation)
- [x] 3.4 REFACTOR: Share the two-panel layout and quick-start button group between variants

## 4. Quick-start actions wiring

- [x] 4.1 RED: Component/unit-test the quick-start actions — Start Session calls `POST /user-certifications/:id/sessions` then navigates to the session route; Mock Exam calls `POST /user-certifications/:id/mock-exams` then navigates to the mock route; 5-min review calls `POST /user-certifications/:id/review/start` then navigates to the review route (placeholder routes per design.md Open Questions)
- [x] 4.2 GREEN: Wire the three quick-start actions to their POST calls and navigation targets
- [x] 4.3 REFACTOR: Centralize the runner-route names so downstream `web-*` changes can reconcile them in one place

## 5. Dashboard page, list ordering, and empty state

- [x] 5.1 RED: Component-test `pages/index.vue` — renders cards in hero-then-ascending order, places uncalibrated certs after calibrated, and shows the empty state (with add-cert CTA) when there are zero active enrollments
- [x] 5.2 GREEN: Implement the dashboard page composing the ordering helper + cards + "+ Add certification" entry, matching the vertical-list layout in `design/Dashboard.html`
- [x] 5.3 REFACTOR: Ensure the page degrades gracefully when individual card sub-requests fail (per-panel placeholders, not a whole-page failure)

## 6. Add-certification modal

- [x] 6.1 RED: Component-test the modal — lists certifications from `GET /certifications` minus the user's active enrollments; selecting one calls `POST /user-certifications` and, on success, closes and refreshes the dashboard so the new card appears
- [x] 6.2 GREEN: Implement the add-certification modal (enroll with defaults; per-cert override UI deferred to `web-onboarding`/`web-settings`)
- [x] 6.3 REFACTOR: Invalidate the enrollments query on successful enroll so the list refreshes without a manual reload

## 7. Acceptance Test — Outer Loop GREEN

- [x] 7.1 Confirm the `dashboard.e2e.ts` acceptance test passes end-to-end
- [x] 7.2 Verify the affected apps start in the local environment (smoke test) — boot `apps/web` (and the `apps/api` it depends on) and confirm no startup/config errors and the dashboard renders for a seeded user
- [x] 7.3 REFACTOR: Clean up e2e seeding helpers and any duplicated test scaffolding

## 8. Change Review — Subagent Verification

- [ ] 8.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [ ] 8.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 9. Polish

- [ ] 9.1 Run linter and fix all errors (`yarn lint`)
- [ ] 9.2 Run formatter and apply fixes (`yarn format`)
- [ ] 9.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [ ] 9.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
