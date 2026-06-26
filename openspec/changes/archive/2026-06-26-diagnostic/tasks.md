## 0. Acceptance Test — Outer Loop RED

<!-- Adaptation: backend-only change (like quiz, sessions, mock-exam, readiness) — the outer acceptance test is a full-app API-level `*.acceptance.spec.ts` (Supertest through the booted Nest app on Testcontainers), not Playwright e2e; the diagnostic UI belongs to the downstream `web-onboarding` change. See design.md Test Boundaries. -->

- [x] 0.1 Build a diagnostic acceptance harness (authenticated user enrolled in a `live` certification with enough content across all domains to generate from), mirroring `mock-exam/test/mock-exam-acceptance-harness.ts`; mock the Vercel AI SDK at the `ProviderAdapter` boundary, keep Postgres/Redis real, and provide a deterministic way to drive the diagnostic generation job (SPEC → Diagnostic Exam)
- [x] 0.2 Write failing acceptance spec `apps/api/src/diagnostic/diagnostic.acceptance.spec.ts`: an uncalibrated user requests the diagnostic offer (sees `onboarding`), creates a diagnostic, the generation job fills the breadth set (every domain probed, `deadline` null, `generation: ready`), the user answers some questions (leaving some blank), submits, and sees a score + domain breakdown with `passed` null; then readiness flips to a numeric `calibrated` score, a `WeakArea` row exists per probed domain, and an incorrect answer seeded a `ReviewItem` (covers diagnostic-exam scenarios "Creating a diagnostic enqueues generation", "A completed diagnostic is ready with no countdown", "Submitting a diagnostic seeds the weak-area map", "Diagnostic misses seed the review queue", "A completed diagnostic calibrates readiness", "Submitted diagnostic reports score and breakdown but no verdict")
- [x] 0.3 Write a second failing acceptance path: a user creates a diagnostic, abandons it (never submits); the mock auto-submit cron runs and leaves it `in_progress`, emitting no `QuizResponse` and seeding nothing (covers "The auto-submit cron ignores an abandoned diagnostic")
- [x] 0.4 Confirm all paths fail for the right reason (no `DiagnosticModule`/endpoints/breadth generation yet), not a harness/setup error

## 1. Shared contracts (`packages/shared`)

- [x] 1.1 RED: Write a type/schema test asserting the diagnostic DTOs exist — diagnostic offer response (`offer: 'onboarding' | 're-prompt' | 'none'`) and the diagnostic-create response (reusing the `MockExamResponse` shape with `type: diagnostic`) — and that the `MockExamResponse.passed` field is nullable (SPEC → Diagnostic Exam)
- [x] 1.2 GREEN: Add the diagnostic offer enum + DTOs to `packages/shared` and make `MockExamResponse.passed` nullable; reuse the existing `MOCK_EXAM_GENERATION_QUEUE` and `MockExamGenerationJobPayload` (`{ attemptId }`) for diagnostic generation — no new queue or payload (see design.md → branch generation by type); export the new types from the package index
- [x] 1.3 REFACTOR: Align naming and reuse the existing `MockExam*` shared types rather than duplicating fields

## 2. `UserCertification.diagnosticRePromptedAt` column + migration (`packages/db`)

- [x] 2.1 RED: Write an integration test (Supertest + Testcontainers) asserting the migration adds a nullable `diagnostic_re_prompted_at` timestamp column to `user_certification` — covers the one-time re-prompt storage (SPEC → Diagnostic Exam "re-prompted once")
- [x] 2.2 GREEN: Add the nullable `diagnosticRePromptedAt` property to the `UserCertification` entity and create the migration (`yarn workspace @readion/db migration:create`); do not modify any committed migration
- [x] 2.3 REFACTOR: Confirm the column defaults to null and aligns with sibling nullable-timestamp conventions

## 3. Config (`apps/api`)

- [x] 3.1 RED: Write a unit test for the env schema asserting `DIAGNOSTIC_QUESTION_COUNT` (default 12) and `DIAGNOSTIC_REPROMPT_AFTER_SESSIONS` (default 1) are Zod-validated with defaults and rejected when malformed
- [x] 3.2 GREEN: Add both keys to the api env schema with Zod validation and defaults
- [x] 3.3 REFACTOR: Document the keys in `apps/api/.env.example`

## 4. Breadth planner (pure logic)

- [x] 4.1 RED: Write unit tests for the breadth planner: every domain gets ≥ 1 slot; total equals `DIAGNOSTIC_QUESTION_COUNT`; remaining slots beyond the floor follow exam-share weight via largest-remainder; when `budget < domainCount` the effective budget clamps up so every domain still gets a slot; the planner is pure/deterministic (covers "Every domain receives at least one slot", "Remaining slots follow exam-share weight", "Planner is deterministic")
- [x] 4.2 GREEN: Implement the pure breadth planner `(domains, weights, budget) -> DomainSlot[]` (one-per-domain floor, then largest-remainder by weight), no I/O, count from config
- [x] 4.3 REFACTOR: Factor out the shared largest-remainder helper used by the mock planner so the two planners do not duplicate it

## 5. Diagnostic generation branch + processor (`apps/api`)

- [x] 5.1 RED: Write integration tests for diagnostic generation: it plans via the breadth planner to `DIAGNOSTIC_QUESTION_COUNT`, generates each question via the verified quiz pipeline (persisting `sourceChunkIds`/`supportingSpans`/verdict), and on completion stamps `startedAt` while leaving `deadline` null; before completion `generation` reports `preparing` (covers "Each diagnostic question is grounded and verified", "Questions appear incrementally before completion", diagnostic-exam "A completed diagnostic is ready with a null deadline")
- [x] 5.2 GREEN: Branch `MockExamGenerationService` on `attempt.type` (breadth planner + `DIAGNOSTIC_QUESTION_COUNT` for `diagnostic`, unchanged proportional planner + cert question count for `mock`); branch the processor's completion check and timer stamping (mock stamps `deadline`, diagnostic leaves it null) — covers mock-exam MODIFIED "Stream-in generation … with a deferred deadline"
- [x] 5.3 REFACTOR: Keep one generation path; reuse the shortfall handling so a sparse domain never strands the diagnostic in `preparing`

## 6. Generation-ready derivation (`apps/api` mock-exam mapping)

- [x] 6.1 RED: Write unit/integration tests asserting `deriveGeneration` reports `ready` when `startedAt` is set (deadline may be null) and `preparing` otherwise, and `remainingSeconds` is null when `deadline` is null; mock attempts (both stamped) still report `ready` with a countdown (covers mock-exam MODIFIED generation scenarios "Mock deadline starts only when the full set is ready", "Diagnostic is ready with a null deadline")
- [x] 6.2 GREEN: Change `deriveGeneration` to key off `startedAt !== null`; keep `deriveRemainingSeconds` null-safe for null deadlines
- [x] 6.3 REFACTOR: Confirm the change is behavior-equivalent for mocks and covered by existing mock generation tests

## 7. Finalize: review seeding + pass/fail suppression (`apps/api`)

- [x] 7.1 RED: Write integration tests: finalizing a `diagnostic` emits one `QUIZ_ANSWERED_EVENT` per question (so `spaced-repetition` accrual enqueues misses) and sets `passed = null`, while finalizing a `mock` keeps its current behavior (no event, computed `passed`) — covers diagnostic-exam "Diagnostic misses seed the review queue", "Submitted diagnostic reports score and breakdown but no verdict" and mock-exam MODIFIED "Submitting a diagnostic scores without a pass/fail verdict"
- [x] 7.2 GREEN: Parameterize `finalizeAttempt` to optionally emit `QUIZ_ANSWERED_EVENT` per question and to set `passed = null` for `type: diagnostic`; the diagnostic submit path passes emit=true
- [x] 7.3 REFACTOR: Keep `QuizResponse` emission + `WeakAreasService.recompute` shared and unchanged; ensure the mock path is untouched

## 8. Readiness diagnostic-weight exclusion (`apps/api`)

- [x] 8.1 RED: Write unit tests for the readiness calculator/service: `type: diagnostic` `MockExam`s are excluded from the higher-weight mock blend while still calibrating the gate and contributing via `WeakArea`; a diagnostic-only enrollment is no higher than an equivalent mock-only enrollment (covers exam-readiness MODIFIED "A diagnostic does not carry the elevated mock weight", "A mock result shifts readiness more than an equivalent quiz result")
- [x] 8.2 GREEN: Filter the high-weight `mockResults` in `readiness.service.ts` to `type === 'mock'`; leave the `hasCompletedDiagnostic` calibration check unchanged
- [x] 8.3 REFACTOR: Confirm the diagnostic still flips calibration and influences the score solely through the recency-decayed `WeakArea` path

## 9. Diagnostic create flow + module (`apps/api`)

- [x] 9.1 RED: Write integration tests for `POST /api/v1/user-certifications/:id/diagnostic`: returns `201` with a `diagnostic`, deadline-less, empty-questions attempt and enqueues breadth generation; a `draft` cert returns `409`; another user's enrollment returns `404` (covers "Creating a diagnostic enqueues generation", "Diagnostic is not offered for a non-live certification", "Cannot create a diagnostic for an enrollment the user does not own")
- [x] 9.2 GREEN: Implement `DiagnosticModule` + controller + service creating the `type: diagnostic` `MockExam` (live-cert guard, ownership scoping on `userId`) and enqueueing generation; wire it into the app module
- [x] 9.3 REFACTOR: Reuse the existing `GET /mock-exams/:id`, `PUT /mock-exams/:id/answers/:questionIndex`, and `POST /mock-exams/:id/submit` for taking/answer/submit/review (no parallel endpoints); confirm `{ data }` envelope

## 10. Diagnostic offer + one-time re-prompt (`apps/api`)

- [x] 10.1 RED: Write unit tests for the pure offer derivation (`onboarding` / `re-prompt` / `none`) over (calibrated?, hasCompletedDiagnostic?, cert live?, completedSessionCount, `DIAGNOSTIC_REPROMPT_AFTER_SESSIONS`, `diagnosticRePromptedAt`), then integration tests for `GET /api/v1/user-certifications/:id/diagnostic-offer` and `POST .../diagnostic-offer/dismiss` (dismiss stamps `diagnosticRePromptedAt`, subsequent offer is `none`; cross-user `404`) — covers all "Onboarding offer and one-time re-prompt" + ownership scenarios
- [x] 10.2 GREEN: Implement the pure offer derivation and the two endpoints (read-through calibration via `ReadinessService.compute`, completed-session count, ownership scoping)
- [x] 10.3 REFACTOR: Keep the derivation pure and the controller thin; confirm `re-prompt` is shown only once

## 11. Re-take re-seeding (`apps/api`)

- [x] 11.1 RED: Write an integration test: an enrollment with prior session `QuizResponse`s completes a second diagnostic; the prior responses remain and the recomputed `WeakArea` map reflects both (covers "A second diagnostic preserves accumulated responses")
- [x] 11.2 GREEN: Confirm the create + finalize path relies on the idempotent `WeakAreasService.recompute` (no special-casing needed beyond emitting the new responses); add only what the test requires
- [x] 11.3 REFACTOR: Remove any redundant guard; ensure no real session/mock data is wiped on re-take

## 12. Acceptance Test — Outer Loop GREEN

- [x] 12.1 Confirm both acceptance paths pass end-to-end
- [x] 12.2 Verify all affected apps start in the local environment (smoke test) — boot `apps/api` (and `apps/worker`) and confirm no startup/config errors; regenerate and commit the Orval client (`yarn codegen`) for the new endpoints
- [x] 12.3 REFACTOR: Clean up test setup and mocks if needed

## 13. Change Review — Subagent Verification

- [x] 13.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 13.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 14. Polish

- [x] 14.1 Run linter and fix all errors (`yarn lint`)
- [x] 14.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 14.3 Run type checker with zero errors (`yarn workspace apps/api typecheck`)
- [x] 14.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
