## 0. Acceptance Test — Outer Loop RED

<!-- Adaptation: backend-only change (like quiz, sessions, review-srs) — the outer acceptance test is a full-app API-level `*.acceptance.spec.ts` (Supertest through the booted Nest app on Testcontainers), not Playwright e2e; the mock-exam UI belongs to the downstream `web-mock-exam` change. See design.md Test Boundaries. -->

- [x] 0.1 Build a mock-exam acceptance harness (authenticated user with an active enrollment in a `live` certification that has enough content to generate from), mirroring `sessions/test/sessions-acceptance-harness.ts`; mock the Vercel AI SDK at the `ProviderAdapter` boundary, keep Postgres/Redis real, and provide a deterministic way to drive the generation job and auto-submit cron from the test (see design.md Test Boundaries)
- [x] 0.2 Write failing acceptance spec `apps/api/src/mock-exam/mock-exam.acceptance.spec.ts`: a user creates a mock, the generation job fills + verifies the full set and stamps the deadline, the user answers some questions (leaving some blank), submits, and sees an overall score, pass/fail, and per-domain breakdown with unanswered scored incorrect; then re-fetches in review mode and sees correct answers + citations (covers spec scenarios "Creating a mock enqueues generation", "Deadline starts only when the full set is ready", "Submitting scores the attempt", "Reviewing a submitted attempt")
- [x] 0.3 Write a second failing acceptance path: a user creates a mock, lets the deadline pass, and the auto-submit cron expires + scores it with unanswered as incorrect (covers "Past-deadline attempt is expired and scored")
- [x] 0.4 Confirm both fail for the right reason (no `MockExamModule`/endpoints/worker job yet), not a harness/setup error

## 1. MockExam entity + migration (deepest data layer)

- [x] 1.1 RED: Write integration test (Supertest + Testcontainers) asserting the migration creates a `mock_exam` table with `User` FK, `UserCertification` FK, `type` enum (`mock`/`diagnostic`), `status` enum (`in_progress`/`submitted`/`expired`), nullable `started_at`/`deadline`, `score`, `passed`, JSONB `domain_breakdown`, and JSONB `questions` — covers "Migration creates the MockExam table" + "Type enum accepts diagnostic"
- [x] 1.2 GREEN: Add the `MockExam` MikroORM entity in `packages/db` and create the migration (`yarn workspace @readion/db migration:create`)
- [x] 1.3 REFACTOR: Align entity conventions (base entity, indexes on `userCertification`, `status`, and `deadline`) with sibling entities

## 2. Mock scoring (pure logic)

- [x] 2.1 RED: Write unit tests for `MockExamScorer`: correct/incorrect/unanswered tallying, unanswered-as-incorrect, overall score = correct/total, pass/fail vs. passing score (boundary at exactly the passing score), and per-domain breakdown by question domain — covers "Submitting scores the attempt" + "Scoring is pure and deterministic"
- [x] 2.2 GREEN: Implement the pure `MockExamScorer` taking `(questions, answers, domainWeights, passingScore)` returning `{ score, passed, domainBreakdown }`, no I/O
- [x] 2.3 REFACTOR: Ensure passing score / domain weights are inputs (never hardcoded) and the same scorer is the single source for both submit paths

## 3. Question-set generation via the quiz pipeline

- [x] 3.1 RED: Write integration tests for the generation step: it allocates question slots across domains by the cert's domain weights to the cert's question count, generates each via the quiz pipeline under the verifier guarantee, persists each verified question with its `sourceChunkIds`/`supportingSpans`/verifier verdict, and substitutes a replacement when a question fails verification — covers "Each generated question is verified individually" + "Questions appear before the clock starts"
- [x] 3.2 GREEN: Implement the generation service that consumes `QuizModule`'s verified-question generation per (domain, difficulty) slot and persists results onto the attempt incrementally
- [x] 3.3 REFACTOR: Reuse `QuizModule`'s verified-question cache where the key matches; keep generation unaware of HTTP/timer concerns

## 4. Generation BullMQ job + deferred deadline (apps/api — see design.md revision)

- [x] 4.1 RED: Write integration test: invoking the generation job for an attempt fills + verifies the full set, then stamps `started_at` and `deadline = started_at + timeLimit`; before completion the attempt's `deadline` stays null and `generation` reports `preparing` — covers "Deadline starts only when the full set is ready"
- [x] 4.2 GREEN: Implement the BullMQ `MockExamGenerationProcessor` hosted in `apps/api` (`MockExamModule`) consuming `MOCK_EXAM_GENERATION_QUEUE`, calling the verified `MockExamGenerationService` and stamping the timer on completion only
- [x] 4.3 REFACTOR: Make generation idempotent/re-runnable (a re-enqueued job for a partially generated attempt resumes, never duplicates questions)

## 5. Create endpoint + ownership scoping

- [x] 5.1 RED: Write integration tests for `POST /api/v1/user-certifications/:id/mock-exams`: returns `201` with an `in_progress`, deadline-less, empty-questions attempt and enqueues generation; creating for another user's enrollment returns `404` — covers "Creating a mock enqueues generation" + "Cannot create a mock for an enrollment the user does not own"
- [x] 5.2 GREEN: Implement the controller + service reading question count / time limit / passing score / domain weights from the `Certification`, persisting the attempt, and enqueueing the generation job; scope the enrollment lookup on `userId` at the repository layer
- [x] 5.3 REFACTOR: Wrap the response in the `{ data }` envelope; confirm no `mock`/`diagnostic` create branching leaks diagnostic concerns

## 6. Get endpoint — generation status, timer, resume, review

- [x] 6.1 RED: Write integration tests for `GET /api/v1/mock-exams/:id`: returns partial questions + null deadline + `generation: preparing` mid-generation; returns `remainingSeconds` from `deadline - now` and preserved answers after a simulated disconnect; returns correct answers + explanations + citations once `submitted`/`expired`; in-progress GET never leaks correct answers; another user's attempt returns `404` — covers "Questions appear before the clock starts", "Resuming preserves answers and the running clock", "Reviewing a submitted attempt", "Fetching another user's attempt returns 404"
- [x] 6.2 GREEN: Implement the read service computing `remainingSeconds` server-side and gating correct-answer/explanation/citation fields behind a terminal status; resolve citations from the persisted provenance snapshot (not live chunks)
- [x] 6.3 REFACTOR: Single read path serving both the taking view (no answers leaked) and the review view (terminal); confirm citation resolution stays faithful after chunk supersession ("Review citations remain faithful after chunk supersession")

## 7. Answer persistence

- [x] 7.1 RED: Write integration tests for the answer endpoint: upsert overwrites the prior answer with no duplicate rows while `in_progress` and before deadline; answering a `submitted`/`expired` or past-deadline attempt returns `409` — covers "Saving and overwriting an answer" + "Answering a terminal attempt is rejected"
- [x] 7.2 GREEN: Implement the answer upsert onto the attempt's question array, guarded by `status === in_progress && now <= deadline`
- [x] 7.3 REFACTOR: Keep the no-agent invariant explicit — the attempt exposes no agent endpoints and creates no `AgentConversation` ("No agent access during the exam")

## 8. Submit endpoint + weak-area update

- [x] 8.1 RED: Write integration tests for `POST /api/v1/mock-exams/:id/submit`: scores via `MockExamScorer` (unanswered incorrect), transitions to `submitted`, persists score/passed/breakdown, emits one enrollment-scoped `QuizResponse` per question (each embedding its provenance snapshot, unanswered as incorrect, neutral confidence 3), and updates `WeakArea` per domain via `WeakAreasService.recompute`; submitting an already-terminal attempt returns `409` — covers "Submitting scores the attempt", "Mock answers are recorded as enrollment QuizResponses", "Domain breakdown feeds weak areas via recompute", "Submitting an already-terminal attempt is rejected"
- [x] 8.2 GREEN: Implement the submit action with a guarded `in_progress → submitted` transition, calling the scorer, emitting the per-question `QuizResponse`s, then calling `WeakAreasService.recompute(userCertificationId)`
- [x] 8.3 REFACTOR: Extract a shared finalize-attempt routine (score → persist result → emit `QuizResponse`s → recompute weak areas → set terminal status) reused by the auto-submit cron; make the neutral confidence value config-driven

## 9. Auto-submit cron (apps/api — see design.md revision)

- [x] 9.1 RED: Write integration tests for the cron: an `in_progress` attempt past `deadline + grace` is scored, marked `expired`, its per-question `QuizResponse`s emitted, and its weak areas recomputed; an attempt past `deadline` but within grace is left `in_progress` — covers "Past-deadline attempt is expired and scored" + "Within-grace attempt is left untouched"
- [x] 9.2 GREEN: Implement the `@nestjs/schedule` cron in `apps/api` selecting expired-past-grace attempts and calling the shared finalize routine (`MockExamService.finalizeAttempt`) with terminal status `expired`
- [x] 9.3 REFACTOR: Add the grace window as a Zod-validated `@nestjs/config` value (default 2 min); guard against the cron/manual-submit race (second writer no-ops on non-`in_progress`)

## 10. List endpoint

- [x] 10.1 RED: Write integration test for `GET /api/v1/user-certifications/:id/mock-exams`: returns `{ data[], meta }` of only the owner's attempts for that enrollment; another user's enrollment returns `404` — covers "Listing returns only the owner's attempts"
- [x] 10.2 GREEN: Implement the list controller + repository query scoped on `userId`, wrapped in the `{ data[], meta }` envelope with pagination defaults
- [x] 10.3 REFACTOR: Reuse the shared ownership-scoped repository query across get/list/submit/answer

## 11. Acceptance Test — Outer Loop GREEN

- [x] 11.1 Confirm both acceptance specs pass end-to-end (happy-path submit + auto-submit-on-expiry)
- [x] 11.2 Verify affected apps start in the local environment (smoke test) — boot `apps/api` and `apps/worker`, confirm no startup/config errors; run `yarn codegen` and commit the regenerated Orval client
- [x] 11.3 REFACTOR: Clean up test setup, fixtures, and the AI SDK mock

## 12. Change Review — Subagent Verification

- [x] 12.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 12.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests
<!-- Review: no CRITICAL. W1 (slot-drop strands attempt), W2 (duplicate same-domain questions), W3 (concurrent submit → 409), W4 (ScheduleModule.forRoot in AppModule) all FIXED with new tests. S1/S3/S4 applied. S2 (unchecked JSON.parse of quiz cache payload) ACCEPTED/deferred — payload is written+verified by the quiz pipeline before caching, so risk is minimal; noted as future hardening. Affected suites (quiz+grounding+mock-exam, 145 tests) re-run green. -->


## 13. Polish

- [x] 13.1 Run linter and fix all errors (`yarn lint`)
- [x] 13.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 13.3 Run type checker with zero errors (`yarn workspace apps/api typecheck` and `yarn workspace apps/worker typecheck`)
- [x] 13.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
<!-- Coverage: Statements 96.33%, Branches 80.97%, Functions 96.22%, Lines 97.81% — all ≥80%. The full-suite run's single failure was a flaky 10s hook timeout in the pre-existing observability/tracing.spec.ts (Testcontainer startup under heavy parallel coverage load), which passes 3/3 in isolation and is unrelated to this change. -->

