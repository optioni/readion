## ADDED Requirements

### Requirement: Admin can register a content source for a certification

The system SHALL expose `POST /api/v1/admin/content-sources`, protected by the global `JwtAuthGuard` and restricted to the `admin` role, that creates a `ContentSource` for an existing certification from a JSON body of `certificationId`, `type` (one of the `contentSourceTypes` enum), `url`, and optional `recheckIntervalMinutes`. When `recheckIntervalMinutes` is omitted the system MUST persist the per-source-type default from `SOURCE_RECHECK_INTERVALS`. The new source MUST be created with `enabled = true` and `lastFetchedAt = null`. The response MUST be `201` with the single-resource envelope `{ data, relationships }` exposing `id`, `certificationId`, `type`, `url`, `enabled`, `lastFetchedAt`, `recheckIntervalMinutes`, and `createdAt`. The action MUST write exactly one `AuditLog` entry via `AuditLogService.record(...)` with action `source.added`, actor = the calling admin's user id, `targetType = 'ContentSource'`, `targetId` = the new source id, and an `after` snapshot of the created source. Non-admin callers MUST receive `403` and unauthenticated callers `401`, both as RFC 7807 Problem Details.

#### Scenario: Admin registers a web source with default interval

- **WHEN** an admin `POST`s `{ certificationId: <existing cert>, type: 'web', url: 'https://docs.aws.amazon.com/...' }`
- **THEN** the response is `201` with `{ data, relationships }` and `data.enabled = true`, `data.lastFetchedAt = null`
- **AND** `data.recheckIntervalMinutes` equals `10080` (the `web` default from `SOURCE_RECHECK_INTERVALS`)
- **AND** a new `content_sources` row exists for that certification
- **AND** exactly one `audit_logs` row exists with `action = 'source.added'`, the admin's `user_id`, `target_type = 'ContentSource'`, `target_id` = the new source id, and a non-null `after`

#### Scenario: Explicit recheck interval is honored

- **WHEN** an admin registers a source with `type: 'pdf'` and `recheckIntervalMinutes: 1440`
- **THEN** the persisted `recheckIntervalMinutes` is `1440` (not the `pdf` default)

#### Scenario: Registering against a non-existent certification is rejected

- **WHEN** an admin `POST`s a source whose `certificationId` does not exist
- **THEN** the response is `404` as RFC 7807 Problem Details
- **AND** no `content_sources` row and no `audit_logs` row are created

#### Scenario: Invalid source type is rejected

- **WHEN** an admin `POST`s a source with `type: 'rss'` (not in `contentSourceTypes`)
- **THEN** the response is `400` as RFC 7807 Problem Details and no source is created

#### Scenario: Non-admin cannot register a source

- **WHEN** a user with role `user` `POST`s to `/api/v1/admin/content-sources`
- **THEN** the response is `403` as RFC 7807 Problem Details and no source is created

#### Scenario: Unauthenticated cannot register a source

- **WHEN** an unauthenticated request hits `POST /api/v1/admin/content-sources`
- **THEN** the response is `401` as RFC 7807 Problem Details

### Requirement: Admin can list and read content sources

The system SHALL expose `GET /api/v1/admin/content-sources`, admin-only, returning the collection envelope `{ data[], meta }` of sources ordered by `createdAt` descending, filterable by a `certificationId` query parameter, paginated with a default page size of 25 capped at 100. The system SHALL also expose `GET /api/v1/admin/content-sources/:id`, admin-only, returning the single-resource envelope `{ data, relationships }`. A source id that does not exist MUST return `404` as RFC 7807 Problem Details. Each source item MUST expose `id`, `certificationId`, `type`, `url`, `enabled`, `lastFetchedAt`, `recheckIntervalMinutes`, and `createdAt`.

#### Scenario: List sources for a certification

- **WHEN** an admin requests `GET /api/v1/admin/content-sources?certificationId=<cert>` for a cert with two registered sources
- **THEN** the response is `200` with a `{ data[], meta }` envelope containing both sources, newest first
- **AND** only sources for that certification are returned

#### Scenario: List without filter returns all sources paginated

- **WHEN** an admin requests `GET /api/v1/admin/content-sources` with no filter
- **THEN** the response is `200` with `{ data[], meta }` and `meta` reflects the default page size of 25

#### Scenario: Read a single source by id

- **WHEN** an admin requests `GET /api/v1/admin/content-sources/:id` for an existing source
- **THEN** the response is `200` with `{ data, relationships }` exposing `id`, `certificationId`, `type`, `url`, `enabled`, `lastFetchedAt`, `recheckIntervalMinutes`, and `createdAt`

#### Scenario: Reading an unknown source returns 404

- **WHEN** an admin requests `GET /api/v1/admin/content-sources/:id` for an id that does not exist
- **THEN** the response is `404` as RFC 7807 Problem Details

#### Scenario: Non-admin cannot list sources

- **WHEN** a user with role `user` requests `GET /api/v1/admin/content-sources`
- **THEN** the response is `403` as RFC 7807 Problem Details

### Requirement: Admin can disable and re-enable a content source

The system SHALL expose `POST /api/v1/admin/content-sources/:id/disable` and `POST /api/v1/admin/content-sources/:id/enable`, both admin-only, which set the source's `enabled` flag to `false` and `true` respectively and return `200` with the updated source in a `{ data, relationships }` envelope. Each call that produces a real state change MUST write exactly one `AuditLog` entry via `AuditLogService.record(...)`: `source.disabled` for disable and `source.enabled` for enable, with the calling admin as actor, `targetType = 'ContentSource'`, `targetId` = the source id, and `before`/`after` snapshots of the `enabled` flag. A call that does not change the flag (disabling an already-disabled source, enabling an already-enabled source) MUST be an idempotent `200` no-op that writes no audit entry. Disabling is the takedown lever: the worker's stale-source cron already skips disabled sources, so a disabled source is not re-ingested by scheduled runs.

#### Scenario: Disabling an enabled source flips the flag and audits

- **WHEN** an admin `POST`s `/api/v1/admin/content-sources/:id/disable` for an `enabled = true` source
- **THEN** the response is `200` and `data.enabled = false`
- **AND** exactly one `audit_logs` row with `action = 'source.disabled'`, the admin actor, `target_id` = the source id, `before = { enabled: true }`, and `after = { enabled: false }` exists

#### Scenario: Re-enabling a disabled source flips the flag and audits

- **WHEN** an admin `POST`s `/api/v1/admin/content-sources/:id/enable` for an `enabled = false` source
- **THEN** the response is `200` and `data.enabled = true`
- **AND** exactly one `audit_logs` row with `action = 'source.enabled'` exists for the source

#### Scenario: Disabling an already-disabled source is a no-op without an audit entry

- **WHEN** an admin `POST`s `/disable` for a source that is already `enabled = false`
- **THEN** the response is `200` with `data.enabled = false`
- **AND** no new `audit_logs` row is written

#### Scenario: Disabling an unknown source returns 404

- **WHEN** an admin `POST`s `/disable` for a source id that does not exist
- **THEN** the response is `404` as RFC 7807 Problem Details

#### Scenario: Non-admin cannot disable a source

- **WHEN** a user with role `user` `POST`s `/api/v1/admin/content-sources/:id/disable`
- **THEN** the response is `403` as RFC 7807 Problem Details and the source's `enabled` flag is unchanged

### Requirement: Admin can trigger a manual re-ingestion

The system SHALL expose `POST /api/v1/admin/content-sources/:id/reingest`, admin-only, which resolves the source's certification domain list and enqueues one `ingest` job onto the BullMQ queue for the source's type (`ingestionQueueName(type)` = `ingestion-<type>`) with job data `{ contentSourceId, domains }`, matching the payload shape the worker's ingestion processor consumes. The response MUST be `202` with `{ data }` exposing the enqueued `jobId`, the `contentSourceId`, and the job's initial `state`. The action MUST write exactly one `AuditLog` entry via `AuditLogService.record(...)` with action `source.reingested`, the calling admin as actor, `targetType = 'ContentSource'`, `targetId` = the source id, and an `after` snapshot containing the `jobId`. Re-ingesting a disabled source MUST be refused with `409` as RFC 7807 Problem Details and MUST NOT enqueue a job or write an audit entry. Re-ingesting an unknown source MUST return `404`.

#### Scenario: Manual re-ingest enqueues a job on the source-type queue

- **WHEN** an admin `POST`s `/api/v1/admin/content-sources/:id/reingest` for an enabled `web` source whose cert has domains `['Security', 'Architecture']`
- **THEN** the response is `202` with `data.jobId` set and `data.contentSourceId` equal to the source id
- **AND** one job named `ingest` exists on the `ingestion-web` queue with data `{ contentSourceId: <id>, domains: ['Security', 'Architecture'] }`
- **AND** exactly one `audit_logs` row with `action = 'source.reingested'`, the admin actor, and an `after` containing the `jobId` exists

#### Scenario: Re-ingesting a disabled source is refused

- **WHEN** an admin `POST`s `/reingest` for a source with `enabled = false`
- **THEN** the response is `409` as RFC 7807 Problem Details
- **AND** no job is enqueued on any ingestion queue and no `audit_logs` row is written

#### Scenario: Re-ingesting an unknown source returns 404

- **WHEN** an admin `POST`s `/reingest` for a source id that does not exist
- **THEN** the response is `404` as RFC 7807 Problem Details and no job is enqueued

#### Scenario: Non-admin cannot trigger re-ingestion

- **WHEN** a user with role `user` `POST`s `/api/v1/admin/content-sources/:id/reingest`
- **THEN** the response is `403` as RFC 7807 Problem Details and no job is enqueued

### Requirement: Admin can view ingestion job status

The system SHALL expose `GET /api/v1/admin/content-sources/:id/jobs/:jobId`, admin-only, returning `200` with `{ data }` exposing `jobId`, `state` (one of BullMQ's `waiting`/`active`/`completed`/`failed`/`delayed`/`paused`/`unknown`), `progress`, `attemptsMade`, `failedReason` (nullable), and the `timestamp`/`processedOn`/`finishedOn` timestamps, read from the queue for the source's type. The system SHALL also expose `GET /api/v1/admin/content-sources/:id/jobs`, admin-only, returning `{ data[], meta }` of recent ingestion jobs for that source (filtered to jobs whose data `contentSourceId` matches the source) ordered most-recent first. A `jobId` that is not present on the source's queue MUST return `404` as RFC 7807 Problem Details. An unknown source id MUST return `404`.

#### Scenario: Reading the status of an enqueued job

- **WHEN** an admin triggers a re-ingest and then requests `GET /api/v1/admin/content-sources/:id/jobs/:jobId`
- **THEN** the response is `200` with `{ data }` exposing `jobId`, a `state` (e.g. `waiting`), `progress`, `attemptsMade`, and a nullable `failedReason`

#### Scenario: A failed job surfaces its failure reason

- **WHEN** an ingestion job for the source has failed and an admin requests its job status
- **THEN** the response is `200` with `data.state = 'failed'` and `data.failedReason` set to the failure message

#### Scenario: Listing recent jobs for a source

- **WHEN** an admin requests `GET /api/v1/admin/content-sources/:id/jobs` after triggering two re-ingests
- **THEN** the response is `200` with `{ data[], meta }` containing those jobs, most recent first
- **AND** only jobs whose data `contentSourceId` matches the source are returned

#### Scenario: Unknown job id returns 404

- **WHEN** an admin requests `GET /api/v1/admin/content-sources/:id/jobs/:jobId` for a `jobId` not present on the source's queue
- **THEN** the response is `404` as RFC 7807 Problem Details

#### Scenario: Non-admin cannot view job status

- **WHEN** a user with role `user` requests `GET /api/v1/admin/content-sources/:id/jobs/:jobId`
- **THEN** the response is `403` as RFC 7807 Problem Details

### Requirement: API enqueues onto the worker's ingestion queues without name drift

The API SHALL enqueue manual re-ingestion jobs onto the same BullMQ queues the worker processes by deriving queue names from a single shared `ingestionQueueName(type)` helper exported from `@readion/shared` (value `ingestion-<type>`), registered in the API via `BullModule.registerQueue` against the shared Redis connection. The worker SHALL import the same helper rather than declaring its own copy, so the producer (API) and consumer (worker) can never diverge on a queue name.

#### Scenario: Shared helper yields the worker's queue name

- **WHEN** `ingestionQueueName('web')` is evaluated in both the API and the worker
- **THEN** both return the identical string `ingestion-web`

#### Scenario: A job enqueued by the API is visible on the worker's queue instance

- **WHEN** the API enqueues an `ingest` job for a `web` source onto `ingestion-web`
- **THEN** a worker `Queue`/`QueueEvents` bound to `ingestion-web` on the same Redis observes that job

### Requirement: Privileged source actions extend the shared audit vocabulary

The shared `auditActions` vocabulary in `@readion/shared` SHALL include `source.enabled` and `source.reingested` in addition to the existing `source.added` and `source.disabled`, and the `AuditActionValue` type SHALL include them, so `AuditLogService.record(...)` accepts every privileged source action this capability performs. The vocabulary extension MUST be additive and MUST NOT remove or rename existing action values.

#### Scenario: New source action values are part of the vocabulary

- **WHEN** the `auditActions` tuple is inspected
- **THEN** it contains `source.added`, `source.disabled`, `source.enabled`, and `source.reingested`
- **AND** `AuditLogService.record` accepts an `action` of `source.reingested` without a type error
