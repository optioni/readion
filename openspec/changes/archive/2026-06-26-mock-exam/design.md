## Context

Quiz generation (`QuizModule`, grounded + verified question generation, scoring, explanations, `QuizResponse`, provenance), the independent verifier pass (`grounding-verification`), and per-domain aggregation (`WeakAreasModule`) are all implemented and archived. What is missing is the exam-faithful rehearsal: a timed attempt with the real question count, the real time limit, no agent, and a pass/fail verdict. `mock-exam` adds `MockExamModule` in `apps/api`, owning the `MockExam` entity and the wall-clock lifecycle, plus a worker generation job and an auto-submit cron in `apps/worker`.

This is a backend-only change. No user-facing views are owned here — the full-screen timed exam UI belongs to `web-mock-exam`. So there is no Visual Design section.

Key constraints: questions are generated under the existing grounding + verifier guarantee (delegate to the quiz pipeline; do not re-implement generation), the `deadline` clock must start only when the full verified set is ready (generation latency never eats exam time), the timer is wall-clock and server-computed (resume keeps counting), unanswered questions score as incorrect, mock results feed weak areas through the existing aggregation entry point (no parallel scoring path into weak areas), and every mock resource is ownership-scoped on `userId` at the repository layer.

## Goals / Non-Goals

**Goals:**
- Own `MockExam` (table + migration) with `type` (`mock`|`diagnostic`), `status` (`in_progress`|`submitted`|`expired`), wall-clock `startedAt`/`deadline`, score + pass/fail, domain breakdown, and a persisted question array with per-question provenance and answers.
- Create a `mock`-type attempt that reads its format from the `Certification` and enqueues generation.
- Generate + independently verify the full set via the quiz pipeline, persist questions incrementally, and stamp `startedAt`/`deadline` only on completion.
- Wall-clock timer with resume (answers preserved, clock keeps counting).
- Answer upsert while `in_progress`; reject on terminal/past-deadline.
- Submit + auto-submit (worker cron) scoring: overall score, pass/fail vs. cert passing score, per-domain breakdown, unanswered = incorrect; update `WeakArea`.
- Review mode reading correct answers, explanations, and citations from stored provenance.
- Establish the `type: diagnostic` enum value and shared scoring/breakdown/review infra for the downstream `diagnostic` change.

**Non-Goals:**
- The diagnostic create flow — breadth planner, lenient/optional timer, onboarding offer, low-weight seeding of weak-areas/readiness (`diagnostic` change).
- Readiness mock-weighting (`readiness` change folds mock scores in as a higher-weighted input).
- Quiz generation / verification internals (delegated to `QuizModule` / `grounding-verification`).
- Frontend views (`web-mock-exam`).
- Any new Prometheus metric — verifier pass/fail and regeneration/substitution metrics already emit from the shared quiz pipeline.

## Test Boundaries

| Dependency | In acceptance test (API-level Supertest) | In integration tests (Supertest + Testcontainers) | In unit tests |
|---|---|---|---|
| Postgres (`MockExam`, `Certification`, `QuizResponse`, `WeakArea`) | real (test DB) | real (Testcontainers) | not used (pure logic only) |
| Redis (BullMQ generation queue) | real | real (Testcontainers) | not used |
| LLM provider (Vercel AI SDK) for generation | mocked at the AI SDK / `ProviderAdapter` boundary (deterministic stub) | mocked at the AI SDK boundary | n/a |
| `QuizModule` generation + verifier pass | real module (uses mocked AI SDK) | real module | mocked collaborator |
| `WeakAreasModule` aggregation | real module | real module | not used |
| Worker generation job + auto-submit cron | invoked deterministically (job/cron handler called directly, real DB) | invoked directly | scoring logic is pure (no cron) |
| Mock scoring (overall, pass/fail, domain breakdown) | exercised via submit endpoint | exercised via API | pure (real, no mocks) |

Like the other backend-only changes (quiz, sessions, review-srs), the outer acceptance test is a full-app API-level `*.acceptance.spec.ts` (Supertest through the booted Nest app on Testcontainers), not a Playwright e2e — the mock-exam UI belongs to `web-mock-exam`. The scoring computation is pure logic and is the natural unit-test target; everything else runs through real modules against a real DB with only the LLM provider mocked for determinism.

## Decisions

- **Generation runs as a BullMQ job, not synchronously in the create request.** The spec requires questions to appear in the navigation incrementally while the `deadline` clock starts only when the full set is ready — that is async by nature. Create enqueues a job and returns a `201` immediately with an empty, deadline-less attempt; the generation processor generates + verifies question by question, persists each onto the attempt, and on completion stamps `startedAt` + `deadline`. Alternative: synchronous generation in the request blocking until ready — rejected because it eats the request timeout for a full exam's worth of verified questions and gives the client no incremental fill.

  - **The generation BullMQ processor is hosted in `apps/api`, not `apps/worker` (revised during implementation).** The original plan placed the processor in `apps/worker`, but the verified question pipeline (`QuizModule` → `GroundingModule`'s `GroundedGenerationService`/`VerifierService`) lives under `apps/api/src` and is not importable across the app build boundary (the worker has `rootDir: ./src`, empty path aliases, and the repo shares code only through `packages/`). The mandatory verifier guarantee ("Each generated question is verified individually") therefore requires the processor to run where the pipeline lives. A BullMQ worker runs in-process in the API Nest app (as sessions already registers a queue in `apps/api`), so `MockExamModule` hosts the processor and consumes the `MOCK_EXAM_GENERATION_QUEUE`, calling the verified `MockExamGenerationService` directly. Only the auto-submit cron stays in `apps/worker` — it needs only the pure `MockExamScorer` + DB, no generation pipeline. Alternative: extract the grounding/quiz pipeline into a shared `packages/` module so the worker could run it — rejected as a large refactor touching already-archived `quiz`/`grounding` code with cross-feature regression risk, for no behavioural gain over in-API hosting.

- **The `deadline` clock is decoupled from generation by construction.** `startedAt`/`deadline` stay null until the worker has persisted the full verified set; only then are they stamped. `GET` reports a `generation` status (`preparing`|`ready`) plus the questions verified so far, so a client can render the "preparing exam" screen and the streaming nav without the timer running. Alternative: start the clock at create and subtract generation time — rejected as error-prone and not exam-faithful.

- **Delegate question generation + verification to the existing quiz pipeline; do not re-implement.** Mock questions carry the same grounding + verifier guarantee as quizzes, so the worker calls the quiz generation service per planned (domain, difficulty) slot and persists the returned verified question + provenance. The per-domain allocation follows the certification's domain weights to fill the cert's question count. Alternative: a mock-specific generator — rejected; it would duplicate the verifier contract and provenance handling.

- **The `MockExam` JSONB question array is the timed-attempt source of truth; finalize ALSO emits one `QuizResponse` per question.** During the attempt the question array (options, correct answer, explanation, provenance snapshot, the user's selected answers) is the live record — it must exist before/independent of answering for stream-in generation, resume, faithful review after chunk supersession, and the chunk-lifecycle cleanup which keys on `SessionItem`/`MockExam` snapshots (SPEC → Provenance & citations, line 711/774). At submit/auto-submit, the shared finalize routine emits one `QuizResponse` per question into the enrollment (each embedding that question's own snapshot — `quiz-scoring` requires `QuizResponse` to be enrollment-scoped, snapshot-embedding, and explicitly NOT `SessionItem`-referencing), then calls `WeakAreasService.recompute`. Alternative: feed weak-areas from the attempt's domain breakdown directly — rejected because `weak-areas` owns aggregation and its `recompute` reads `QuizResponse`s attributed by the chunk's `primaryDomain`; bypassing it would duplicate aggregation rules and skip readiness, which also reads `QuizResponse`s. Alternative: store answers only as `QuizResponse`s with no attempt array — rejected because the timed attempt needs its set persisted before answering and the review/chunk-lifecycle snapshot lives on `MockExam`.

- **Mock-emitted `QuizResponse`s carry a neutral confidence of `3`.** A timed exam captures no per-question self-rating (real exams have none), but `quiz-scoring`/`weak-areas` model confidence as a required 1–5 value that sharpens the score (confident-wrong depresses, confident-correct raises). `3` is the midpoint — it contributes accuracy signal without spuriously sharpening either way. Configurable. Alternative: omit confidence — rejected; `WeakArea.meanConfidence` is non-nullable and recompute assumes a 1–5 value.

- **Wall-clock timer is fully server-side.** `deadline = startedAt + timeLimit` is computed and stored at generation-completion; `remainingSeconds` is derived from `deadline - now` on every read; answer writes are rejected once `now > deadline`. Resume is therefore free — there is no client-held timer to trust. Alternative: client-reported elapsed time — rejected as not exam-faithful and trivially gameable.

- **Scoring is pure, injected logic.** A `MockExamScorer` takes `(questions, answers, domainWeights, passingScore)` and returns `{ score, passed, domainBreakdown }` with unanswered = incorrect, no I/O. Both the submit endpoint and the auto-submit cron call it, guaranteeing identical scoring on manual and timed-out submission. Alternative: scoring inside the service with DB access interleaved — rejected; it can't be unit-tested in isolation and risks divergence between the two submit paths.

- **Auto-submit is a `@nestjs/schedule` cron, hosted in `apps/api` (revised during implementation).** It selects `in_progress` attempts whose `deadline + grace` is past `now`, scores them via the same `MockExamScorer`, marks them `expired`, and updates weak areas. The grace window is a Zod-validated `@nestjs/config` value (SPEC → Lifecycle windows). Alternative: a per-attempt delayed BullMQ job fired at the deadline — rejected as more moving parts than a periodic sweep for a low-frequency lifecycle event; the cron also self-heals after downtime.

  - **Hosted in `apps/api`, not `apps/worker` (revised during implementation, same reason as the generation processor).** The cron must reuse the EXACT shared finalize routine (`MockExamService.finalizeAttempt`: score → persist → emit `QuizResponse`s → `WeakAreasService.recompute` → set terminal status) so manual submit and timed expiry are identical and there is NO parallel scoring path into weak areas (a hard requirement of this design and of `weak-areas`). That routine, `WeakAreasService.recompute`, and `QuizResponse` emission all live in `apps/api/src` and are not importable across the app boundary. Replicating `recompute`/emission in the worker would create exactly the parallel aggregation path the design forbids; an HTTP callback from worker → api adds cross-process coupling + a service secret for a low-frequency sweep. So the cron runs in-process in `apps/api` and calls `finalizeAttempt(em, attempt, 'expired')` directly. `@nestjs/schedule` is already initialized in both apps. After this revision, `apps/worker` owns NO mock-exam code.

- **Mock completion feeds weak areas through `WeakAreasService.recompute`, in both submit paths.** No parallel scoring path into weak areas; finalize emits the per-question `QuizResponse`s (above) then calls the same `recompute(userCertificationId)` entry point sessions/reviews use. Alternative: write `WeakArea` directly from `MockExamModule` — rejected; it would duplicate aggregation rules the `weak-areas` change owns and bypass readiness.

- **`type: diagnostic` enum is created now; the diagnostic flow is not.** Owning the entity means owning all its enum values, and the shared scoring/breakdown/review infra is built to be reused. But the only create path exposed here is the `mock`-type create under an enrollment — the breadth planner, lenient timer, onboarding, and seeding are wired by `diagnostic`. This mirrors how `review-srs` exposed the accrual entry point but deferred diagnostic-miss seeding.

## Risks / Trade-offs

- [Full-set generation adds latency before the exam can start] → mitigated by reusing `QuizModule`'s verified-question cache where the `{ chunkIds, difficulty, format }` key matches, and by persisting questions incrementally so the nav fills while the rest generate; the deadline only starts when the set is complete, so latency is visible but never charged against exam time.
- [A verifier rejection mid-generation could stall the set below the required count] → the worker substitutes a replacement (reusing the quiz pipeline's regenerate/substitute path) until the verified count equals the cert question count; if a domain cannot be filled, the job records the shortfall rather than stamping an incomplete set (see Open Questions).
- [Auto-submit cron and a late manual submit could race on the same attempt] → both transition through a guarded `in_progress → terminal` state check; the second writer sees a non-`in_progress` status and no-ops (manual submit returns `409`, cron skips).
- [Resume after the deadline but before the cron sweep] → reads compute `remainingSeconds <= 0` and answer writes are rejected at `now > deadline` independently of the cron, so the attempt is effectively closed for input even before the cron marks it `expired`.

## Open Questions

- Exact auto-submit grace window default (SPEC says "a short grace") — default to 2 minutes, config-driven, confirm during implementation.
- Behavior when a domain has insufficient verified content to fill its allocated question slots — lean toward generating to the achievable count and recording the shortfall on the attempt rather than failing the whole mock; confirm against `cert-go-live` coverage guarantees (a `live` cert should have enough content) during implementation.
- Whether `GET /api/v1/mock-exams/:id` during review should hide other questions' correct answers until submission is already guaranteed by the terminal-status gate — confirm the in-progress GET never leaks correct answers.
