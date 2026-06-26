## Why

After a study session or mock exam ends, the user is dropped back at the dashboard with no sense of what just happened — did they improve, what should they study next, and what did they get wrong? SPEC → End-of-Session Summary closes this reflection gap with a summary screen shown after **every** study session or mock exam: per-session accuracy, per-domain accuracy, weak-area score deltas, readiness change, the strongest/weakest question, a next-session focus suggestion, and a one-tap "Drill my misses" action. All the inputs already exist as archived modules (`sessions`, `mock-exam`, `weak-areas`, `readiness`, `review-srs`); what is missing is the read-side computation that composes them into a summary and the drill action that turns this attempt's misses into an immediate targeted session.

## What Changes

- **Session summary read model** — `GET /api/v1/sessions/:id/summary` returns the post-session summary for a study or review session: questions answered + accuracy, per-domain accuracy, per-domain `WeakArea` score deltas, the exam-readiness change (before → after), the strongest and weakest question of the session, and a suggested focus domain for the next session.
- **Mock-exam summary read model** — `GET /api/v1/mock-exams/:id/summary` returns the same summary shape for a submitted/expired mock or diagnostic, derived from the self-contained `MockExam` entity (its `questions` array, `score`, and `domainBreakdown`) plus the enrollment's readiness/weak-area deltas.
- **Drill my misses** — `POST /api/v1/sessions/:id/drill` and `POST /api/v1/mock-exams/:id/drill` immediately start a short targeted study session generated from the concepts the user **missed or flagged-unsure** in that attempt (the *don't-wait-for-the-interval* counterpart to the review queue). Reuses the archived `SessionsService.createReviewSession(userId, enrollmentId, ReviewTarget[])` path; returns the new session (or an "all caught up" / "no misses" state when there is nothing to drill).
- **Pure summary calculators** — accuracy/per-domain rollups, before→after delta computation (recomputing the existing pure `computeDomainScore` / `computeReadiness` / calibration functions over the pre-activity response set), strongest/weakest selection, and next-session suggestion are all pure, deterministic, unit-tested logic.
- **Scoping without a schema change** — study-session quiz responses are scoped by the session's `[startedAt, endedAt]` window (safe under the archived one-active-study-session-per-enrollment invariant), since `QuizResponse` carries no session FK; mock summaries scope directly from the `MockExam` entity. **No new entity, no migration, no change to the quiz answer-submit path.**

## Capabilities

### New Capabilities
- `session-summary`: the post-session/post-mock summary computation (questions + accuracy, per-domain accuracy, `WeakArea` score deltas, readiness before→after change, strongest/weakest question, next-session focus suggestion) exposed via `GET /sessions/:id/summary` and `GET /mock-exams/:id/summary`, plus the "Drill my misses" action (`POST /sessions/:id/drill`, `POST /mock-exams/:id/drill`) that starts an immediate targeted session from this attempt's missed/flagged-unsure concepts.

### Modified Capabilities
<!-- None. The change is purely additive: a new read/summary surface plus a drill action that reuses the archived study-session, mock-exam, weak-areas, readiness, and review-srs services. No archived capability's requirements change. -->

## Impact

- **Entities owned (new table + migration):** none, per the entity-ownership table ("End-of-Session Summary" introduces no entity). No schema change at all: study-session responses are scoped by the session time window, mock summaries by the `MockExam` entity. The quiz answer-submit path is **not** modified.
- **API:** new read endpoints `GET /api/v1/sessions/:id/summary` and `GET /api/v1/mock-exams/:id/summary`, and new actions `POST /api/v1/sessions/:id/drill` and `POST /api/v1/mock-exams/:id/drill`, all under the standard `{ data }` envelope and repository-layer ownership scoping (cross-user → 404). Orval client regenerated and committed.
- **New module:** `SessionSummaryModule` in `apps/api` composing `SessionsService` (incl. `createReviewSession`), `WeakAreasService` (+ pure `computeDomainScore`), `ReadinessService` (+ pure `computeReadiness` / calibration), the `MockExam` / `QuizResponse` / `ContentChunk` entities. Read-only — it performs no writes beyond the drill, which delegates to `SessionsService`.
- **Config:** `SUMMARY_DRILL_MAX_QUESTIONS` (cap on drill size, reusing the review session cap semantics) and `SUMMARY_UNSURE_CONFIDENCE_THRESHOLD` (default 2, matching the review-accrual "flagged-unsure" rule) — Zod-validated `@nestjs/config`.
- **Worker crons:** none — the cross-cutting cron table assigns no cron to this change.
- **Metrics:** none — SPEC → Observability → Metrics lists no summary-specific metric.
- **Depends on:** `sessions` (`StudySession`/`SessionItem`, `SessionsService.createReviewSession`, session `[startedAt, endedAt]`/status), `mock-exam` (`MockExam` entity with `questions`/`score`/`domainBreakdown`/`type`), `weak-areas` (`WeakAreasService` + `computeDomainScore`), `readiness` (`ReadinessService` + `computeReadiness`/calibration), `review-srs` (misses already auto-seed the queue via `QUIZ_ANSWERED_EVENT`; drill is the immediate option). All archived.
- **Consumed downstream by:** `web-session-view` (renders the summary screen and the "ask the agent about this question" / "Drill my misses" affordances).
- **Boundaries kept out of scope:** all frontend (`web-session-view`); the readiness/weak-area formula internals (`readiness` / `weak-areas`); the quiz answer-submit flow (`quiz`); mock-exam taking/scoring (`mock-exam`); the review-queue accrual itself (`review-srs`); agent wiring for "ask about this question" (`agent` / `web-session-view`).
