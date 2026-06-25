# Chunk Lifecycle

## Purpose

Manages the active/superseded lifecycle of `ContentChunk` records. Covers the database columns that track chunk state, reconciliation of disappeared chunks on re-ingestion, supersession lineage, cache eviction on supersession, the source-removal supersede-all operation, retention window configuration, and the cleanup cron that hard-deletes expired superseded chunks.

## Requirements

### Requirement: ContentChunk lifecycle columns and migration

The system SHALL extend the existing `ContentChunk` entity (owned by `content-pipeline`) with lifecycle columns: `state` (enum `active` | `superseded`, NOT NULL, default `active`), `supersededById` (nullable self-referential FK to the `ContentChunk` that replaced it), and `supersededAt` (nullable timestamp). A migration SHALL `ALTER` the `content_chunks` table to add these columns, backfilling existing rows to `state = 'active'`, and SHALL index `state` so active-only filtering stays cheap. No new entity is introduced.

#### Scenario: Existing chunks default to active after migration

- **WHEN** the lifecycle migration runs against a `content_chunks` table populated by `content-pipeline`
- **THEN** every existing row has `state = 'active'`, `supersededById = null`, and `supersededAt = null`
- **THEN** a newly inserted chunk also defaults to `state = 'active'`

#### Scenario: supersededById is a self-referential lineage link

- **WHEN** chunk `B` supersedes chunk `A`
- **THEN** `A.supersededById` references `B.id`
- **THEN** following the FK from `A` resolves to the row for `B`

### Requirement: Reconciliation on re-ingestion

After a `ContentSource` is re-fetched, the worker SHALL reconcile the newly produced chunk set against the source's existing chunks by `contentHash`: a hash still present is **unchanged** and kept as-is; a previously unseen hash is **new** and inserted with `state = 'active'`; a hash previously present for the source but absent from the latest fetch is **disappeared** and SHALL be marked `state = 'superseded'` with `supersededAt` set to the reconciliation time. Reconciliation SHALL run inside the worker's existing per-source ingestion completion, after the content-hash upsert. Superseded chunks SHALL NOT be physically removed by reconciliation.

#### Scenario: Disappeared chunk is superseded, not deleted

- **WHEN** a source previously produced chunks with hashes `{h1, h2, h3}` and a re-fetch produces only `{h1, h2}`
- **THEN** the chunk for `h3` has `state = 'superseded'` with a non-null `supersededAt`
- **THEN** the row for `h3` still exists in `content_chunks`

#### Scenario: Unchanged and new chunks coexist after reconciliation

- **WHEN** a re-fetch of a source yields hashes `{h1, h4}` where `h1` already existed and `h4` is new
- **THEN** the chunk for `h1` remains `state = 'active'` with no duplicate row inserted
- **THEN** a new `state = 'active'` chunk exists for `h4`

### Requirement: Supersession lineage where a successor exists

When a disappeared chunk has a clear successor in the same re-ingestion — a single new `active` chunk from the same source whose span/section (per chunk `metadata`) overlaps the disappeared chunk — reconciliation SHALL set the disappeared chunk's `supersededById` to that successor. When no single clear successor exists, the chunk SHALL still be superseded but `supersededById` SHALL remain `null`.

#### Scenario: Overlapping successor records lineage

- **WHEN** a disappeared chunk covered section `intro` and exactly one new active chunk from the same source covers section `intro`
- **THEN** the disappeared chunk's `supersededById` references that new chunk
- **THEN** the disappeared chunk's `state` is `superseded`

#### Scenario: No clear successor leaves lineage null

- **WHEN** a disappeared chunk has no overlapping replacement in the latest fetch
- **THEN** the chunk's `state` is `superseded` and `supersededById` is `null`

### Requirement: Cache eviction when a chunk is superseded

Whenever a chunk transitions to `superseded` (via reconciliation or source removal), the system SHALL evict every cached generated item keyed on that chunk id by invoking the `llm-cache` evict-by-chunk-id operation, reusing the same eviction path as a quarantine, so no stale generated content is served from a superseded chunk.

#### Scenario: Superseding a chunk evicts its cached items

- **WHEN** a chunk that contributed to cached generated items is superseded
- **THEN** the cache entries derived from that chunk id are evicted via the `llm-cache` evict-by-chunk-id operation
- **THEN** a subsequent read for those keys returns a miss

### Requirement: Source removal and takedown supersede-all operation

The system SHALL provide a reusable operation that, given a `ContentSource` being disabled or deleted (including an honored takedown request), immediately marks all of that source's `active` chunks as `superseded` and evicts their dependent cache entries. This SHALL be the single predictable removal path; the admin HTTP endpoint that triggers it is wired by `content-admin`.

#### Scenario: Disabling a source supersedes all its chunks immediately

- **WHEN** the supersede-all operation runs for a source with active chunks `{c1, c2, c3}`
- **THEN** `c1`, `c2`, and `c3` all have `state = 'superseded'` with `supersededAt` set
- **THEN** the cache entries derived from each chunk id are evicted

#### Scenario: Takedown does not touch other sources' chunks

- **WHEN** the supersede-all operation runs for source `S1` while source `S2` also has active chunks
- **THEN** `S2`'s chunks remain `state = 'active'`

### Requirement: Superseded-chunk retention window configuration

The worker's Zod configuration SHALL include a superseded-chunk retention window (default 30 days) controlling how long a superseded chunk is retained before it becomes eligible for hard deletion. The value SHALL be validated at startup, failing fast on a malformed value.

#### Scenario: Retention window defaults when unset

- **WHEN** the superseded-chunk retention window env var is not provided
- **THEN** the worker boots with the 30-day default

#### Scenario: Malformed retention window rejected at boot

- **WHEN** the retention window env var is set to a non-numeric value
- **THEN** the worker fails fast at startup with a clear configuration error

### Requirement: Superseded-chunk cleanup cron

The worker SHALL run a `@nestjs/schedule` cron job that hard-deletes superseded chunks whose `supersededAt` is older than the configured retention window and that no longer back any retained dependent snapshot (`SessionItem` / `MockExam`). Active chunks SHALL never be deleted by this cron. (At this change no dependent-snapshot tables exist yet, so the retained-dependent guard is a no-op extended by `sessions` / `mock-exam` when those snapshot columns land.)

#### Scenario: Old superseded chunk is hard-deleted

- **WHEN** the cron runs and a chunk has `state = 'superseded'` with `supersededAt` older than the retention window
- **THEN** the chunk row is removed from `content_chunks`

#### Scenario: Recently superseded chunk is retained

- **WHEN** the cron runs and a superseded chunk's `supersededAt` is within the retention window
- **THEN** the chunk row is not deleted

#### Scenario: Active chunks are never deleted by the cron

- **WHEN** the cron runs and a chunk has `state = 'active'` regardless of age
- **THEN** the chunk row is not deleted
