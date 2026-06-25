## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the worker integration harness (Testcontainers Postgres + Redis) per design.md Test Boundaries: seed `content_chunks` with prepared `active` chunk sets and fixed embeddings; no scrapper/LLM/embedding calls exercised; expose a controllable `now` for `supersededAt` and cron timing
- [x] 0.2 Write failing acceptance test covering the end-to-end lifecycle: re-ingestion supersedes a disappeared chunk (lineage set when an overlapping successor exists), its cached items are evicted via `llm-cache` evict-by-chunk-id, the superseded chunk is excluded from `semantic-search` retrieval but readable by id, and the cleanup cron hard-deletes it once past the retention window
- [x] 0.3 Confirm it fails for the right reason (lifecycle columns/behavior absent), not a harness/setup error

## 1. ContentChunk lifecycle columns + migration (`packages/db`, `packages/shared`)

- [x] 1.1 RED: Write a migration/entity test asserting `content_chunks` gains `state` (enum, NOT NULL, default `active`), `supersededById` (nullable self-FK), `supersededAt` (nullable timestamp), a `state` index, and that existing rows backfill to `active`
- [x] 1.2 GREEN: Extend the `ContentChunk` entity with the three columns + self-referential relation; add the chunk `state` enum/type to `packages/shared`; create the `ALTER content_chunks` migration with default + backfill + index
- [x] 1.3 REFACTOR: Confirm the boot-time embedding-dimension check and unique key still hold; tidy entity definitions

## 2. semantic-search active-only retrieval (`apps/*` retrieval service)

- [x] 2.1 RED: Write a unit/integration test that a `superseded` chunk ranking above threshold is excluded from retrieval, while an equally-ranked `active` chunk is returned, and the superseded chunk is still readable by direct id lookup
- [x] 2.2 GREEN: Add the `state = 'active'` filter to the retrieval query
- [x] 2.3 REFACTOR: Ensure the filter composes cleanly with the existing similarity-threshold and domain filters

## 3. llm-cache chunk-id reverse index + evict-by-chunk-id (`packages/shared`, `apps/api`, `apps/worker`)

- [x] 3.1 RED: Write a unit test for the shared reverse-index key convention in `packages/shared` (`chunk:{id}` set name + cache-key namespace) so api and worker agree on naming
- [x] 3.2 GREEN: Add the shared key-convention helper to `packages/shared`
- [x] 3.3 RED: Write unit tests (real Redis): api-side cache write-through records the key under each constituent chunk id; the shared `evictByChunkId(c)` Redis op (`SMEMBERS` → `DEL` keys → `DEL chunk:{id}`) makes reads for every key derived from `c` miss and prunes `c`'s index entry; evicting an already-absent chunk id is a no-op
- [x] 3.4 GREEN: Populate the reverse index in `apps/api/src/llm/cache/llm-response-cache.service.ts` on write; implement the shared Redis `evictByChunkId` operation callable from both `apps/api` (quarantine path) and `apps/worker` (supersede path) over the shared `ioredis` connection
- [x] 3.5 REFACTOR: De-duplicate eviction so quarantine evict-by-key and supersede evict-by-chunk-id share the Redis del path

## 4. Reconciliation on re-ingestion (`apps/worker`)

- [x] 4.1 RED: Write unit tests for the reconciliation diff: unchanged hash kept `active`; unseen hash inserted `active`; disappeared hash marked `superseded` with `supersededAt`; single overlapping successor sets `supersededById`; ambiguous/zero successor leaves it `null`
- [x] 4.2 GREEN: Implement the reconciliation service (diff existing-vs-fetched hashes per source, supersede disappeared, resolve lineage by single span/section overlap) and wire it into the worker's per-source ingestion-completion handler after the content-hash upsert
- [x] 4.3 GREEN: On each supersede, invoke the shared `evictByChunkId` Redis operation (group 3) for the superseded chunk id over the worker's `ioredis` connection
- [x] 4.4 REFACTOR: Extract the supersede+evict step so reconciliation and takedown share one path

## 5. Source removal / takedown supersede-all operation (`apps/worker`)

- [x] 5.1 RED: Write unit tests: supersede-all for a source marks all its `active` chunks `superseded` with `supersededAt` and evicts each chunk's cache entries; other sources' chunks are untouched
- [x] 5.2 GREEN: Implement the reusable supersede-all-for-source operation (consumed later by `content-admin`'s disable/delete endpoint) using the shared supersede+evict path from group 4
- [x] 5.3 REFACTOR: Confirm reconciliation's takedown case and the explicit operation converge on one implementation

## 6. Retention config + superseded-chunk cleanup cron (`apps/worker`, `packages/shared`)

- [x] 6.1 RED: Write a config test that the superseded-chunk retention window defaults to 30 days and that a malformed value fails fast at boot
- [x] 6.2 GREEN: Add the retention-window field to the worker Zod config with default + validation
- [x] 6.3 RED: Write cron tests against real Postgres: a superseded chunk older than the window is hard-deleted; one within the window is retained; an `active` chunk of any age is never deleted; include the retained-dependent guard seam (no-op now, exclusion-set hook for `sessions`/`mock-exam`)
- [x] 6.4 GREEN: Implement the `@nestjs/schedule` cleanup cron that hard-deletes eligible superseded chunks via the guard seam
- [x] 6.5 REFACTOR: Tidy the cron query and the guard-seam extension point

## 7. Acceptance Test — Outer Loop GREEN

- [x] 7.1 Confirm the acceptance test passes end-to-end
- [x] 7.2 Verify the worker (and any retrieval/cache-touching app) boots in the local environment (smoke test) — no startup/config errors after the migration and new config
- [x] 7.3 REFACTOR: Clean up test setup, seeds, and mocks

## 8. Change Review — Subagent Verification

- [x] 8.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 8.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 9. Polish

- [x] 9.1 Run linter and fix all errors (`yarn lint`)
- [x] 9.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 9.3 Run type checker with zero errors (`yarn workspace apps/worker typecheck` + affected workspaces)
- [x] 9.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
