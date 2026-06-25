## Reviewed Artifacts

- proposal.md
- specs/chunk-lifecycle/spec.md
- specs/semantic-search/spec.md (MODIFIED)
- specs/content-ingestion/spec.md (MODIFIED)
- specs/llm-cache/spec.md (MODIFIED)
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | design.md / tasks.md | `llm-cache` lives in `apps/api/src/llm/cache/`, but reconciliation and the takedown supersede-all run in `apps/worker`, which cannot import an `apps/api` NestJS provider — the worker had no reachable way to call `evictByChunkId`. | Added a "Cross-app eviction boundary" decision: the reverse-index key naming is a shared `packages/shared` convention and `evictByChunkId` is a thin Redis op (`SMEMBERS`→`DEL`) callable from both apps over the shared `ioredis`. Updated tasks group 3 to add the shared key-convention work and the worker-callable op; updated tasks 4.3 to call the shared op. | design.md → Decisions; tasks.md §3, §4.3; proposal.md → Impact |
| WARNING | specs/chunk-lifecycle/spec.md | Retention cleanup cron references a "still backs a retained `SessionItem`/`MockExam`" guard, but those snapshot tables don't exist at this phase (Phase 5; sessions/mock-exam are Phase 6). Risk of a scenario that can't be tested or a cron referencing nonexistent tables. | Scoped the cron requirement to delete on the retention window with an explicit guard *seam* (no-op now), and recorded the forward extension in proposal (Forward references), design (Non-Goals + Risks), and tasks 6.3 — so the guard isn't dropped when sessions/mock-exam land. Deferred, not blocking. | (already reflected) specs §Superseded-chunk cleanup cron; design.md §Non-Goals/§Risks; tasks.md §6.3 |
| SUGGESTION | specs/chunk-lifecycle/spec.md | Retention window needs a reliable "superseded longer than X" signal; `updatedAt` is mutated by unrelated writes. | Added a dedicated `supersededAt` column to the lifecycle migration and based the cron on it; documented as a Decision. | specs §ContentChunk lifecycle columns; design.md §Decisions |

## No Remaining Implementation-Blocking Gaps

All four proposal capabilities have matching spec files (`chunk-lifecycle` new; `semantic-search`, `content-ingestion`, `llm-cache` modified), each modified requirement copies the full existing block before editing, and every spec scenario maps to acceptance-test work (tasks §0) or a component group (§1–§6). The cross-app cache-eviction boundary — the one implementation-critical unknown — is now resolved in design.md and reflected in tasks.md. No blocking gaps remain.

## Deferred Non-Blocking Notes

- **Cleanup-cron retained-dependent guard** is intentionally a no-op seam at this change because `SessionItem`/`MockExam` snapshot columns don't exist until Phase 6. `sessions` and `mock-exam` extend the cron's exclusion query when they land; tasks §6.3 builds the seam and design.md §Non-Goals/§Risks records the hand-off.
- **`ReviewItem` re-anchoring** to `supersededById`/fresh retrieval is owned by `review-srs` (entity not yet created); this change only establishes the lineage it will consume. Recorded in proposal (Forward references) and design.md §Non-Goals.
- **Span/section overlap for lineage** depends on per-source-type `metadata`; source types without section metadata yield `supersededById = null`, which is acceptable (review-srs falls back to retrieval). Noted in design.md §Open Questions.
