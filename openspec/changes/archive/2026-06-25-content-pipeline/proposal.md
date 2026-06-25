## Why

Every study feature — quizzes, sessions, the agent, mock exams — is grounded in a shared knowledge base of ingested certification material. Without a content pipeline there are no `ContentChunk`s to retrieve from, so nothing downstream can be generated or verified. This change stands up the worker-side ingestion pipeline (`ContentSource` → fetch → chunk → tag → embed → store) and the semantic retrieval surface that all grounded generation reads from.

## What Changes

- Introduce `ContentSource` and `ContentChunk` entities (owned here) with their initial migrations in `packages/db`. The chunk's `state`/`supersededById` lifecycle columns are intentionally **not** included — they are owned by the downstream `chunk-lifecycle` change.
- Implement per-source-type **fetch strategies** in `apps/worker`: official docs/web pages and PDFs via the scrapper sidecar (with `pdf-parse` fallback), YouTube via `youtube-transcript` (capturing per-segment start offsets as chunk metadata), Reddit public JSON, GitHub repo discovery + raw Markdown, Anki/Quizlet, and podcast RSS + transcripts.
- Implement the **processing pipeline**: clean/normalize text, split into ~500-token chunks with overlap, LLM **domain tagging** (utility model → multi-domain `{domain, confidence}[]` with derived `primaryDomain`), **batched embeddings** via the Vercel AI SDK, and **content-hash upsert/dedup** into `content_chunks`.
- Add **BullMQ per-source-type queues** with exponential-backoff retries and emitted job events for status visibility. Support priority enqueue so downstream changes (admin trigger, agent `fetchMoreMaterial` slow path) can enqueue onto these queues.
- Add the **scrapper HTTP integration** for fetching and cleaning web content, honoring `robots.txt`/ToS, polite per-domain rate limiting, and a descriptive User-Agent.
- Provide a **semantic search** retrieval service over `content_chunks` (pgvector cosine similarity ≥ 0.75 configurable threshold, domain-filtered) consumed by quiz/session/agent changes.
- **Cross-cutting cron (worker):** hourly **stale-source check** that enqueues re-ingestion jobs for any `ContentSource` past `last_fetched + interval`, with per-source-type default intervals.
- **Cross-cutting metric:** emit the Prometheus **content chunk ingestion count per source type** gauge/counter.
- Extend the worker's Zod config schema with content-pipeline settings: similarity threshold, chunk size/overlap, per-source-type staleness interval overrides.

## Capabilities

### New Capabilities
- `content-ingestion`: Worker-side ingestion of certification material — `ContentSource`/`ContentChunk` entities, per-source-type fetch strategies, scrapper integration, source etiquette/compliance, chunking, LLM domain tagging, batched embeddings, content-hash upsert/dedup, BullMQ per-source queues, the stale-source re-ingestion cron, and the ingestion-count metric.
- `semantic-search`: Embedding-similarity retrieval over `content_chunks` — query by vector with a configurable cosine-similarity floor (0.75) and domain filtering, returning chunks with their provenance for grounded generation downstream.

### Modified Capabilities
<!-- None — no existing capability's requirements change. -->

## Impact

- **Entities/DB (`packages/db`):** new `ContentSource` and `ContentChunk` entities + migrations (pgvector embedding column at 1536 dims, HNSW index, content-hash unique key). Lifecycle columns deferred to `chunk-lifecycle`.
- **Worker (`apps/worker`):** new ingestion module — fetch strategies, processing pipeline, BullMQ queues/processors, scrapper client, staleness cron, ingestion metric.
- **Shared (`packages/shared`):** content-pipeline config (Zod), source-type enum, chunk/domain-tag types.
- **Dependencies consumed:** `worker-foundation` (BullMQ, `@nestjs/schedule`, scrapper client base), `certifications` (domain lists for tagging), `llm-foundation` (domain-tagging model tier + embeddings via Vercel AI SDK).
- **Unblocks downstream:** `grounding-verification`, `quiz`, `sessions`, `agent`, `chunk-lifecycle`, `content-admin`, `cert-go-live`, `cert-setup-grounding`.
- **Out of scope (downstream changes):** chunk reconciliation/superseding + cleanup cron + takedown (`chunk-lifecycle`); admin source CRUD / manual re-ingest API / job-status endpoints (`content-admin`); coverage-bar + draft→live flip (`cert-go-live`); cert "due for re-verification" flag cron (`cert-setup-grounding`); the `semanticSearch`/`fetchMoreMaterial` agent tools (`agent`).
