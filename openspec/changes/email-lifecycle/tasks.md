## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up e2e harness: Testcontainers Postgres + Redis, API + worker under `@nestjs/testing`, the mail capturing transport, and a registered+verified test user with an enrollment seeded with weak-area/quiz data (SPEC → Email; Testing Strategy)
- [x] 0.2 Write failing Playwright/e2e: (a) registration captures exactly one welcome email; (b) triggering the digest internal endpoint for a due user captures a digest containing readiness %, weekly delta, weakest domain, due-review count, and an unsubscribe link; clicking unsubscribe opts the user out; (c) triggering the nudge internal endpoint for an exam-ready, lulled enrollment captures a survey email, and `POST /user-certifications/:id/exam-outcome` records the response without changing readiness
- [x] 0.3 Confirm it fails for the right reason (modules/routes/templates absent, not a harness error)

## 1. Shared contracts, config & migrations

- [x] 1.1 RED: Unit test the exam-outcome response option set and the lifecycle-email config defaults/validation in `packages/shared` (allowed responses; `EXAM_READY_THRESHOLD` default 80; `NUDGE_MAX_FOLLOWUPS` default 1; weekday/hour/lull/delay numeric)
- [x] 1.2 GREEN: Add `packages/shared` constants + DTO/types (exam-outcome response, digest/nudge payload types) and the new env-schema keys for `apps/api` (`DIGEST_SEND_WEEKDAY`, `DIGEST_SEND_HOUR`, `EXAM_READY_THRESHOLD`, `NUDGE_ACTIVITY_LULL_DAYS`, `NUDGE_FOLLOWUP_DELAY_DAYS`, `NUDGE_MAX_FOLLOWUPS`, `PUBLIC_API_URL`, `INTERNAL_API_SECRET`) and `apps/worker` (`DIGEST_SEND_WEEKDAY`, `DIGEST_SEND_HOUR`, `NUDGE_ACTIVITY_LULL_DAYS`, `INTERNAL_API_BASE_URL`, `INTERNAL_API_SECRET`), and add every new key to `apps/api/.env.example` and `apps/worker/.env.example` (SPEC → Email, Configuration)
- [x] 1.3 RED: Integration test (Testcontainers) asserting the migrated `users` table has `digest_opt_out` (default false), `unsubscribe_token`, `last_digest_sent_at`, and `user_certifications` has `last_digest_readiness`, `exam_outcome_nudge_sent_at`, `exam_outcome_nudge_count` (default 0), `exam_outcome_response`, `exam_outcome_responded_at`, with correct defaults on existing rows
- [x] 1.4 GREEN: Extend the `User` and `UserCertification` schemas and generate two migrations (no new entity — extension only, per Entity Ownership); verify `migration:up`/`migration:down` round-trip
- [x] 1.5 REFACTOR: Single-source the exam-outcome option set so DTO validators and the entity reference one definition

## 2. Welcome email (`apps/api`)

- [x] 2.1 RED: Unit test that the `welcome` template renders a non-empty subject/text/html wrapped in the base layout (pure renderer, per the mail template contract)
- [x] 2.2 GREEN: Add the `welcome` template to the mail registry
- [x] 2.3 RED: Integration test that successful registration records exactly one welcome email via the capturing transport, and that a transport rejection is swallowed-and-logged without failing registration (SPEC → Email)
- [x] 2.4 GREEN: Wire a non-blocking welcome send into the registration success path (resolve the exact hook point against the `auth` registration flow)
- [x] 2.5 REFACTOR: Tidy the trigger wiring

## 3. Digest assembly + templates (`apps/api`)

- [x] 3.1 RED: Unit test digest assembly logic with mocked `ReadinessService`/`WeakAreasService`/`ReviewService` — produces readiness %, weakest domain, due count; computes weekly delta from the snapshot; first-digest has no delta; uncalibrated enrollment yields the keep-going variant and no delta (SPEC → Email)
- [x] 3.2 GREEN: Implement `LifecycleEmailService.assembleDigest` + the `digest` template (encouraging tone, unsubscribe link from `PUBLIC_API_URL` + per-user token)
- [x] 3.3 RED: Integration test (Testcontainers) — assembling+sending a digest for a seeded enrollment records one email with all four metrics and an unsubscribe link, then persists `last_digest_sent_at` and the per-enrollment `last_digest_readiness` snapshot
- [x] 3.4 GREEN: Implement digest send + snapshot/last-sent persistence using the real services and `MailService`
- [x] 3.5 REFACTOR: Extract delta + keep-going formatting as pure helpers

## 4. One-click unsubscribe (`apps/api`)

- [x] 4.1 RED: Integration test `GET /api/v1/email/unsubscribe?token=…` — valid token sets `digest_opt_out` and confirms; idempotent on repeat; unknown token returns a generic confirmation with no state change (SPEC → Email: one-click unsubscribe)
- [x] 4.2 GREEN: Implement the public unsubscribe controller + stable per-user `unsubscribe_token` (generated lazily if absent)
- [x] 4.3 REFACTOR: Ensure the endpoint is excluded from auth and reveals nothing about token validity

## 5. Timezone-aware digest cron (`apps/worker`)

- [x] 5.1 RED: Unit test the local-window predicate with an injected clock, table-driven across `Europe/Helsinki`, `America/New_York`, and a DST transition — selects on local weekday+hour, excludes opted-out, and suppresses a second send within the same local week (SPEC → Email; Cross-cutting deliverables → Weekly progress digest)
- [x] 5.2 GREEN: Implement the digest scheduler cron doing DB-readable timezone/opt-out/last-sent selection
- [x] 5.3 RED: Integration test invoking the cron method directly — due users are POSTed to the API internal digest endpoint and a digest is captured; opted-out and already-sent users are skipped
- [x] 5.4 GREEN: Implement the worker HTTP client call to `POST /internal/lifecycle/digest` (reuse the scrapper-client pattern) with the shared secret

## 6. Internal trigger endpoints + guard (`apps/api`)

- [ ] 6.1 RED: Integration test `POST /internal/lifecycle/digest` and `/nudge` — valid `INTERNAL_API_SECRET` assembles+sends for eligible candidates; missing/wrong secret is rejected with no send; endpoints absent from the public OpenAPI doc
- [ ] 6.2 GREEN: Implement the internal controller + shared-secret guard, excluded from `JwtAuthGuard` and the Orval surface
- [ ] 6.3 REFACTOR: Constant-time secret comparison; tidy guard wiring

## 7. Post-exam nudge (`apps/api` gate/send + `apps/worker` lull cron)

- [ ] 7.1 RED: Unit test the worker lull-candidate selection with an injected clock — selects enrollments with no activity within `NUDGE_ACTIVITY_LULL_DAYS` and unexhausted allowance; excludes recently active ones (SPEC → Email; PRD §3)
- [ ] 7.2 GREEN: Implement the worker nudge cron selecting lull candidates from DB activity timestamps and POSTing to `POST /internal/lifecycle/nudge`
- [ ] 7.3 RED: Unit/integration test the API nudge gate — sends only when calibrated and readiness ≥ `EXAM_READY_THRESHOLD`; not-ready/uncalibrated → no send; records the send; enforces ≤ `NUDGE_MAX_FOLLOWUPS` (one follow-up after the delay, none after any response including `dismissed`)
- [ ] 7.4 GREEN: Implement `LifecycleEmailService.maybeSendNudge` + the `exam-nudge` survey template, applying the readiness gate via `ReadinessService`
- [ ] 7.5 REFACTOR: Extract the allowance/follow-up policy as a pure, clock-injected helper

## 8. Exam-outcome survey response (`apps/api`)

- [ ] 8.1 RED: Integration test `POST /api/v1/user-certifications/:id/exam-outcome` — owner records `passed|did_not_pass|not_yet|dismissed` (200 + persisted + timestamp); readiness unchanged afterward; non-owner gets `404`; a recorded response stops further nudges (SPEC → Email; PRD §3)
- [ ] 8.2 GREEN: Implement the owner-scoped exam-outcome controller/service writing the response columns
- [ ] 8.3 REFACTOR: Confirm the response feeds no readiness path and is the signal future `product-analytics` reads

## 9. Acceptance Test — Outer Loop GREEN

- [ ] 9.1 Confirm the Playwright/e2e passes end-to-end (welcome, digest+unsubscribe, nudge+survey)
- [ ] 9.2 Verify api + worker boot locally with the new env keys (smoke test) — no startup/config errors
- [ ] 9.3 Regenerate the Orval client (`yarn codegen`) for the new public endpoints and commit it; confirm internal endpoints are excluded
- [ ] 9.4 Emit the opportunistic emails-sent counter against the existing observability infra on each welcome/digest/nudge send (proposal → Impact: Cross-cutting); no new metric is attributed to this change beyond this counter
- [ ] 9.5 REFACTOR: Clean up test setup, fixtures, and scaffolding

## 10. Change Review — Subagent Verification

- [ ] 10.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md plus the diff and this task list (reviewer reports findings only, does not edit code)
- [ ] 10.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 11. Polish

- [ ] 11.1 Run linter and fix all errors (`yarn lint`)
- [ ] 11.2 Run formatter and apply fixes (`yarn format`)
- [ ] 11.3 Run type checker with zero errors (`yarn typecheck`)
- [ ] 11.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
