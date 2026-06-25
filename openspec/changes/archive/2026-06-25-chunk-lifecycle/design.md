## Context

`content-pipeline` upserts `ContentChunk`s by `contentHash` into `content_chunks`, with a unique key on `(contentSourceId, contentHash)`. A source edit therefore yields a *new* chunk (new hash) rather than mutating the old one. Many records point at chunk ids — `SessionItem`/`MockExam` snapshots (`sourceChunkIds`/`supportingSpans`), cached generated questions, and (later) `ReviewItem` anchors. Hard-deleting a stale chunk would break those references; never deleting would let `content_chunks` grow without bound. This change adds the lifecycle layer that reconciles chunks on re-ingestion and on source removal, and that retires superseded chunks safely.

`ContentChunk` is **owned** by `content-pipeline`; this change only **extends** it (adds `state`, `supersededById`, `supersededAt`) and modifies the `semantic-search` retrieval filter, the `content-ingestion` re-ingestion flow, and the `llm-cache` eviction surface. It introduces no new entity.

## Goals / Non-Goals

**Goals:**
- Add the `active`/`superseded` state model + `supersededById` lineage + `supersededAt` to `ContentChunk` via one migration.
- Reconcile chunks on re-ingestion (unchanged / new / disappeared→superseded, with lineage where a successor exists).
- Provide one reusable supersede-all-for-source operation for disable/delete/takedown.
- Evict cached generated content keyed on a chunk whenever that chunk is superseded, reusing the quarantine eviction path.
- Exclude superseded chunks from semantic retrieval while keeping them readable for history.
- Hard-delete superseded chunks past a configurable retention window via a worker cron.

**Non-Goals:**
- `ReviewItem` re-anchoring to `supersededById`/fresh retrieval — owned by `review-srs` (entity does not exist yet).
- The admin "disable/delete source" HTTP endpoint — owned by `content-admin`; this change exposes only the underlying supersede-all operation it calls.
- The cleanup cron's "still backs a retained `SessionItem`/`MockExam`" guard logic — those snapshot columns do not exist yet; `sessions`/`mock-exam` extend the cron's exclusion query when they land. This change implements the retention-window deletion and leaves a guard seam.
- Changing the upsert key or chunking — unchanged from `content-pipeline`.

This is a non-UI change. No Claude Design views are imported.

## Test Boundaries

Following the project's outside-in TDD rule, the acceptance test is a worker integration test against real Postgres + Redis via Testcontainers — reconciliation, superseding, and the cleanup cron are DB-observable side effects and must not be mocked. The scrapper/LLM/embedding calls that *produce* chunks are out of this change's surface; tests seed `content_chunks` directly and drive reconciliation with prepared chunk sets, so no network fetch is exercised.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (`content_chunks`) | real (Testcontainers) | real (Testcontainers) |
| Redis (`llm-cache` + reverse index) | real (Testcontainers) | real (Testcontainers) |
| Scrapper / fetch strategies | not exercised (tests seed chunk sets directly) | n/a |
| LLM domain tagging / embeddings | not exercised (chunks seeded with fixed embeddings) | n/a |
| `@nestjs/schedule` clock | cron handler invoked directly; `supersededAt` set relative to a controlled `now` | controlled `now` |
| `llm-cache` evict-by-chunk-id | real Redis | real Redis (reverse-index assertions) |

## Decisions

**Add `supersededAt`, not just `state`/`supersededById`.** The retention cron needs "superseded longer than the window." `updatedAt` is unreliable (mutated by unrelated writes), so a dedicated `supersededAt` set at supersede time is the clean signal. The roadmap's "`state`/`supersededById` lifecycle columns" is illustrative; `supersededAt` is the minimal addition that makes the cron correct. *Alternative considered:* derive age from `updatedAt` — rejected as fragile.

**Reconciliation runs after upsert in the existing ingestion-completion handler, not as a separate queue.** The disappeared set is `existing hashes for source − latest fetched hashes`, which is only knowable at the end of a source's ingestion. Doing it inline keeps the diff transactional with the upsert and avoids a second job round-trip. *Alternative:* a separate reconciliation queue — rejected as unnecessary coordination for a per-source, post-upsert step.

**Lineage by single overlapping successor only.** `supersededById` is set only when exactly one new active chunk from the same source overlaps the disappeared chunk's span/section (from `metadata`); ambiguous/zero matches leave it `null`. This keeps lineage trustworthy (used later by `review-srs` re-anchoring) rather than guessing. *Alternative:* nearest-embedding successor — rejected; embeddings of seeded chunks aren't a reliable "same passage" signal and would create misleading lineage.

**Cache eviction via an `llm-cache` chunk-id reverse index.** A cache key is derived from chunk id(s) + difficulty + format + cert and is opaque to a chunk-id lookup. To evict "everything derived from chunk `c`", the cache records a reverse index (`chunk:{id} → {keys}`, a Redis set) at write-through and exposes `evictByChunkId`. The write path (`apps/api/src/llm/cache/llm-response-cache.service.ts`) already derives keys from chunk ids, so it owns index population. `chunk-lifecycle` calls `evictByChunkId` on every supersede, mirroring how `grounding-verification` calls evict-by-key on quarantine. *Alternatives:* (a) scan all keys per supersede — O(n) and unacceptable; (b) a reverse index owned by `chunk-lifecycle` populated by intercepting writes — rejected because the write path lives in `llm-cache`/`grounding-verification`, so the index belongs with the writer.

**Cross-app eviction boundary: a shared Redis-level operation, not an `apps/api` service import.** `llm-cache` lives in `apps/api`, but reconciliation and the takedown operation run in `apps/worker`, which cannot import an `apps/api` NestJS provider. Resolution: the reverse-index key naming (`chunk:{id}` set + the cache-key namespace) is a **shared convention in `packages/shared`**, and `evictByChunkId` is a thin Redis operation — `SMEMBERS chunk:{id}` → `DEL` each member key → `DEL chunk:{id}` — that needs only the shared key convention and an `ioredis` connection (the worker already has one from `worker-foundation`). The api-side `llm-response-cache.service` and the worker both call this same operation against the shared Redis instance; neither re-derives keys for eviction. *Alternative:* worker emits a job that `apps/api` consumes to evict — rejected as needless coupling/latency for a pure Redis set/del.

**Supersede-all-for-source is a service operation, not an endpoint.** The HTTP "disable source" action is `content-admin`'s; both reconciliation's takedown case and that future endpoint call the same operation, giving SPEC's "single, predictable path."

## Risks / Trade-offs

- **Cleanup cron deletes chunks that a future `SessionItem`/`MockExam` would have referenced** → At this phase those tables don't exist, so nothing is at risk now; the requirement and cron are written with a guard seam (an exclusion-set hook) that `sessions`/`mock-exam` populate. Documented as a forward extension so it isn't dropped.
- **Reverse-index drift** (keys expire by TTL but linger in the index) → `evictByChunkId` treats already-absent keys as no-ops and prunes the chunk's index entry; stale index members are harmless misses and are bounded by cache TTL.
- **Lineage heuristic misses split/merge edits** (one old chunk → two new, or vice versa) → leaves `supersededById` null rather than recording a wrong successor; `review-srs` falls back to fresh retrieval, which is the SPEC-defined behavior anyway.
- **Backfill on a large `content_chunks` table** → the migration sets a column default and backfills `active`; default-with-not-null is a metadata-only operation on modern Postgres, so backfill cost is bounded.

## Open Questions

- Should `supersededAt`-based retention be measured in days (config `SUPERSEDED_CHUNK_RETENTION_DAYS`) or accept a duration string? Defaulting to an integer days field for parity with other worker intervals; revisit if ops wants finer control.
- Span/section overlap for lineage relies on whatever `metadata` the fetch strategies populate (e.g. YouTube `startOffsetSeconds`, doc section anchors). For source types lacking section metadata, lineage will simply be `null` — acceptable, but worth confirming no source type needs a richer overlap key.
