## Why

A learner with a real exam date needs an exam-faithful rehearsal: the full question count, the real time limit, no tutor to lean on, and a pass/fail verdict scored against the official passing mark. The study loop (quiz, weak-areas, sessions, review) is in place, but nothing reproduces real exam conditions or folds a timed-attempt result back into the per-domain picture. `mock-exam` adds that timed exam: a wall-clock-deadline attempt whose verified question set is generated up front, that survives a closed browser, auto-submits on expiry, and produces a scored domain breakdown plus a review mode.

## What Changes

- New `MockExamModule` in `apps/api` owning the `MockExam` entity (table + migration) — a timed exam attempt per user and certification.
- **Create**: `POST /api/v1/user-certifications/:id/mock-exams` builds a mock matching the cert's real exam format (question count, time limit, passing score, domain weights). Generation is enqueued, not synchronous.
- **Stream-in generation**: the full question set is generated and **independently verified** under the same grounding + verifier guarantee as quizzes (delegating to the existing `quiz` generation pipeline). Questions are persisted as each is verified so they can appear in the navigation incrementally, but the `deadline` clock **only starts once the complete verified set is ready** — generation latency never eats exam time. Per-question provenance (`sourceChunkIds`, `supportingSpans`, verifier verdict/score) is snapshotted onto the `MockExam` so historical reviews stay faithful even if a chunk is later superseded.
- **Wall-clock timer & resume**: `deadline = startedAt + timeLimit`, computed server-side. The attempt is resumable within its deadline — answers are preserved and elapsed time keeps counting while the browser is closed (exam-faithful). No agent access during the exam.
- **Answering**: save/update an answer per question (upsert) while `in_progress`; rejected once submitted/expired.
- **Submit & scoring**: `POST /api/v1/mock-exams/:id/submit` scores the attempt — overall score, pass/fail vs. the cert passing score, and per-domain breakdown — with **unanswered questions scored as incorrect**. Stores the full attempt, emits one enrollment-scoped `QuizResponse` per question (each embedding its provenance snapshot; unanswered as incorrect; neutral confidence), and drives the per-domain `WeakArea` update through the existing `WeakAreasService.recompute` entry point (the same path sessions/reviews use, which `weak-areas` already anticipates for mocks).
- **Auto-submit on expiry (worker cron)**: a scheduled processor in `apps/worker` auto-submits and scores any attempt left `in_progress` past its `deadline` plus a short configurable grace, marking it `expired`.
- **Review mode**: after submission/expiry, the attempt is readable with every question, the user's answer, the correct answer, the grounded explanation, and citations derived from the stored provenance.
- **Diagnostic enum, not the diagnostic flow**: the `MockExam.type` column carries the `diagnostic` value and the scoring/domain-breakdown/review infrastructure is built to be shared, but the diagnostic-specific create path (breadth planner, lenient/optional timer, onboarding offer, low-weight seeding of weak-areas/readiness) is **out of scope** here — the downstream `diagnostic` change wires it onto this shared infrastructure.
- All mock resources enforce repository-layer ownership scoping on `userId`; cross-user access returns `404`.

## Capabilities

### New Capabilities
- `mock-exam`: the `MockExam` entity (table + migration), enqueued stream-in generation of a verified question set behind a deadline that starts only when the set is complete, wall-clock timer with resume, answer persistence, submit + auto-submit (worker cron) scoring with domain breakdown and pass/fail, the per-domain `WeakArea` update on completion, and review mode. Also establishes the `type: diagnostic` enum value and shared scoring/breakdown/review infrastructure for the downstream `diagnostic` change to build on.

### Modified Capabilities
<!-- None. Mock results feed weak areas through the existing WeakAreasModule aggregation entry point; no WeakAreasModule requirement changes. Readiness mock-weighting and the diagnostic create flow are owned by their own downstream changes. -->

## Impact

- **Entities owned (new table + migration):** `MockExam` (FK to `User` and `UserCertification`; `type` enum `mock`|`diagnostic`; `status` enum `in_progress`|`submitted`|`expired`; `startedAt`/`deadline` wall-clock fields; overall score + pass/fail; domain breakdown; the persisted question array with per-question provenance + answers + review data). No other entity is created or migrated here.
- **API:** new endpoints under `/api/v1` — create a mock for an enrollment, get a mock (generation status + available questions + remaining time, and review data once terminal), list attempts for an enrollment, upsert an answer, and submit. Orval client regenerated and committed.
- **Generation processor:** a BullMQ processor hosted in `apps/api` (where the verified quiz pipeline lives) — generate + verify the full set, persist incrementally, stamp `startedAt`/`deadline` on completion. (Revised from `apps/worker` during implementation: the verified pipeline is not importable across the app boundary; see design.md.)
- **Auto-submit cron:** a `@nestjs/schedule` cron hosted in `apps/api` (revised from `apps/worker` during implementation, same boundary reason as generation: it must reuse the shared `finalizeAttempt` routine and `WeakAreasService.recompute`, which live in `apps/api` — replicating them in the worker would create the parallel weak-areas path the design forbids). After this change `apps/worker` owns no mock-exam code.
- **Config:** auto-submit grace window (Zod-validated `@nestjs/config`).
- **Depends on:** `quiz` (grounded + verified question generation, scoring, explanations, provenance, and the enrollment-scoped `QuizResponse` entity emitted at finalize), `grounding-verification` (the independent verifier pass + quarantine), `weak-areas` (`WeakAreasService.recompute` entry point). All archived.
- **Consumed downstream by:** `diagnostic` (builds the diagnostic create flow on the shared infra + `type` enum), `readiness` (folds mock scores in as a higher-weighted input — owned there, not a hard prerequisite), `end-of-session-summary` (post-mock summary), `web-mock-exam` (the full-screen timed UI), `chunk-lifecycle` (superseded-chunk cleanup respects chunks still backing a retained `MockExam`).
- **Metrics:** mock generation reuses the verified quiz pipeline, so verifier pass/fail and regeneration/substitution metrics already emit from that shared path; no mock-specific Prometheus metric is named in the SPEC and none is invented here.
- **Boundaries kept out of scope:** the diagnostic create flow / breadth planner / onboarding / low-weight seeding (`diagnostic`), readiness mock-weighting (`readiness`), quiz generation/verification internals (`quiz` / `grounding-verification`), and all frontend (`web-mock-exam`).
