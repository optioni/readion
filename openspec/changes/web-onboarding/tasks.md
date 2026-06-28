## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the Playwright e2e harness for onboarding (`apps/web/e2e/onboarding.spec.ts`) against the real Nuxt app + NestJS API + Postgres/Redis (Testcontainers / docker-compose); seed via the real API: a first-user admin, a live certification, and an authenticated session (see design.md Test Boundaries)
- [x] 0.2 Write failing acceptance test for the happy path: new verified user with no enrollments → routed to `/onboarding` → selects the live cert → sets defaults (duration 60, learning style spaced-repetition) → enrolls → diagnostic offer `onboarding` shown → Skip → lands on dashboard with the new enrollment present
- [x] 0.3 Write failing acceptance tests for the edge scenarios: already-enrolled user redirected away from `/onboarding`; non-admin with zero certs sees "No certifications available yet"; admin with zero certs routed to the admin cert-setup placeholder route; diagnostic Take navigates to the mock-exam runner placeholder route
- [x] 0.4 Confirm all acceptance tests fail for the right reason (flow/pages not implemented, not a harness/setup error)

## 1. Client-contract guard + onboarding query keys

- [x] 1.1 RED: Write a unit test asserting the required Orval client methods exist and are importable — `certificationsControllerList`, `usersControllerGetMe`, `usersControllerUpdateMe`, `userCertificationsControllerEnroll`, `userCertificationsControllerList`, `diagnosticControllerGetOffer`, `diagnosticControllerCreate`, `diagnosticControllerDismissOffer`
- [x] 1.2 GREEN: Add `app/composables/onboardingQueryKeys.ts` (keys for `certifications`, `profile`, `enrollments`, `diagnosticOffer(enrollmentId)`), mirroring the `dashboardQueryKeys` factory style; no codegen
- [x] 1.3 REFACTOR: Ensure key namespacing does not collide with `dashboardQueryKeys`; reuse the dashboard `enrollments`/`certifications` keys where invalidation must cross over (enroll invalidates `dashboardQueryKeys.enrollments()`)

## 2. Onboarding gate + routing composable (pure logic)

- [x] 2.1 RED: Write unit tests for a pure `resolveOnboardingRoute({ certs, role, enrollments })` function covering: ≥1 active enrollment → dashboard; 0 enrollments + ≥1 live cert → onboarding; 0 certs + admin → admin-cert-setup placeholder; 0 certs + non-admin → no-certs empty state
- [x] 2.2 GREEN: Implement `app/composables/useOnboardingGate.ts` (queries `usersControllerGetMe` for role + sessionDefaults, `certificationsControllerList`, `userCertificationsControllerList({status:'active'})`) wrapping the pure resolver
- [x] 2.3 REFACTOR: Extract the pure resolver into a separately tested helper; ensure role is read from `GET /users/me` (not the auth store, which omits `role` — see design.md reconciliation)

## 3. Route middleware / page guard

- [x] 3.1 RED: Write a unit/integration test (Vitest + `@nuxt/test-utils`, mocked HTTP) asserting navigating to `/onboarding` with an existing active enrollment redirects to `/`, and that a no-certs non-admin renders the empty state
- [x] 3.2 GREEN: Implement the route middleware/guard for `app/pages/onboarding/` using `useOnboardingGate`, redirecting per the resolver
- [x] 3.3 REFACTOR: Ensure the guard runs after auth bootstrap (`web-auth`) and degrades gracefully while queries load (skeleton, no premature redirect)

## 4. Cert-select step component

- [x] 4.1 RED: Write a unit test (mocked HTTP) for the cert-select component: renders one option per `GET /certifications` item showing `name` + `provider`; Continue disabled until a selection is made; emits the chosen `certificationId`
- [x] 4.2 GREEN: Implement the cert-select step component reusing the `AddCertificationModal` row style and selected-state token (`primary.default`); drive options off `certificationsControllerList` (live-only, no client-side filtering)
- [x] 4.3 REFACTOR: Share row markup/util with the dashboard add-cert pattern where reasonable without coupling to `web-dashboard`'s modal

## 5. Default session-preferences step component

- [x] 5.1 RED: Write a unit test for the prefs form: pre-fills the five fields from `GET /users/me` `sessionDefaults` (e.g. `DEFAULT_SESSION_DEFAULTS`); option sets come from the shared `sessionDefaults*` enums; emits the chosen values
- [x] 5.2 GREEN: Implement the prefs form (duration 15/30/60/90, content mix, difficulty, focus area, learning style) bound to the shared `@readion/shared` enums
- [x] 5.3 REFACTOR: Validate against `sessionDefaultsSchema` shape; send the full chosen `sessionDefaults` set (all five fields) in both the `PATCH /users/me` and the enroll bodies for an unambiguous, idempotent write

## 6. Enroll + diagnostic action composable

- [x] 6.1 RED: Write unit tests (mocked HTTP) for the actions: `saveDefaultsAndEnroll` calls `PATCH /users/me` then `POST /user-certifications` with `{certificationId, sessionDefaults}` and returns the enrollment id, invalidating `dashboardQueryKeys.enrollments()`; on enroll 422 it surfaces an error and does not advance; `takeDiagnostic(id)` calls `POST /:id/diagnostic` then navigates to the runner route; `skipDiagnostic(id)` calls `POST /:id/diagnostic-offer/dismiss` then navigates to `/`
- [x] 6.2 GREEN: Implement `app/composables/useOnboardingActions.ts` wrapping the enroll, diagnostic-create, and dismiss client calls with the navigation targets (placeholder routes for the runner)
- [x] 6.3 REFACTOR: Centralize placeholder route constants (mock-exam runner, admin cert-setup) so they are easy to reconcile when `web-mock-exam` / `web-admin` land

## 7. Diagnostic offer step + re-prompt nudge components

- [x] 7.1 RED: Write unit tests for the offer card (shows Take/Skip when `offer==='onboarding'`; proceeds to dashboard when `offer==='none'`) and the dashboard re-prompt nudge (renders only when `offer==='re-prompt'`; Skip dismisses and resolves to `none`; Take starts the diagnostic)
- [x] 7.2 GREEN: Implement the diagnostic offer step component and the standalone re-prompt nudge component (both driven by `diagnosticControllerGetOffer`), reusing `useOnboardingActions`
- [x] 7.3 REFACTOR: Mount the re-prompt nudge on the dashboard without modifying `web-dashboard`'s owned card components beyond the mount point

## 8. Onboarding page assembly + no-certs empty state

- [x] 8.1 RED: Write a unit/integration test for `app/pages/onboarding/index.vue` assembling the steps in order and rendering the "No certifications available yet" empty state for the non-admin/no-certs branch
- [x] 8.2 GREEN: Implement `app/pages/onboarding/index.vue` (and any sub-route) wiring the gate, cert-select, prefs, and diagnostic-offer steps plus the empty state, using the spec/DESIGN.md-derived layout (centered column, `surface` step cards, `label` headings, `primary.default` CTAs)
- [x] 8.3 REFACTOR: Apply the design.md Visual Design tokens/layout; leave a code comment referencing the canonical `Onboarding.html` artboard (V3 sidebar wizard)

## 9. Acceptance Test — Outer Loop GREEN

- [x] 9.1 Confirm all onboarding acceptance tests pass end-to-end against the real API
- [x] 9.2 Verify the affected app starts in the local environment (smoke test) — boot `apps/web` (and the API it depends on) and confirm no startup/config errors
- [x] 9.3 REFACTOR: Clean up test setup, fixtures, and placeholder-route handling

## 10. Change Review — Subagent Verification

- [ ] 10.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [ ] 10.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 11. Polish

- [ ] 11.1 Run linter and fix all errors (`yarn lint`)
- [ ] 11.2 Run formatter and apply fixes (`yarn format:fix`)
- [ ] 11.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [ ] 11.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace apps/web test:coverage`)
