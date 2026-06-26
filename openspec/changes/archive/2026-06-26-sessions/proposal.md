## Why

The study session is the core unit of the product loop — a learner enrolls, configures a session, and works through pre-generated reading blocks and quiz cards. Quiz generation and weak-area aggregation already exist; what's missing is the orchestration that turns a `UserCertification` + session config into a sequenced, resumable, pre-generated session. Without it there is no place for the quiz pipeline to be consumed and no learning experience to attach the agent to.

## What Changes

- New `SessionsModule` in `apps/api` owning the `StudySession` and `SessionItem` entities (table + migration).
- **Create + start** a `study`-kind session from a `UserCertification` with config: duration (15/30/60/90), content mix (quiz-heavy / reading-heavy / balanced / video-based), difficulty (beginner / intermediate / exam-ready), focus area (auto-from-weak-areas / specific domains), learning style (spaced repetition / cram / weak-area focus). Unspecified fields fall back to the user's saved session defaults.
- **Session planner**: derives item count from duration (~2 min/reading block, ~1 min/quiz question), determines target domains (explicit, or weak-area-weighted via `WeakAreasModule`), and deterministically selects the quiz `format` per item before generation (stable cache-key input).
- **Item pre-generation**: first 3 items generated **blocking** before the session is returned as `active`; remaining items generated in the background so there are no mid-session waits. Pre-generation only yields verified quiz items (delegated to `QuizModule`).
- **Reading blocks**: composed from 1–3 retrieved chunks (cosine similarity ≥ 0.75, configurable), LLM-formatted into Markdown prose with a TL;DR plus an on-demand "Go deeper" expansion. Persist `sourceChunkIds`/`supportingSpans` snapshot for citation chips. Video-based mix degrades silently to a reading block when no video chunks clear the threshold.
- **Item sequencing**: alternate reading block → quiz questions → reading block …
- **Resume**: track `lastItemIndex` + per-item completion flags; returning resumes the last incomplete item. **At most one `active` session per `UserCertification`** (across `study` and `review` kinds) — starting a new one surfaces and resumes the in-progress one.
- **End** a session: record end time, duration, and completion status. (Summary computation is deferred to `end-of-session-summary`.)
- **Session history** list with filters, scoped to the enrollment/user.
- **Worker cron** (`apps/worker`): mark `StudySession` records `active` > 24h as `abandoned`.
- **Metric**: emit active-session count gauge (Prometheus), per SPEC Observability → Metrics.
- All session resources enforce repository-layer ownership scoping on `userId`; cross-user access returns 404.

## Capabilities

### New Capabilities
- `study-sessions`: lifecycle (create/start/end), session configuration + planner, item pre-generation and sequencing, reading-block composition, resume + one-active-per-enrollment invariant, session history, and the abandonment cron.

### Modified Capabilities
<!-- None — no existing capability's requirements change. -->

## Impact

- **Entities owned (new tables + migration):** `StudySession` (`kind`: `study` | `review` — the `review` kind column is created here but exercised later by `review-srs`), `SessionItem` (persists `type`, content, completion flag, and the `sourceChunkIds`/`supportingSpans` provenance snapshot).
- **API:** new endpoints under `/api/v1` — create/start, get, end (`POST /sessions/:id/end`), list/history, item completion + "Go deeper" expansion. Orval client regenerated and committed.
- **Depends on:** `quiz` (verified question generation, formats), `weak-areas` (ranked domains for auto focus), `llm-foundation` (reading-block Markdown composition, embeddings/semantic retrieval via the gateway). All archived.
- **Consumed downstream by:** `review-srs` (review-kind sessions), `end-of-session-summary` (summary on end), `agent` (in-session chat lifecycle), `web-session-view`, `web-dashboard`.
- **Boundaries kept out of scope:** end-of-session summary computation (`end-of-session-summary`), spaced-repetition front-loading of `ReviewItem`s (`review-srs` owns `ReviewItem`), quiz generation/verification internals (`quiz`).
