## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up worker test harness: Testcontainers Postgres+pgvector and Redis, nock for the scrapper sidecar and external sources, and a mocked `llm-foundation` gateway (deterministic domain tags + deterministic 1536-dim embeddings) per design.md Test Boundaries
- [x] 0.2 Write failing acceptance test: enqueue an ingestion job for a `web` `ContentSource` → assert chunks are persisted to `content_chunks` with `contentSourceId`, `certificationId`, embedding, `domainTags`, `primaryDomain`, and that the source's `lastFetchedAt` is updated ("Full pipeline persists chunks for a source")
- [x] 0.3 Confirm it fails for the right reason (no entity/processor yet), not a harness/setup error

## 1. ContentSource & ContentChunk entities + migration (packages/db)

- [x] 1.1 RED: Write unit/integration test for `ContentSource` persistence (required fields, `enabled=true`, null `lastFetchedAt`) and `ContentChunk` persistence (1536-dim embedding, `domainTags` JSONB, derived `primaryDomain`)
- [x] 1.2 RED: Write test asserting the `(contentSourceId, contentHash)` unique constraint and the pgvector HNSW index exist after migration
- [x] 1.3 GREEN: Define both entities (no `state`/`supersededById` — owned by `chunk-lifecycle`) and create the migration (table DDL, HNSW index, unique key)
- [x] 1.4 REFACTOR: Extract shared source-type enum / chunk + domain-tag types into `packages/shared`

## 2. Worker config schema (packages/shared + apps/worker)

- [x] 2.1 RED: Write unit test for the Zod content-pipeline config (similarity threshold default 0.75, chunk size/overlap, per-source-type staleness interval defaults/overrides) including boot-time embedding-dimension mismatch failure
- [x] 2.2 GREEN: Add config schema and wire validation into worker startup
- [x] 2.3 REFACTOR: Centralize per-source-type default recheck-interval constants

## 3. Chunking (pure logic)

- [x] 3.1 RED: Write unit test for ~500-token splitting with overlap and `contentHash` derivation over normalized text
- [x] 3.2 GREEN: Implement the chunker
- [x] 3.3 REFACTOR: Clean up tokenization/overlap helpers

## 4. Domain tagging (utility model via gateway)

- [x] 4.1 RED: Write unit test: multi-domain chunk yields a `{domain,confidence}` entry per qualifying domain, `primaryDomain` = highest confidence, below-threshold domains excluded
- [x] 4.2 GREEN: Implement the tagger against the mocked LLM gateway boundary
- [x] 4.3 REFACTOR: Clean up threshold/primary-selection logic

## 5. Batched embeddings (via gateway)

- [x] 5.1 RED: Write unit test: N chunks embedded in batches (not N individual calls), each result a 1536-dim vector
- [x] 5.2 GREEN: Implement batched embedding generation against the mocked gateway
- [x] 5.3 REFACTOR: Clean up batching boundaries

## 6. Content-hash upsert & dedup (repository)

- [x] 6.1 RED: Write integration test (real DB): unchanged re-ingestion leaves chunk count unchanged; a new hash inserts a new row
- [x] 6.2 GREEN: Implement upsert-by-`(contentSourceId, contentHash)` repository method
- [x] 6.3 REFACTOR: Clean up upsert mapping

## 7. Fetch strategies + scrapper client

- [x] 7.1 RED: Write unit tests per strategy against mocked HTTP/fixtures: web→scrapper cleaned markdown (no browser dep), YouTube→transcript with per-segment `startOffsetSeconds` in metadata, PDF→`pdf-parse` fallback, Reddit/GitHub strategies; robots.txt-disallowed path skipped; per-domain rate limiting + User-Agent header
- [x] 7.2 GREEN: Implement the fetch-strategy interface, scrapper client integration, and the per-type strategies (primary types full; remaining types stubbed behind the same interface per design.md Open Questions)
- [x] 7.3 REFACTOR: Consolidate etiquette (robots/rate-limit/UA) into a shared fetch wrapper

## 8. Ingestion processor (orchestration)

- [x] 8.1 RED: Write integration test: processor runs fetch → clean → chunk → tag → embed → upsert end-to-end for a source and updates `lastFetchedAt`
- [x] 8.2 GREEN: Implement the ingestion processor wiring the components together
- [x] 8.3 REFACTOR: Clean up orchestration and error propagation

## 9. BullMQ per-source-type queues

- [x] 9.1 RED: Write integration test (real Redis): a separate queue per source type; transient failure retried with exponential backoff; job lifecycle events emitted; high-priority job processed ahead of queued normal-priority jobs
- [x] 9.2 GREEN: Register per-source-type queues/processors with backoff + event emission + priority support
- [x] 9.3 REFACTOR: Clean up queue registration

## 10. Stale-source re-ingestion cron

- [x] 10.1 RED: Write integration test: hourly handler enqueues for an enabled stale source; skips fresh sources; skips disabled sources
- [x] 10.2 GREEN: Implement the `@nestjs/schedule` cron that queries stale sources and enqueues re-ingestion jobs
- [x] 10.3 REFACTOR: Clean up staleness query

## 11. Ingestion-count metric

- [x] 11.1 RED: Write integration test: ingesting 12 chunks for a `youtube` source increments the chunk-ingestion counter for label `type="youtube"` by 12 on `/metrics`
- [x] 11.2 GREEN: Emit the Prometheus chunk-ingestion-count-per-source-type metric from the processor
- [x] 11.3 REFACTOR: Clean up metric labels/registration

## 12. Semantic-search retrieval service

- [x] 12.1 RED: Write integration test (real pgvector): nearest chunks returned ranked by cosine similarity with provenance; results scoped to the queried certification; below-threshold neighbours discarded; configurable threshold; domain filter matches any `domainTags` entry (not only `primaryDomain`) and excludes chunks outside target domains
- [x] 12.2 GREEN: Implement the retrieval service (HNSW similarity query + threshold + domain filter, returning chunk provenance)
- [x] 12.3 REFACTOR: Clean up query builder and result mapping

## 13. Acceptance Test — Outer Loop GREEN

- [x] 13.1 Confirm the ingestion acceptance test (group 0) and the semantic-search service tests (group 12) pass end-to-end
- [x] 13.2 Verify the worker boots in the local environment (smoke test) with the new config and no startup/config errors; confirm `packages/db` migration applies cleanly
- [x] 13.3 REFACTOR: Clean up test setup and mocks if needed

## 14. Change Review — Subagent Verification

- [x] 14.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 14.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 15. Polish

- [x] 15.1 Run linter and fix all errors (`yarn lint`)
- [x] 15.2 Run formatter and apply fixes (`yarn format`)
- [x] 15.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 15.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
