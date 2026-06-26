## Reviewed Artifacts

- proposal.md
- specs/study-sessions/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| SUGGESTION | tasks.md | Polish typecheck task named only `apps/api` plus an informal "+ worker", omitting `packages/db` which owns the new entities/migration | Rewrote 11.3 to typecheck `apps/api`, `apps/worker`, and `packages/db` | tasks.md §11.3 |

## No Remaining Implementation-Blocking Gaps

Capability coverage is complete: proposal.md names exactly one new capability (`study-sessions`) and `specs/study-sessions/spec.md` exists; no Modified/Removed/Renamed capabilities are claimed, matching the proposal. No capability appears only in design.md or tasks.md.

Scenario coverage is complete and each spec requirement maps to outside-in task work:
- Create/start + saved-defaults fallback + invalid-config 400 + cross-user 404 → tasks 0.2, 5, 6.
- One-active-per-enrollment (atomic resume, per-enrollment independence) → tasks 1.2 (partial unique constraint), 5.1.
- Planner (item count, auto/specific focus, format-before-generation) → task 2.
- First-3-blocking / background remainder / verified-only quiz items → task 4.
- Reading-block Markdown + TL;DR + provenance snapshot + video degradation + "Go deeper" → tasks 3, 6.1.
- Resume (`lastItemIndex` + completion flags) → tasks 0.2, 5.1.
- End (idempotent, partial vs. complete) → tasks 5, 6, 0.2.
- Session history list + filters + pagination → task 6.
- Abandonment cron + active-session gauge → task 7.

Design completeness is sufficient to start: module boundary (`SessionsModule` owns `StudySession`/`SessionItem`), migration shape including the `UNIQUE (user_certification_id) WHERE status = 'active'` backstop, API contract via the global envelope/interceptor, the blocking-vs-background async model, the snapshot-provenance decision, and the worker-cron placement are all resolved.

Test Boundaries in design.md name every collaborator the acceptance and unit tests use (real Postgres/Redis via Testcontainers, LLM mocked at the SDK boundary, real `QuizModule`/`WeakAreasModule` with mocked LLM, real pgvector retrieval, direct cron invocation, real `JwtAuthGuard`). No task invents a mock boundary that design.md does not name.

Scope boundaries are consistent across all four artifacts: end-of-session summary computation, `ReviewItem` front-loading / `review`-kind flow, and quiz generation internals are explicitly deferred to `end-of-session-summary`, `review-srs`, and `quiz` respectively in both proposal.md and design.md, and are absent from the spec and tasks. Dependencies (`quiz`, `weak-areas`, `llm-foundation`) are all archived.

## Deferred Non-Blocking Notes

- Per-content-mix reading↔quiz ratios (quiz-heavy / reading-heavy / balanced / video-based) beyond the SPEC's balanced baseline are an implementation choice fixed in the planner unit tests (task 2.1) and documented as such in design.md → Open Questions — not a contract change.
- The `review` kind column is created on `StudySession` here but only the `study` kind is exercised; the `review` flow lands with `review-srs` (recorded in proposal.md Impact and design.md Non-Goals).
