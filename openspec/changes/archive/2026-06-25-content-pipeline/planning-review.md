## Reviewed Artifacts

- proposal.md
- specs/content-ingestion/spec.md
- specs/semantic-search/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | The outer-loop acceptance test (group 0) exercises only `content-ingestion`; `semantic-search`'s acceptance-level coverage lives in group 12, but the GREEN confirmation referred generically to "the acceptance test", leaving the second capability's verification implicit. | Reworded 13.1 to explicitly confirm both the ingestion acceptance test (group 0) and the semantic-search service tests (group 12) pass end-to-end. | tasks.md → §13.1 |

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved:

- **Capability coverage** — both proposal capabilities (`content-ingestion`, `semantic-search`) have spec files; no capability appears only in design/tasks. Modified Capabilities is intentionally empty (no existing spec's requirements change).
- **Scenario coverage** — every spec scenario maps to a tasks.md RED step: ContentSource/ContentChunk entities + dimension-mismatch + unique key (§1, §2.1), fetch strategies + etiquette (§7), chunking (§3), domain tagging (§4), batched embeddings (§5), upsert/dedup (§6), BullMQ queues incl. priority (§9), stale-source cron (§10), ingestion metric (§11), and all four semantic-search scenarios (§12.1).
- **Design completeness** — migration shape (pgvector 1536 + HNSW + `(contentSourceId, contentHash)` unique), the deferred `state`/`supersededById` boundary, per-source-type queues, priority enqueue, async/cron behavior, and the boot-time embedding-dimension check are all decided in design.md.
- **Test boundaries** — design.md names every collaborator (Testcontainers Postgres/Redis real; scrapper + external sources via nock/fixtures; LLM gateway mocked at the module boundary); tasks.md invents no boundary not listed there. Worker has no HTTP server, so the outside-in entry point is the BullMQ processor rather than a Playwright e2e — stated in both design.md and tasks.md §0.
- **Task alignment** — outside-in order holds (acceptance RED → data model → config → pure logic → fetch → orchestration → queues → cron → metric → retrieval → GREEN → subagent review → polish), migration work is present, and Polish uses the project's `yarn` commands.
- **Contradictions** — scope boundaries (chunk-lifecycle, content-admin, cert-go-live, cert-setup-grounding, agent) are stated identically in proposal.md and design.md; source-type set and the 0.75 similarity threshold are consistent across specs/design/tasks.

## Deferred Non-Blocking Notes

- Podcast and Anki/Quizlet fetch strategies may ship as interface-conformant stubs (primary types — web/PDF/YouTube/Reddit/GitHub — implemented fully). This is an intentional deferral recorded in design.md → Open Questions and reflected in tasks.md §7.2; it does not block the acceptance test, which runs against a `web` source.
