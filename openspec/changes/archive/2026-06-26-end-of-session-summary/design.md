## Context

The study loop and all of the summary's inputs are implemented and archived: study sessions (`SessionsService`, `StudySession`/`SessionItem`, `createReviewSession`, the one-active-study-session-per-enrollment invariant), timed mocks/diagnostics (`MockExam` with its self-contained `questions`/`score`/`domainBreakdown`/`type`), per-domain aggregation (`WeakAreasService.recompute` + the pure `computeDomainScore`), readiness (`ReadinessService.compute` + the pure `computeReadiness` and `isCalibrated`), and the spaced-repetition accrual (`@OnEvent(QUIZ_ANSWERED_EVENT)` building `ReviewItem`s). What is missing is the read-side composition that SPEC → End-of-Session Summary requires after every session or mock, plus the "Drill my misses" action.

Reading the live `apps/api` code surfaced the constraints this design has to work within:

- **`QuizResponse` carries no link to `StudySession`.** It joins only to `UserCertification` (`apps/api/src/quiz/quiz.service.ts#submitAnswer`). Mock answers also become `QuizResponse` rows at `MockExamService.finalizeAttempt`, equally unlinked. So a study-session summary cannot select "this session's responses" by a foreign key.
- **The session row already bounds its own activity.** `StudySession` has `startedAt` and (on `end`) `endedAt`, and the archived invariant guarantees at most one `active` study session per enrollment — so the `[startedAt, endedAt]` window uniquely scopes that session's quiz responses for the enrollment without any schema change.
- **Mock attempts are self-contained.** `MockExam.questions` (each with `selectedAnswer`/`correctAnswer`/`domain`/`provenance`) plus `score` and `domainBreakdown` fully describe a mock/diagnostic, so its summary needs no response-window heuristic.
- **The scoring functions are pure.** `computeDomainScore(inputs)` and `computeReadiness({ perDomainScores, domainWeights, mockResults, now })` are side-effect-free, so a "before" baseline can be produced by re-running them over a filtered response set — no snapshot table is needed.
- **Misses already auto-seed review.** In-session quiz answers emit `QUIZ_ANSWERED_EVENT`, which the `review-srs` accrual turns into `ReviewItem`s. So the drill is purely the *don't-wait-for-the-interval* immediate option; it does not need to re-seed the queue.

This is a backend-only change; the summary screen and the "ask the agent about this question" / "Drill my misses" buttons belong to `web-session-view`.

## Goals / Non-Goals

**Goals:**
- `GET /api/v1/sessions/:id/summary` and `GET /api/v1/mock-exams/:id/summary` returning the SPEC summary shape (questions + accuracy, per-domain accuracy, weak-area deltas, readiness before→after, strongest/weakest question, next-session focus).
- `POST /api/v1/sessions/:id/drill` and `POST /api/v1/mock-exams/:id/drill` starting an immediate targeted session from this attempt's missed/flagged-unsure concepts, reusing `SessionsService.createReviewSession`.
- Pure, deterministic summary calculators (accuracy/per-domain rollups, before→after deltas via the existing pure scoring functions, strongest/weakest selection, next-focus selection) — the natural unit-test targets.
- A read-only summary path: producing a summary mutates no stored `WeakArea`/readiness state.
- No new entity, no migration, and no change to the quiz answer-submit path.

**Non-Goals:**
- All frontend (the summary screen, the agent and drill buttons) — `web-session-view`.
- The readiness / weak-area formula internals — `readiness` / `weak-areas` (reused as-is).
- The quiz answer-submit flow and `QuizResponse` shape — `quiz` (untouched).
- Mock-exam taking/scoring/finalize — `mock-exam` (reused as-is; not modified).
- The review-queue accrual itself — `review-srs` (drill is additive, not a re-seed).
- Wiring the agent for "ask about this question" — `agent` / `web-session-view`.

## Test Boundaries

| Dependency | In acceptance test (API-level Supertest) | In unit tests |
|---|---|---|
| Postgres (`StudySession`, `SessionItem`, `MockExam`, `QuizResponse`, `WeakArea`, `ContentChunk`, `UserCertification`) | real (Testcontainers) | not used (pure logic only) |
| Redis (BullMQ session-fill queue used by `createReviewSession`) | real (Testcontainers) | not used |
| LLM provider (Vercel AI SDK) — only reached when the drill generates quiz items | mocked at the AI SDK / `ProviderAdapter` boundary (deterministic stub) | n/a |
| `SessionsService` (incl. `createReviewSession`) | real module | mocked collaborator |
| `WeakAreasService` + `computeDomainScore` | real module | pure function, real (no mocks) |
| `ReadinessService` + `computeReadiness` / `isCalibrated` | real module | pure function, real (no mocks) |
| `MockExam` / `QuizResponse` / `ContentChunk` reads | real DB | n/a |
| Summary calculators (accuracy, deltas, strongest/weakest, next-focus) | exercised via the endpoints | pure (real, no mocks) |

Like the other backend-only study-feature changes (`quiz`, `sessions`, `mock-exam`, `readiness`, `diagnostic`), the outer acceptance test is a full-app API-level `*.acceptance.spec.ts` (Supertest through the booted Nest app on Testcontainers), not a Playwright e2e — the summary UI belongs to `web-session-view`. The summary calculators and the drill-target selection are pure logic and the natural unit-test targets; everything else runs through real modules against a real DB with only the LLM provider mocked for determinism on the drill path.

## Decisions

- **No new entity, no schema change; scope study-session responses by the session `[startedAt, endedAt]` window.** `QuizResponse` has no session FK, and the archived one-active-study-session-per-enrollment invariant means a session's window uniquely contains its quiz responses for that enrollment. *Alternative: add a nullable `study_session_id` FK to `quiz_responses` and thread `sessionId` through `QuizService.submitAnswer` — rejected: it modifies the archived `quiz` answer-submit capability and entity for a read-only feature, when the existing timestamps already bound the session; the roadmap also marks this change as introducing no entity. The window approach keeps the change purely additive.*
- **Compute "before" baselines by re-running the pure scoring functions over a filtered response set; never snapshot.** "After" reuses `ReadinessService.compute` / current `WeakArea` scores; "before" loads the enrollment's `QuizResponse`s, drops the source activity's responses, maps each to its domain via `ContentChunk.primaryDomain` (mirroring `WeakAreasService.recompute`), and feeds the pure `computeDomainScore` / `computeReadiness` / `isCalibrated`. *Alternative: persist a readiness/weak-area snapshot at session/mock start (extend `StudySession`/`MockExam`) — rejected: more invasive (touches archived entities and their start paths) and the pure recompute is exact and read-only.*
- **Study-session response filtering, precisely.** "this session's responses" = enrollment responses with `createdAt` in `[startedAt, endedAt]`; "before" = enrollment responses with `createdAt < startedAt`. For mocks, "this attempt's responses" = the `QuizResponse`s emitted at `finalizeAttempt` (created at-or-after the attempt's finalize time) **and** the attempt's own `MockExam.score` contribution to the readiness mock-blend (excluded by attempt id); "before" excludes both.
- **A `SessionSummaryModule` in `apps/api` owns the four endpoints; no parallel session/mock plumbing.** The module injects `SessionsService`, `WeakAreasService`, `ReadinessService`, and the `EntityManager`, and exposes summary readers + drill actions. Drill delegates to `SessionsService.createReviewSession`, which already enforces the one-active-session invariant and item generation. *Alternative: add the summary endpoints onto `SessionsController`/`MockExamController` — rejected: the summary is its own capability composing five modules; a dedicated module keeps the feature boundary clean (one module per domain concept).*
- **Drill targets = missed or flagged-unsure concepts, deduped, capped.** For sessions, a response qualifies if `correct === false` OR `confidence <= UNSURE_THRESHOLD`; for mocks, a question qualifies if `selectedAnswer` is wrong or null. Each qualifying item yields a `ReviewTarget { domain, anchorChunkId: provenance.sourceChunkIds[0] }`; targets are deduped by anchor chunk and capped at `SUMMARY_DRILL_MAX_QUESTIONS`. The same `qualifies` notion mirrors the archived `review-accrual` rule (`!correct || confidence <= 2`), keeping the drill consistent with what enters the review queue. *Alternative: a bespoke drill generator — rejected: `createReviewSession` already builds a targeted, capped, one-active-guarded session from `ReviewTarget[]`.*
- **Strongest/weakest selection is a documented heuristic.** Weakest = first incorrect answer (tie-break: lowest confidence, then earliest); strongest = correct answer with highest confidence (tie-break: fastest `timeTakenMs`). Each is returned with the question text and the `QuizResponse` id so the client can offer "ask the agent about this." *Alternative: surface multiple — rejected: SPEC asks for exactly the strongest and the weakest.*
- **Next-session focus = the lowest-scoring `WeakArea` domain after the session.** Reuses the existing ranked weak-area list (lowest `score` first), so the suggestion stays consistent with the dashboard's weak-area ranking. When no weak areas exist yet, `nextFocus` is null.
- **Readiness change honors "not yet calibrated."** If the enrollment is below the calibration threshold after the activity, `readiness.after` and `readiness.delta` are null rather than a fabricated number (SPEC → Exam Readiness Score), reusing `isCalibrated`. Percentages are surfaced on the 0–100 scale used by the readiness API.
- **Config-driven, not hardcoded.** `SUMMARY_DRILL_MAX_QUESTIONS` (default mirrors the review session cap) and `SUMMARY_UNSURE_CONFIDENCE_THRESHOLD` (default 2, matching the accrual rule) are Zod-validated `@nestjs/config` values.

## Risks / Trade-offs

- [Window-based scoping could miscount if a mock attempt's `finalizeAttempt` emits its `QuizResponse`s while a study session for the same enrollment is `active`, landing those rows inside the session window.] → Low likelihood (mocks are full-screen/timed; a concurrent active study session for the same enrollment is unusual) and bounded; the drill/summary remains correct for the common path. Documented so a future `study_session_id` FK can replace the heuristic if telemetry shows overlap.
- [Recomputing "before" by replaying responses through the pure functions duplicates a slice of `WeakAreasService.recompute`'s domain-attribution logic (chunk → primaryDomain).] → Keep the attribution in one shared helper used by both the summary "before" path and the existing recompute, or factor the response-set → domain-inputs mapping into a pure function, to avoid drift.
- [Reading all enrollment `QuizResponse`s twice (before vs after) is more work than reading a snapshot.] → Per-enrollment response counts are bounded and the read is indexed by `user_certification_id`; the summary is requested once per session end. Acceptable.
- [Strongest/weakest heuristic is a judgment call.] → It is pure and unit-tested with explicit tie-breaks; SPEC leaves the exact ranking to implementation.

## Open Questions

- None blocking. The exact `SUMMARY_DRILL_MAX_QUESTIONS` default and the strongest/weakest tie-break order are tunable; the defaults (review-cap-aligned drill size, confidence-threshold 2 matching the accrual rule) are reasonable starting points and live in config.
