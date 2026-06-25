## Context

The worker (`apps/worker`) already has BullMQ, `@nestjs/schedule`, a Redis connection, a scrapper HTTP client base, and base processor conventions (from `worker-foundation`). `certifications` provides each cert's domain list. `llm-foundation` provides the Vercel AI SDK gateway (utility-tier model for tagging) and the embeddings interface. This change is the first to create `ContentSource`/`ContentChunk` and the pgvector-backed knowledge base every downstream study feature reads from.

Migration boundary matters here: this change creates the base `content_chunks` table but deliberately omits the `state`/`supersededById` lifecycle columns, which `chunk-lifecycle` owns. Dedup is by content hash; superseding/reconciliation is explicitly downstream. This change is the worker write-side (`content-ingestion`) plus a shared read-side service (`semantic-search`); no HTTP endpoints are added (admin source CRUD lives in `content-admin`).

This is a non-UI, worker-side change — no Visual Design section applies.

## Goals / Non-Goals

**Goals:**
- `ContentSource` + `ContentChunk` entities and migrations in `packages/db` (pgvector 1536-dim embedding, HNSW index, `(contentSourceId, contentHash)` unique key).
- Per-source-type fetch strategies, scrapper integration, source etiquette/compliance.
- Processing pipeline: clean → ~500-token overlapping chunks → utility-model multi-domain tagging → batched embeddings → content-hash upsert.
- BullMQ per-source-type queues with backoff retries, job events, and priority enqueue support.
- Hourly stale-source re-ingestion cron.
- A `semantic-search` retrieval service (cosine ≥ 0.75, domain-filtered) for downstream consumers.
- Prometheus chunk-ingestion-count-per-source-type metric.

**Non-Goals:**
- Chunk reconciliation/superseding, `state`/`supersededById` columns, superseded-cleanup cron, takedown path (`chunk-lifecycle`).
- Admin source register/manage API, manual re-ingest endpoint, job-status endpoint (`content-admin`).
- Coverage-bar evaluation and draft→live flip (`cert-go-live`); cert "due for re-verification" cron (`cert-setup-grounding`).
- The `semanticSearch`/`fetchMoreMaterial` agent tools and the slow-path enqueue trigger (`agent`) — this change only provides the queue + retrieval service they build on.

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres + pgvector | real (Testcontainers) | real (Testcontainers) for entity/retrieval; n/a for pure logic |
| Redis / BullMQ | real (Testcontainers) | n/a |
| Scrapper sidecar (HTTP) | HTTP mock (nock) | HTTP mock |
| External sources (YouTube/Reddit/GitHub/RSS) | HTTP mock (nock) / fixture transcripts | HTTP mock / fixtures |
| Vercel AI SDK — domain tagging (utility model) | mocked at the gateway module boundary (deterministic tag output) | mocked at module boundary |
| Vercel AI SDK — embeddings | mocked at the gateway module boundary (deterministic 1536-dim vectors) | mocked at module boundary |
| `@nestjs/schedule` cron clock | trigger handler directly + control `lastFetchedAt`/now | n/a |

Chunking, content-hash derivation, domain-tag→`primaryDomain` selection, and confidence-threshold filtering are pure logic → unit tests with no I/O. The worker has no HTTP server, so the outside-in entry point is the BullMQ processor (enqueue a job → assert persisted chunks) rather than a Playwright e2e.

## Decisions

- **Embeddings mocked at the SDK boundary, pgvector real.** LLM/embedding calls are non-deterministic and costly; mock them at the `llm-foundation` gateway so vectors are deterministic. Keep Postgres/pgvector real so HNSW indexing, the unique constraint, and cosine ranking are genuinely exercised. Alternative (full real LLM) rejected: flaky, slow, expensive in CI.
- **Content hash as upsert key.** Hash normalized chunk text; unique on `(contentSourceId, contentHash)`. Re-ingesting unchanged content is idempotent. Alternative (delete-all-then-insert per source) rejected: would churn ids that downstream `SessionItem`/`ReviewItem` snapshot, and conflicts with the superseding model `chunk-lifecycle` will add.
- **One BullMQ queue per source type.** Matches SPEC and lets rate-limited source types (Reddit, web) have independent concurrency/backoff from cheap ones. Priority field on the queue supports the future high-priority `fetchMoreMaterial` enqueue without restructuring.
- **Multi-domain tags stored as JSONB `{domain, confidence}[]` with derived `primaryDomain` column.** `primaryDomain` is a real persisted column (not computed at read time) for cheap sorting/display and weak-area attribution; retrieval still matches against any tag. Alternative (single domain per chunk) rejected by SPEC — cert material straddles domains.
- **Defer lifecycle columns to `chunk-lifecycle`.** Keeps migrations non-overlapping per the entity-ownership table; retrieval in this change simply queries all chunks for the cert (no `state` filter yet), and `chunk-lifecycle` adds the `state != superseded` predicate when it adds the column.
- **Scrapper via mocked HTTP in tests.** Keeps Playwright/browser entirely out of the worker and tests; the sidecar contract is an HTTP boundary we can stub deterministically.

## Risks / Trade-offs

- [HNSW index build cost / recall tuning] → Use pgvector defaults initially; treat index params as tunable later. Correctness tests assert ordering on small fixtures, not large-scale recall.
- [External source format drift (YouTube/Reddit/GitHub APIs)] → Isolate each fetch strategy behind a small interface with fixture-backed tests; failures retry with backoff and surface via job events rather than crashing the worker.
- [Domain-tagging accuracy depends on LLM] → Confidence threshold filters noise; `primaryDomain` is best-effort and downstream features tolerate multi-domain matches. Quarantine/report paths (downstream) catch misattribution.
- [Embedding dimension drift] → Boot-time check compares configured model dimension against the live column and fails fast (per `llm-foundation`/SPEC); changing the model requires a migration, not config.
- [Re-ingestion without superseding leaves disappeared chunks active] → Accepted for this change; `chunk-lifecycle` adds reconciliation. Until then, dedup-by-hash prevents duplicates but does not retire vanished chunks.

## Open Questions

- Exact per-source-type default recheck intervals are taken from SPEC → Content Staleness; confirm whether GitHub "bi-weekly" and Anki/Quizlet "monthly" need env overrides at launch or just sensible constants. (Default: constants now, env overrides for thresholds/sizes already in scope.)
- Whether podcast/Anki/Quizlet strategies ship fully in this change or as stubs behind the interface, given seed certs use docs/YouTube/Reddit/GitHub first. (Leaning: implement the four primary strategies fully, stub the rest behind the same interface with tests asserting the contract.)
