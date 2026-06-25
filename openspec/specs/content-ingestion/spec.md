# Content Ingestion

## Purpose

Manages ingestion of learning material from external sources (web pages, PDFs, YouTube, Reddit, GitHub, Anki/Quizlet, podcasts) into the shared `ContentChunk` knowledge base. Handles fetching, cleaning, chunking, domain tagging, embedding generation, deduplication, and scheduling of re-ingestion jobs.

## Requirements

### Requirement: ContentSource entity and migration

The system SHALL define a `ContentSource` entity owned by `packages/db`, persisting a registered ingestion source per certification with: `id`, `certificationId` (FK), `type` (source-type enum), `url`, `enabled` (boolean, default `true`), `lastFetchedAt` (nullable timestamp), `recheckIntervalMinutes` (integer), and standard created/updated timestamps. A migration SHALL create the `content_sources` table.

#### Scenario: Source persisted with required fields

- **WHEN** a `ContentSource` is created with `certificationId`, `type: 'web'`, and `url: 'https://docs.aws.amazon.com/...'`
- **THEN** the row is persisted in `content_sources` with `enabled = true` and `lastFetchedAt = null`
- **THEN** querying it back returns the same `certificationId`, `type`, and `url`

#### Scenario: Default recheck interval derived from source type

- **WHEN** a `ContentSource` of type `web` is created without an explicit `recheckIntervalMinutes`
- **THEN** the persisted interval equals the weekly default (10080 minutes)
- **WHEN** a `ContentSource` of type `pdf` is created without an explicit interval
- **THEN** the persisted interval equals the monthly default

### Requirement: ContentChunk entity and migration

The system SHALL define a `ContentChunk` entity owned by `packages/db` with: `id`, `contentSourceId` (FK), `certificationId` (FK), `text`, `contentHash`, `embedding` (pgvector, 1536 dimensions), `domainTags` (JSONB array of `{ domain, confidence }`), `primaryDomain` (string, the highest-confidence tag), `metadata` (JSONB, e.g. YouTube transcript-segment `startOffsetSeconds`), and created/updated timestamps. A migration SHALL create the `content_chunks` table with a pgvector HNSW index on `embedding` and a unique constraint on `(contentSourceId, contentHash)`. The `state` and `supersededById` lifecycle columns are NOT introduced by this change.

#### Scenario: Chunk persisted with embedding and domain tags

- **WHEN** a `ContentChunk` is persisted with a 1536-dimension embedding and `domainTags: [{ domain: 'Security', confidence: 0.82 }, { domain: 'Architecture', confidence: 0.61 }]`
- **THEN** the row is stored in `content_chunks`
- **THEN** `primaryDomain` equals `'Security'` (the highest-confidence tag)

#### Scenario: Embedding dimension mismatch rejected at boot

- **WHEN** the configured embedding model's output dimension does not match the live `content_chunks.embedding` column dimension
- **THEN** the worker fails fast at startup with a clear configuration error and does not begin processing jobs

#### Scenario: Unique key prevents duplicate chunks on re-ingestion

- **WHEN** the same source is re-ingested and produces a chunk whose `contentHash` already exists for that `contentSourceId`
- **THEN** the existing row is upserted (kept) rather than a second row being inserted

### Requirement: Per-source-type fetch strategies

The worker SHALL fetch raw content using the strategy appropriate to a source's `type`: official docs/web pages and PDFs via the scrapper sidecar (PDFs falling back to `pdf-parse`); YouTube via the `youtube-transcript` package; Reddit via the public JSON API; GitHub community guides via the GitHub API for discovery plus raw Markdown fetch; Anki/Quizlet via their public API or scrapper; podcasts via RSS feed parsing plus transcript fetch.

#### Scenario: Web source fetched via scrapper

- **WHEN** a `web`-type source is processed
- **THEN** the worker calls the scrapper sidecar over HTTP and receives cleaned text/markdown
- **THEN** no browser/Playwright dependency is loaded inside the worker process

#### Scenario: YouTube transcript segments capture timestamps

- **WHEN** a `youtube`-type source is processed
- **THEN** each transcript segment's start offset is captured and stored in the chunk's `metadata` as `startOffsetSeconds`

#### Scenario: PDF falls back to pdf-parse

- **WHEN** a `pdf`-type source is processed and the scrapper cannot return PDF text
- **THEN** the worker extracts text via `pdf-parse` and continues the pipeline

### Requirement: Source etiquette and content compliance

Ingestion SHALL be non-invasive: the scrapper honors `robots.txt` and disallowed paths are skipped; outbound requests are rate-limited per source domain and identify with a descriptive User-Agent; no auth/paywall bypass is attempted. Every chunk SHALL store its source URL for attribution.

#### Scenario: Disallowed path skipped

- **WHEN** a target URL is disallowed by the source's `robots.txt`
- **THEN** the worker skips fetching that path and records no chunks for it

#### Scenario: Per-domain polite rate limiting

- **WHEN** multiple fetches target the same source domain in quick succession
- **THEN** outbound requests are throttled per domain and carry a descriptive User-Agent header

### Requirement: Processing pipeline

For each fetched source the worker SHALL clean/normalize the text, split it into ~500-token chunks with overlap, tag each chunk's domains, generate embeddings, and upsert the chunks.

#### Scenario: Text split into overlapping chunks

- **WHEN** a fetched document of ~2000 tokens is processed
- **THEN** it is split into roughly 500-token chunks with overlap between adjacent chunks
- **THEN** each chunk is assigned a `contentHash` derived from its normalized text

#### Scenario: Full pipeline persists chunks for a source

- **WHEN** a source is processed end-to-end
- **THEN** the resulting chunks are persisted to `content_chunks` with `contentSourceId`, `certificationId`, embedding, `domainTags`, and `primaryDomain`
- **THEN** the source's `lastFetchedAt` is updated to the completion time

### Requirement: LLM domain tagging

The worker SHALL classify each chunk against its certification's domain list using the utility-tier model via the Vercel AI SDK, storing every domain above a configured confidence threshold as a `{ domain, confidence }` entry, with the highest-confidence entry recorded as `primaryDomain`.

#### Scenario: Multi-domain chunk tagged for all qualifying domains

- **WHEN** a chunk's content matches two certification domains above the confidence threshold
- **THEN** `domainTags` contains an entry for each, each with its `confidence`
- **THEN** `primaryDomain` is the entry with the highest confidence

#### Scenario: Domains below threshold excluded

- **WHEN** a candidate domain's classification confidence is below the configured threshold
- **THEN** that domain does not appear in `domainTags`

### Requirement: Batched embedding generation

The worker SHALL generate embeddings for chunks via the Vercel AI SDK in batches during ingestion rather than one chunk at a time, using the configured embedding model.

#### Scenario: Chunks embedded in a batch

- **WHEN** a source produces 40 chunks
- **THEN** embeddings are requested in batches rather than 40 individual calls
- **THEN** each persisted chunk carries a 1536-dimension embedding

### Requirement: Content-hash upsert and dedup

The worker SHALL use each chunk's `contentHash` as the upsert key so re-ingesting unchanged content does not create duplicate chunks. On re-ingestion the upsert SHALL be followed by reconciliation (see the `chunk-lifecycle` capability): after the new chunk set is upserted, chunks previously present for the source but absent from the latest fetch are marked `superseded` rather than left as dangling `active` rows. Reconciliation runs as part of the source's ingestion-completion handling.

#### Scenario: Unchanged content not duplicated

- **WHEN** a source is ingested, then re-ingested with identical content
- **THEN** the chunk count for that source is unchanged after the second run
- **THEN** every chunk remains `state = 'active'`

#### Scenario: New content inserted on re-ingestion

- **WHEN** a source is re-ingested and produces a chunk with a previously unseen `contentHash`
- **THEN** a new `content_chunks` row is inserted for that chunk with `state = 'active'`

#### Scenario: Re-ingestion triggers reconciliation of disappeared chunks

- **WHEN** a source is re-ingested and a chunk previously present for the source is absent from the latest fetch
- **THEN** reconciliation marks that chunk `state = 'superseded'` after the upsert completes

### Requirement: BullMQ per-source-type queues

The worker SHALL define a separate BullMQ queue per source type, with automatic retries using exponential backoff and emitted job events for status visibility. The queues SHALL accept priority enqueues so downstream callers can enqueue high-priority ingestion jobs.

#### Scenario: Failed fetch retried with backoff

- **WHEN** a fetch for a rate-limited source fails transiently
- **THEN** the job is retried with exponentially increasing delay up to the configured attempt limit

#### Scenario: Job lifecycle events emitted

- **WHEN** an ingestion job transitions between waiting, active, completed, and failed states
- **THEN** corresponding BullMQ job events are emitted for downstream status consumers

#### Scenario: High-priority job preempts normal jobs

- **WHEN** an ingestion job is enqueued with high priority while normal-priority jobs are queued
- **THEN** the high-priority job is processed ahead of the queued normal-priority jobs

### Requirement: Stale-source re-ingestion cron

The worker SHALL run a `@nestjs/schedule` cron job hourly that finds every enabled `ContentSource` where `now > lastFetchedAt + recheckIntervalMinutes` and enqueues a re-ingestion job for each onto the queue for its source type.

#### Scenario: Stale source enqueued

- **WHEN** the hourly cron runs and an enabled source's `lastFetchedAt` is older than its recheck interval
- **THEN** a re-ingestion job for that source is enqueued onto its source-type queue

#### Scenario: Fresh source skipped

- **WHEN** the cron runs and a source was fetched within its recheck interval
- **THEN** no job is enqueued for that source

#### Scenario: Disabled source skipped

- **WHEN** the cron runs and a stale source has `enabled = false`
- **THEN** no re-ingestion job is enqueued for it

### Requirement: Ingestion-count metric

The worker SHALL emit a Prometheus metric counting content chunks ingested, labelled by source type, exposed on the worker's `/metrics` endpoint.

#### Scenario: Metric increments per ingested chunk

- **WHEN** a `youtube`-type source ingestion persists 12 chunks
- **THEN** the chunk-ingestion-count metric for label `type="youtube"` increases by 12
