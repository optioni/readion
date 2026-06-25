## Why

Ingestion upserts `ContentChunk`s by content hash, so a source edit produces a *new* chunk rather than mutating the old one. Without reconciliation, chunks that disappear from a source would either accumulate forever or be hard-deleted out from under the `SessionItem`/`MockExam` snapshots, cached questions, and `ReviewItem` anchors that point at them. This change gives re-ingestion and source removal a single, predictable lifecycle: disappeared chunks are *superseded* (soft-deleted with lineage), excluded from retrieval and generation, evicted from cache, and eventually hard-deleted once nothing retained still references them.

## What Changes

- **Extend `ContentChunk`** (owned by `content-pipeline`) with `state` (`active` | `superseded`, default `active`) and `supersededById` (nullable self-FK lineage) columns, via a new migration in `packages/db`.
- **Reconciliation on re-ingestion**: after a source is re-fetched, diff the new chunk set against the source's existing chunks by content hash — *unchanged* kept as-is, *new* inserted `active`, *disappeared* marked `superseded`. Where a clear successor exists (same source, overlapping span/section) `supersededById` records the lineage. Runs inside the worker's existing per-source ingestion completion, after upsert.
- **Source removal & takedown path**: a reusable operation that, given a `ContentSource` being disabled/deleted (including an honored takedown request), immediately supersedes all of its chunks and evicts their dependent cache entries — a single removal route consumed later by `content-admin`.
- **Cache eviction on supersede**: when a chunk is superseded, evict every cached generated item keyed on that chunk id, reusing the quarantine eviction path so no stale generated content is served.
- **Exclude superseded chunks from retrieval/generation**: the `semantic-search` retrieval service filters to `state = 'active'`; superseded chunks remain readable for history but never seed new generation.
- **Superseded-chunk cleanup cron** (worker, `@nestjs/schedule`): hard-deletes superseded chunks older than a configurable retention window that no longer back any retained dependent. (At this phase no dependent tables exist yet; the cron deletes purely on the retention window and is extended by `sessions`/`mock-exam` to add their snapshot-reference guard — see Impact.)
- Add **superseded-chunk retention window** to the worker's Zod content-pipeline config.

## Capabilities

### New Capabilities
- `chunk-lifecycle`: Chunk state model (`active`/`superseded` + `supersededById` lineage), re-ingestion reconciliation diff, the source-removal/takedown supersede-all operation, cache eviction on supersede, and the superseded-chunk retention cleanup cron.

### Modified Capabilities
- `semantic-search`: retrieval SHALL exclude `superseded` chunks (restrict to `state = 'active'`), so superseded material never seeds new generation while staying readable for history.
- `content-ingestion`: the per-source re-ingestion now runs reconciliation after upsert (disappeared chunks superseded with lineage) rather than only upserting unchanged/new chunks.
- `llm-cache`: in addition to evict-by-key, the cache SHALL maintain a chunk-id reverse index at write time and expose evict-by-chunk-id, so superseding a chunk can evict every entry derived from it.

## Impact

- **DB (`packages/db`):** `ContentChunk` gains `state` + `supersededById` columns; one new migration (`alter content_chunks`). No new entity introduced (extends, does not own).
- **Worker (`apps/worker`):** reconciliation step wired into the ingestion processor; takedown supersede-all operation; new superseded-chunk cleanup cron; retention-window config.
- **Retrieval/cache:** `semantic-search` query filter; `llm-cache` reverse-index populated on write (`apps/api`); a shared Redis `evictByChunkId` operation callable from both `apps/api` (quarantine) and `apps/worker` (supersede).
- **Shared (`packages/shared`):** chunk `state` enum/type; retention-window config field; the reverse-index key naming convention (`chunk:{id}` set + cache-key namespace) so api and worker agree.
- **Dependencies consumed:** `content-pipeline` (ContentChunk/ContentSource, ingestion pipeline, semantic-search), `llm-foundation` (llm-cache eviction), `grounding-verification` (quarantine eviction path reused).
- **Forward references (out of scope here, consume this later):** `ReviewItem` re-anchoring to `supersededById`/fresh retrieval lives in `review-srs`; the admin "disable source" HTTP endpoint that calls the takedown operation lives in `content-admin`; the cleanup cron's "still backs a retained `SessionItem`/`MockExam`" guard is layered in by `sessions`/`mock-exam` when those snapshot columns exist.
