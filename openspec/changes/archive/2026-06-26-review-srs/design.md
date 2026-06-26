## Context

Quiz answering (`QuizModule` + `QuizResponse`), study sessions (`SessionsModule` + `StudySession`/`SessionItem`, including the `review` kind column and `SessionPlanner`), and weak-area aggregation (`WeakAreasModule`) are all implemented and archived. What is missing is the spaced-repetition layer that turns shaky answers into scheduled review. `review-srs` adds `ReviewModule` in `apps/api`, owning the `ReviewItem` entity and the Leitner scheduling logic, plus the standalone 5-minute review path and the front-loading hook the `sessions` change deferred.

This is a backend-only change. No user-facing views are owned here — the review queue, mark-as-mastered, and due-count UI belong to `web-progress` / `web-session-view`. So there is no Visual Design section.

Key constraints: review answers must flow through the existing `QuizResponse` scoring path (no parallel scoring), the one-active-session-per-enrollment invariant is owned by `SessionsModule` and must be reused (not reimplemented), Leitner intervals come from config, and `ReviewItem` re-anchoring must never silently drop an item when its anchor chunk is superseded.

## Goals / Non-Goals

**Goals:**
- Own `ReviewItem` (table + migration) and accrue concepts from wrong / low-confidence `QuizResponse`s.
- Implement the Leitner schedule (promote/reset/hold/master) as pure, unit-testable logic with config-driven intervals.
- Expose a due-queue read model (count + list) per enrollment.
- Start a quiz-only `review`-kind `StudySession` of due items via `SessionsModule`, with an "all caught up" empty state.
- Provide a due-items provider that `SessionPlanner` front-loads when `learningStyle` is spaced-repetition.
- Mark-as-mastered / suppress at concept and domain level.
- Re-anchor `ReviewItem`s on chunk supersession (lineage → semantic retrieval → hold).

**Non-Goals:**
- Diagnostic-miss seeding of the queue (`diagnostic` change wires its misses into the accrual entry point provided here).
- The "Drill my misses" action (`end-of-session-summary`).
- Quiz generation / verification and session lifecycle internals (delegated to `QuizModule` / `SessionsModule`).
- Any worker cron or new Prometheus metric — due scheduling is data-driven via `dueAt`; `ReviewItem` hard-purge is owned by the `users` cron.
- Frontend views (`web-progress`, `web-session-view`).

## Test Boundaries

| Dependency | In acceptance test (Playwright e2e) | In integration tests (Supertest + Testcontainers) | In unit tests |
|---|---|---|---|
| Postgres (`ReviewItem`, `QuizResponse`, `StudySession`) | real (test DB) | real (Testcontainers) | not used (pure logic only) |
| Redis (BullMQ / cache shared by deps) | real | real (Testcontainers) | not used |
| LLM provider (Vercel AI SDK) for fresh question generation | mocked at the AI SDK boundary (deterministic stub) | mocked at the AI SDK boundary | n/a |
| `QuizModule` question generation/scoring | real module (uses mocked AI SDK) | real module | mocked collaborator |
| `SessionsModule` session creation + one-active invariant | real module | real module | mocked collaborator |
| `WeakAreasModule` aggregation | real module | real module | not used |
| Semantic search (pgvector) for re-anchoring | real (test DB) | real | mocked collaborator |
| Leitner scheduler | exercised via API | exercised via API | pure (real, no mocks) |

The Leitner scheduler is pure logic with no I/O — it is the natural unit-test target. Everything else is exercised through real modules against a real DB (Testcontainers), with only the LLM provider mocked at the Vercel AI SDK boundary for determinism.

## Decisions

- **`ReviewItem` anchors to a `ContentChunk`, not to a `QuizResponse` or question.** A concept is coarser than a single question; anchoring to the chunk lets each due item regenerate a *fresh* question (varied format/difficulty) rather than repeat a stored one. Alternative considered: store the question on the item — rejected because it tests answer-position memory, not understanding, and breaks when the chunk is superseded.
- **Accrual is a `ReviewModule` listener on quiz answer submission, not logic inside `QuizModule`.** Keeps `QuizModule` unaware of SRS and keeps the accrual rule (incorrect OR correct-with-confidence-1–2) co-located with the schedule. Realized with `@nestjs/event-emitter`: `QuizService.submitAnswer` emits a `quiz.answered` domain event (via `emitAsync`, so the answer's `ReviewItem` is observable as soon as the HTTP call returns); `ReviewModule`'s `ReviewAccrualService` handles it with `@OnEvent('quiz.answered')`. Event-emitter is chosen over direct injection / `forwardRef` because the dependency edge is unidirectional (review → quiz) and pub/sub needs no import relationship in either direction, avoiding a circular module dependency. Alternative: an injected hook token in `QuizModule` — rejected because the consumer/provider split would still force `QuizModule` to import `ReviewModule` (circular).
- **Reuse `SessionsModule` to create the `review`-kind session.** The one-active-per-enrollment invariant and session persistence already live there; `ReviewModule` supplies the due-item plan (quiz-only, capped 5–7, no reading blocks) and asks `SessionsModule` to create it. Alternative: a separate review-session table — rejected; `StudySession.kind: review` exists for exactly this.
- **Each due item generates its question from its specific anchor chunk, not by domain search.** `QuizService.generateFromChunk` grounds generation in the resolved `anchorChunkId` (carried through `ItemPlan.anchorChunkId` / `SessionItemPlan.anchorChunkId` / `DueTarget.anchorChunkId`), so the generated question's `provenance.sourceChunkIds[0]` equals the reviewed item's anchor — which is what the `quiz.answered` accrual matches on, so answering a review question reschedules the *correct* `ReviewItem`. Both the synchronous standalone-review path (`SessionsService.generateItems`) and the worker fill-queue path (`SessionItemGeneratorService.generateQuizItem`) branch on `anchorChunkId`. Alternative: domain-scoped `QuizService.generate` (the first implementation) — rejected because deterministic domain search regenerates from the same top chunk and decouples the answered chunk from the reviewed item, breaking Leitner progression.
- **Front-loading via a due-items provider consumed by `SessionPlanner`.** Expressed as a MODIFIED requirement on `study-sessions`. `ReviewModule` exposes a provider returning due items for an enrollment; `SessionPlanner` calls it only when `learningStyle === spaced-repetition`. Alternative: `SessionsModule` queries `ReviewItem` directly — rejected; it would invert the dependency (sessions is a dependency of review, not vice-versa).
- **Leitner intervals from `@nestjs/config` (Zod-validated), default `1/3/7/16/35` days.** Lets tuning happen without a deploy-time code change and keeps the scheduler pure (intervals injected). Alternative: hardcode — rejected by spec ("configurable").
- **Re-anchoring resolved lazily at due-generation, not eagerly on supersession.** When a due item is about to generate a question and finds its anchor superseded, it resolves lineage → semantic retrieval → hold. Avoids a fan-out write whenever chunks are superseded and keeps the rule in one place. Alternative: eager re-anchor on supersession event from `chunk-lifecycle` — rejected as a larger cross-module coupling than needed for this change.

## Risks / Trade-offs

- [Fresh-question generation for due items adds LLM latency to the 5-minute review start] → reuse `QuizModule`'s verified-question cache where the `{ chunkIds, difficulty, format }` key matches; generate blocking only for the first items, consistent with session pre-generation.
- [Lazy re-anchoring could leave an item "held" indefinitely if no chunk ever clears the threshold] → held items remain visible and eligible to trigger `fetchMoreMaterial`; they are never deleted, so content backfill resurfaces them.
- [Domain-level suppress could mass-suppress more than intended] → scope strictly to the enrollment and resolve domain via the chunk's `primaryDomain`; return the affected count so the UI can confirm.
- [Accrual double-counting if the same concept is answered twice in one session] → accrual is idempotent per concept: an existing `active` item is rescheduled via Leitner, never duplicated.

## Post-implementation review triage

An independent reviewer audited the change. Resolutions:
- **CRITICAL — questions generated by domain search, not the anchor chunk** → **fixed**. Added `QuizService.generateFromChunk` and threaded `anchorChunkId` end-to-end (API sync path + worker fill-queue path). Added a close-the-loop acceptance test proving an answered review question promotes its item (box 1→2) and drops the due count to 0.
- **WARNING — acceptance test never closed the loop** → **fixed** by the close-the-loop test above (answers a generated review question, asserts due count drops).
- **WARNING — held items (re-anchor fallback) not eligible for `fetchMoreMaterial`** → **accepted/deferred**: held items are retained, not deleted, and excluded from the answerable set (tested); emitting the actual `fetchMoreMaterial` backfill signal belongs to the grounding/agent infrastructure not built in this change. Tracked for the change that owns that signal path.
- **SUGGESTION — `getQueue` lists superseded-anchored items without re-anchoring** → **accepted**: the queue is a read model; re-anchoring writes happen on `startReview`/`getDueTargets` (the answerable paths), not on a GET.
- **SUGGESTION — `@Global()` ReviewModule for the sessions↔review cycle; front-loaded items not flagged as a distinct kind** → **accepted**: the global token provider is the deliberate decouple recorded above; front-loaded items are review by position (first in the plan), new material after.
- **SUGGESTION — `ReviewQueueMeta` diverges from `CollectionMeta`; migration date** → **accepted**: intentional count read model; the migration timestamp follows the repo's forward-incrementing sequence (after `Migration20260701000000`).

## Open Questions

- Exact cap for the 5-minute review (5, 6, or 7 due items) — spec says ~5–7; default to 7 and make it config-driven, confirm during implementation.
- Whether domain-level suppress should also create suppressed `ReviewItem`s for not-yet-queued concepts in that domain, or only suppress existing items — leaning "only existing items + exclude the domain from new-material selection" to avoid synthesizing rows; confirm against `weak-areas`/planner integration during implementation.
