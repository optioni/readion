## Context

`SessionsModule` is the orchestration layer that turns a `UserCertification` + config into a sequenced, resumable study session. The pieces it composes already exist and are archived: `QuizModule` (verified question generation with deterministic formats), `WeakAreasModule` (ranked per-domain scores), and `llm-foundation` (the Vercel AI SDK gateway + Redis cache + semantic retrieval over `content_chunks`). This change owns two new entities (`StudySession`, `SessionItem`) and a worker cron, and exposes the REST surface the frontend and agent attach to.

The session loop is latency-sensitive in one specific place: the user waits on a "preparing your session" screen only for the first 3 items; everything else must stream in behind them. That blocking/background split is the central design constraint.

## Goals / Non-Goals

**Goals:**
- Own `StudySession` + `SessionItem` tables and their migration, including the `kind` (`study`/`review`) column (only `study` exercised here).
- Deterministic session planner: item count from duration, target domains from focus area, quiz `format` fixed before generation so the quiz cache key is computable up front.
- First-3-blocking / rest-background pre-generation, delegating verified quiz generation to `QuizModule` and reading-block Markdown composition to the LLM gateway.
- Resume via `lastItemIndex` + per-item completion flags, with the one-active-session-per-enrollment invariant enforced atomically.
- Repository-layer ownership scoping on `userId`; cross-user access → 404.
- Worker abandonment cron + active-session Prometheus gauge.

**Non-Goals:**
- End-of-session summary computation — owned by `end-of-session-summary`; `end` only records duration/completion status.
- Spaced-repetition front-loading of `ReviewItem`s and the `review`-kind session flow — owned by `review-srs` (which owns `ReviewItem`).
- Quiz generation/verification internals — owned by `quiz`.
- In-session agent chat — owned by `agent`.
- Any web/UI view — owned by `web-session-view`.

## Test Boundaries

Following the repo convention: integration tests hit real Postgres + Redis via Testcontainers and never mock the DB; the LLM provider is always mocked (no real model calls in CI).

| Dependency | In acceptance test (e2e/integration) | In unit tests |
|---|---|---|
| Postgres (StudySession/SessionItem) | real (Testcontainers) | real (Testcontainers) for repo logic; n/a for pure planner logic |
| Redis (LLM cache, queues) | real (Testcontainers) | n/a |
| LLM provider (Vercel AI SDK) | mocked at the SDK boundary (deterministic reading-block Markdown + quiz output) | mocked at the SDK boundary |
| `QuizModule` question generation | real module wired with a mocked LLM provider | mocked collaborator (planner/sequencer units) |
| `WeakAreasModule` ranking | real module against seeded `WeakArea` rows | mocked collaborator (planner unit) |
| Semantic retrieval over `content_chunks` | real pgvector query against seeded chunks | mocked retrieval (planner/composer units) |
| Worker scheduler (`@nestjs/schedule`) | invoke the cron handler directly against the test DB | n/a |
| Auth (`JwtAuthGuard`) | real guard with a test-issued JWT | n/a |

Pure-logic units to isolate (no DB): duration→item-count derivation, sequence builder (reading↔quiz alternation), format selection, weak-area weighting of target domains.

## Decisions

- **Two entities, snapshot provenance on `SessionItem`.** `SessionItem` stores `type` (`reading`/`quiz`/`video`), content, `completed`, and a **snapshot** of `sourceChunkIds` + `supportingSpans`. Snapshotting (vs. join-to-live-chunk) keeps historical sessions faithful when a chunk is later superseded (SPEC Chunk Lifecycle). Alternative — resolve citations from live chunks at read time — rejected: breaks history and couples session reads to chunk lifecycle.
- **One-active-per-enrollment enforced atomically, not check-then-insert.** Create wraps "find active session for enrollment, else insert" so a concurrent double-start resumes rather than races into two rows. Use a transaction with a `userId`-scoped lookup plus a partial unique constraint (`UNIQUE (user_certification_id) WHERE status = 'active'`) as the backstop. Alternative — app-level check only — rejected: TOCTOU under double-clicks/refresh.
- **Blocking first-3, background remainder via BullMQ.** Create generates the plan, synchronously produces items 0–2, returns `active`, then enqueues a worker job to fill the rest. Alternative — generate everything inline — rejected: violates the "no preparing-screen beyond 3 items" requirement. Alternative — generate lazily on item access — rejected: reintroduces mid-session waits the SPEC forbids.
- **Format fixed by planner before generation.** The planner sets each quiz item's `format` deterministically from chunk characteristics + difficulty so `{ chunkIds, difficulty, format, certification }` is a complete cache key checkable before any LLM call (SPEC LLM Cost Optimisation). Alternative — let the generation call pick format — rejected: makes the cache key uncomputable up front.
- **Planner reads weak areas via the module API, not the table.** Auto focus calls `WeakAreasModule`'s ranked list rather than querying `weak_areas` directly, keeping the aggregation contract in one place.
- **"Go deeper" generated on demand, TL;DR persisted.** Reading blocks persist the TL;DR + provenance; the full expansion is generated on demand and not part of the stored snapshot, matching the SPEC's progressive-disclosure model and avoiding paying generation cost for expansions users never open.
- **Abandonment as a worker cron.** The 24h-active→abandoned sweep lives in `apps/worker` per the cross-cutting crons table, alongside the other cleanup crons, not in the API process.

## Risks / Trade-offs

- [Background generation lags the user, who reaches an item not yet generated] → first-3 blocking covers the immediate window; background job is high-priority and items are generated in sequence order; the client polls/streams item availability and shows a brief inline wait only in the worst case.
- [Partial unique constraint dialect/locking edge cases under concurrency] → covered by an integration test that fires two concurrent create requests for the same enrollment and asserts a single `active` row.
- [LLM produces non-Markdown or oversized reading block] → composition prompt constrains to Markdown + TL;DR; a verbatim-text cap limits how much source text any single item surfaces (SPEC quotation-not-reproduction).
- [Abandonment cron racing a user actively resuming a ~24h session] → cron only flips sessions strictly older than the threshold; resuming updates activity so the window is measured from `startedAt` per SPEC (active >24h).

## Open Questions

- Exact reading↔quiz ratio per content-mix preset (quiz-heavy / reading-heavy / balanced / video-based) — the SPEC gives the balanced baseline (~2 min/reading, ~1 min/quiz); other presets shift the ratio. Resolve with concrete ratios in the planner unit tests; defaults are an implementation choice, not a contract change.
- Whether per-item completion flags live on `SessionItem` (chosen) vs. a packed array on `StudySession` — going with per-row flags for queryability; revisit only if it shows up as a hot path.
