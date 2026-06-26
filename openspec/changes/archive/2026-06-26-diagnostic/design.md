## Context

The study loop, the timed-mock infrastructure (`MockExam` entity, scorer, `finalizeAttempt`, answer/submit/review endpoints, the generation processor and auto-submit cron — all in `apps/api` per the `mock-exam` revision), per-domain aggregation (`WeakAreasService.recompute`), readiness (`ReadinessService.compute` with a diagnostic calibration gate), and the event-driven `spaced-repetition` accrual (`@OnEvent(QUIZ_ANSWERED_EVENT)`) are all implemented and archived. `mock-exam` deliberately shipped the `type: diagnostic` enum value and shared scoring/breakdown/review infrastructure but deferred the diagnostic create flow to this change.

What is missing is the cold-start calibration: a short breadth exam offered at enrollment that seeds the enrollment's baseline so the first study session is adaptive and the dashboard shows a real readiness number from day one (SPEC → Diagnostic Exam). This is a backend-only change; the onboarding card, the diagnostic take/review UI (reusing the mock-exam components), and the re-prompt nudge belong to `web-onboarding`.

Three pieces of existing behavior need adjustment for the diagnostic variant, surfaced by reading the live code against SPEC:
- `readiness.service.ts` folds **all** submitted/expired `MockExam`s — including `type: diagnostic` — into the higher-weight mock blend (`MOCK_BLEND_WEIGHT = 2`). SPEC requires the diagnostic to enter readiness at **low** weight, so diagnostics must be excluded from that blend.
- `mock-exam.service.ts#deriveGeneration` reports `ready` only when `deadline !== null`. A lenient/optional-timer diagnostic keeps `deadline` null, so it would be stuck `preparing`; the derivation must key off set completion (`startedAt`) instead.
- `mock-exam.service.ts#finalizeAttempt` emits `QuizResponse`s but does **not** emit `QUIZ_ANSWERED_EVENT`, so reusing it as-is would not seed the review queue. SPEC requires diagnostic misses to seed review, so the diagnostic finalize must emit that event per question.

## Goals / Non-Goals

**Goals:**
- A diagnostic create flow (`POST /user-certifications/:id/diagnostic`) that creates a `type: diagnostic` `MockExam` for a **live** cert and enqueues breadth generation, reusing the `MockExam` entity (no new entity).
- A pure, deterministic **breadth planner**: small fixed budget (`DIAGNOSTIC_QUESTION_COUNT`, default 12), every domain probed ≥ 1, remaining slots by exam-share weight (largest-remainder).
- Lenient/optional timer: `startedAt` stamped on completion, `deadline` null; `generation: ready` derived from completion; abandonment = skip (never auto-submitted by the existing cron).
- Low-weight seeding on submit: reuse the scorer + `finalizeAttempt` to emit `QuizResponse`s and drive `WeakAreasService.recompute`; emit `QUIZ_ANSWERED_EVENT` per question to seed review; satisfy the readiness calibration gate; exclude diagnostics from the higher-weight readiness mock blend.
- Onboarding offer + one-time re-prompt read model (`GET .../diagnostic-offer`) and dismiss action, backed by a nullable `diagnosticRePromptedAt` column on `UserCertification`.
- Re-take re-seeding via the idempotent recompute.

**Non-Goals:**
- All frontend (the offer card, diagnostic take/review screens, the re-prompt nudge) — `web-onboarding` / reuses `web-mock-exam` components.
- The `mock` create/timer/scoring behavior — unchanged.
- Readiness formula internals beyond excluding diagnostics from the mock blend — `readiness`.
- Quiz generation/verification internals — `quiz` / `grounding-verification`.
- Any new worker cron — none assigned to `diagnostic`; the diagnostic is intentionally excluded from the mock auto-submit cron.

## Test Boundaries

| Dependency | In acceptance test (API-level Supertest) | In integration tests (Supertest + Testcontainers) | In unit tests |
|---|---|---|---|
| Postgres (`MockExam`, `Certification`, `UserCertification`, `QuizResponse`, `WeakArea`, `ReviewItem`) | real (test DB) | real (Testcontainers) | not used (pure logic only) |
| Redis (BullMQ diagnostic generation queue) | real | real (Testcontainers) | not used |
| LLM provider (Vercel AI SDK) for generation | mocked at the AI SDK / `ProviderAdapter` boundary (deterministic stub) | mocked at the AI SDK boundary | n/a |
| `QuizModule` generation + verifier pass | real module (uses mocked AI SDK) | real module | mocked collaborator |
| `WeakAreasModule` aggregation (`recompute`) | real module | real module | not used |
| `spaced-repetition` accrual (`QUIZ_ANSWERED_EVENT` listener) | real module + real event emitter | real module | not used |
| `ReadinessService.compute` (diagnostic-weight exclusion) | real module | real module | mock-blend exclusion is unit-tested in the calculator |
| Mock-exam generation processor + auto-submit cron | invoked deterministically (handler called directly, real DB) | invoked directly | n/a |
| Breadth planner | exercised via generation | exercised via generation | pure (real, no mocks) |
| Diagnostic offer/re-prompt derivation | exercised via the offer endpoint | exercised via API | pure derivation unit-tested |

Like the other backend-only changes (`quiz`, `sessions`, `mock-exam`, `readiness`), the outer acceptance test is a full-app API-level `*.acceptance.spec.ts` (Supertest through the booted Nest app on Testcontainers), not a Playwright e2e — the diagnostic UI belongs to `web-onboarding`. The breadth planner and the offer/re-prompt derivation are pure logic and the natural unit-test targets; everything else runs through real modules against a real DB with only the LLM provider mocked for determinism.

## Decisions

- **Reuse `MockExam` with `type: diagnostic`; no new entity.** The diagnostic is modeled as a `MockExam` row, per the entity-ownership table. *Alternative: a dedicated `Diagnostic` entity — rejected: it duplicates scoring/breakdown/review and contradicts the roadmap ("diagnostic variant adds no new entity").*
- **A `DiagnosticModule` in `apps/api` owns the create + offer surface; taking/answer/submit/review reuse the mock-exam endpoints.** The mock-exam `GET /mock-exams/:id`, `PUT /mock-exams/:id/answers/:questionIndex`, and `POST /mock-exams/:id/submit` operate by attempt id regardless of `type`, so the diagnostic needs no parallel taking/review endpoints. The new module adds only `POST /user-certifications/:id/diagnostic`, `GET /user-certifications/:id/diagnostic-offer`, and `POST /user-certifications/:id/diagnostic-offer/dismiss`. *Alternative: a full parallel diagnostic controller set — rejected: duplicates working endpoints and the SPEC explicitly says "reuses the mock-exam taking and review components … no dedicated new screens."*
- **Branch the shared generation by `type` rather than fork it.** `MockExamGenerationService` gains a planner branch (`planSlots` for `mock`, `planBreadthSlots` for `diagnostic`) and a target-count branch (cert question count vs. `DIAGNOSTIC_QUESTION_COUNT`); the processor's completion check and timer-stamping branch by type (mock stamps `deadline`, diagnostic leaves it null). The per-question generation, cache reuse, and explanation generation are identical. *Alternative: a separate `DiagnosticGenerationService` + queue — rejected: it duplicates the verified-pipeline plumbing the `mock-exam` design centralized; a type branch is smaller and keeps one generation path.*
- **Breadth planner = one-per-domain floor, then largest-remainder by weight.** Allocate one slot to every domain first (guaranteeing breadth), then distribute `budget - domainCount` remaining slots by exam-share weight via the same largest-remainder method the mock planner uses. If `budget < domainCount`, the floor cannot give every domain a slot; the planner clamps the effective budget up to `domainCount` so breadth is never sacrificed (the diagnostic stays small but probes all domains). Difficulty is a fixed calibration default rather than `exam-ready` (a diagnostic measures breadth, not exam-condition depth).
- **Lenient timer = null deadline; `generation` derives from completion.** On completion the processor stamps `startedAt` and leaves `deadline` null for diagnostics. `deriveGeneration` is changed to `startedAt !== null ? 'ready' : 'preparing'` (equivalent to today's behavior for mocks, since they stamp both together), and `deriveRemainingSeconds` stays null when `deadline` is null. This also means the mock auto-submit cron — which queries `deadline: { $lt: cutoff }` — never matches a diagnostic, giving "abandonment = skip" for free with no cron change. *Alternative: stamp a generous diagnostic deadline — rejected: the auto-submit cron would then finalize (and seed) an abandoned diagnostic, contradicting "abandoning … is treated as a skip."*
- **Diagnostic finalize emits `QUIZ_ANSWERED_EVENT` to seed review.** The diagnostic submit path reuses the scorer and the `QuizResponse` emission + `WeakAreasService.recompute` of `finalizeAttempt`, and additionally emits one `QUIZ_ANSWERED_EVENT` per question so the existing `spaced-repetition` accrual enqueues misses. Implemented by parameterizing `finalizeAttempt` to optionally emit the event (diagnostic passes `true`); the existing mock path keeps its current behavior (no event), so this is additive and does not change mock review behavior. *Alternative: a separate diagnostic finalize — rejected: duplicates scoring/emission logic the `mock-exam` design centralized.*
- **Pass/fail suppressed for diagnostics.** `finalizeAttempt` sets `passed = null` when `type === 'diagnostic'`; the response maps it through unchanged. Score and domain breakdown are still computed.
- **Readiness excludes diagnostics from the mock blend.** `readiness.service.ts` filters the high-weight `mockResults` to `type === 'mock'` (and keeps `submitted`/`expired`). The diagnostic still influences readiness through `WeakArea` (recency-decayed = low weight, fast decay) and still satisfies the calibration gate (`hasCompletedDiagnostic` is unchanged). *Alternative: a separate low diagnostic-weight term in the calculator — rejected: the SPEC's intent ("low weight, fast decay") is exactly the `WeakArea` recency path; adding a third term is unnecessary complexity.*
- **One-time re-prompt backed by a nullable `UserCertification.diagnosticRePromptedAt` column.** The offer state is derived (uncalibrated + no completed diagnostic + live cert; `onboarding` at zero completed sessions, `re-prompt` after `DIAGNOSTIC_REPROMPT_AFTER_SESSIONS`); the dismiss action stamps `diagnosticRePromptedAt` so the re-prompt is shown once. This is a column extension on an entity owned by `user-certifications`, via this change's own migration — permitted by the entity-ownership rule and not a new entity. *Alternative: derive "once" purely from session count windows (no column) — rejected: cannot honestly enforce "re-prompted once"; the column is one nullable timestamp.*
- **Config-driven counts.** `DIAGNOSTIC_QUESTION_COUNT` (default 12) and `DIAGNOSTIC_REPROMPT_AFTER_SESSIONS` (default 1) are Zod-validated `@nestjs/config` values, never hardcoded.

## Risks / Trade-offs

- [A diagnostic's finalize-emitted `QuizResponse`s also feed `WeakArea`, which readiness reads — so excluding the diagnostic `MockExam` from the mock blend does not double-exclude it; the diagnostic still contributes once, at low weight, via `WeakArea`.] → This is the intended single low-weight path; documented so the two readiness inputs are not conflated.
- [Parameterizing `finalizeAttempt` to emit `QUIZ_ANSWERED_EVENT` for diagnostics but not mocks is an asymmetry that could surprise.] → Keep the parameter explicit and covered by tests; do not silently change the mock path.
- [Insufficient content in a small/sparse domain could leave a diagnostic short of its budget.] → Reuse the mock generation's shortfall handling: the processor stamps completion on processed slots so the diagnostic is never stranded in `preparing`; a domain with no content simply yields fewer questions while breadth is still attempted.
- [Changing `deriveGeneration` to key off `startedAt` touches shared mock-exam mapping.] → It is behavior-equivalent for mocks (they stamp `startedAt` and `deadline` together) and is covered by the existing mock generation scenarios plus the new diagnostic scenario.

## Open Questions

- None blocking. The exact diagnostic difficulty default and the precise `DIAGNOSTIC_REPROMPT_AFTER_SESSIONS` value are tunable config; SPEC leaves "the first session or two" deliberately loose, so the default (1) is a reasonable starting point.
