## Context

`content-pipeline` already owns the `ContentSource`/`ContentChunk` entities (`packages/db`), the per-source-type BullMQ ingestion queues (`ingestion-<type>`, created via `registerSourceQueue` in `apps/worker/src/content-pipeline/queues/content-queues.module.ts`, with `ingestionQueueName(type)` returning `ingestion-<type>`), the ingestion processor that consumes `IngestionJobData = { contentSourceId, domains }` under the job name `ingest`, and the hourly stale-source re-ingestion cron (which already skips `enabled = false` sources). `admin` owns the `AuditLog` entity + `audit_logs` migration and the shared injectable `AuditLogService.record(...)` (exported from `AdminModule`), plus the `auditActions`/`AuditAction` vocabulary in `@readion/shared` (already including `source.added` and `source.disabled`). `auth` provides the global `JwtAuthGuard`, the `RolesGuard`, and the `@Roles('admin')` decorator. `certifications` exposes each cert's `domains` (`{ name, ... }[]`).

What is missing is the **admin HTTP surface** over that pipeline: register/list/read a source, enable/disable it, trigger an immediate re-ingest, and read ingestion job status. SPEC → ContentModule and SPEC → Frontend → Admin specify exactly this. The worker has no HTTP server, so these endpoints belong in `apps/api` as a new `ContentModule`, and the API enqueues onto the worker's existing Redis-backed queues — the established cross-app pattern (`mock-exam`/`diagnostic` already register `MOCK_EXAM_GENERATION_QUEUE` in the API via `BullModule.registerQueue` and the worker processes it).

This change owns **no entity and no migration** (per the Entity ownership table) and introduces **no cron and no feature metric** (those belong to `content-pipeline`). It writes `ContentSource` rows and `AuditLog` rows through existing tables.

## Goals / Non-Goals

**Goals:**
- `ContentModule` in `apps/api` mounted at `/api/v1/admin/content-sources`, every route under `JwtAuthGuard` + `@Roles('admin')`.
- Register (`POST`), list (`GET ?certificationId=`), read (`GET /:id`), disable/enable (`POST /:id/disable|/enable`), manual re-ingest (`POST /:id/reingest`), job status (`GET /:id/jobs`, `GET /:id/jobs/:jobId`).
- Audit every privileged source action through the shared `AuditLogService` (`source.added`, `source.disabled`, `source.enabled`, `source.reingested`).
- Promote `ingestionQueueName` into `@readion/shared` as the single source of truth for queue names; the API registers those queues with `BullModule.registerQueue`; the worker imports the same helper.
- Extend the shared `auditActions`/`AuditAction` vocabulary additively with `source.enabled` and `source.reingested`.
- Request/response DTOs + Zod schemas in `@readion/shared`; regenerate the committed Orval client.

**Non-Goals:**
- Any fetch/chunk/tag/embed/upsert logic, queue/processor definitions, or the stale-source cron — all owned by `content-pipeline`.
- Chunk superseding / cache eviction on disable/takedown and the superseded-cleanup cron — owned by `chunk-lifecycle`. Disabling here only flips the `enabled` flag (the takedown lever); chunk retirement is a downstream concern.
- Coverage-bar / draft→live and the "due for re-verification" cron — `cert-go-live` / `cert-setup-grounding`.
- The Phase 10 `web-admin` UI (source-management screens, job-status views). This change is backend only; it only regenerates the Orval client the UI later consumes.
- Quarantine review and cert publish/re-verify admin actions — separate changes own those (the `content.quarantined`/`cert.*` audit values already exist for them).

This is a non-UI, API-side change — no Visual Design section applies (the admin UI is Phase 10 `web-admin`).

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (`content_sources`, `audit_logs`, `certifications`) | real (Testcontainers) | real (Testcontainers) for repo/source persistence; n/a for pure mapper/snapshot logic |
| Redis / BullMQ ingestion queues | real (Testcontainers) — assert the `ingest` job lands on `ingestion-<type>` and read its state back | n/a |
| API HTTP layer | real (Supertest + `@nestjs/testing`) | n/a |
| `JwtAuthGuard` / `RolesGuard` / `@Roles` (`auth`) | real — admin obtained via first-user-admin registration; a second `user`-role account exercises `403` | n/a |
| `AuditLogService.record` (`admin`) | real — injected from `AdminModule`, assert `audit_logs` rows | invoked directly to assert action/snapshot shape |
| Worker ingestion processor | NOT run in the API acceptance test (processor autorun is disabled under `NODE_ENV=test`); assert the enqueued job/state only, not chunk side-effects | n/a |
| Playwright e2e | drives the real API directly (no `web-admin` UI yet); admin via first-user-admin registration | n/a |

The worker processor must not consume the job during the API test (it already gates autorun on `NODE_ENV !== 'test'`), so the acceptance test asserts the producer contract — job present on the correct queue with the correct `{ contentSourceId, domains }` data and a readable state — rather than end-to-end ingestion. Pure logic with no I/O (source→DTO mapper, audit `before`/`after` snapshot construction, job→status DTO mapper, `recheckIntervalMinutes` default selection) is unit-tested.

## Decisions

- **API enqueues onto the worker's existing queues; queue name lives in `@readion/shared`.** The worker currently defines `ingestionQueueName` locally in `content-queues.module.ts`. Moving it to `@readion/shared` (value unchanged: `ingestion-<type>`) lets the API register the same eight queues via `BullModule.registerQueue` and produce jobs the worker consumes, with one source of truth. Alternative (re-declaring the `ingestion-<type>` string in the API) was rejected — two copies silently drift and break ingestion. Mirrors the `mock-exam` precedent where the queue-name constant is shared.
- **Re-ingest builds the exact `IngestionJobData` the processor expects.** The endpoint resolves the cert's `domains.map(d => d.name)` (same as the worker's stale-source cron) and enqueues `{ contentSourceId, domains }` named `ingest`. This keeps manual and scheduled re-ingestion on an identical contract, so the processor needs no awareness of the trigger.
- **Disable is the takedown flag only; superseding is out of scope.** SPEC → Source Etiquette → Takedown path describes disabling supersedes chunks and evicts cache — but per the Entity ownership / change boundaries, chunk `state`/`supersededById` and eviction are owned by `chunk-lifecycle`. This change only flips `enabled`; the stale cron already skips disabled sources, so a disabled source stops being re-ingested. Chunk retirement is layered on by `chunk-lifecycle` (already archived) through its own hooks, not duplicated here.
- **Enable/disable are idempotent and audited only on real change.** Following the `admin` promote/demote precedent: a call that does not change `enabled` is a `200` no-op with no audit entry, keeping the audit log one-row-per-actual-transition and the endpoints safe to retry.
- **Re-ingest refuses disabled sources with `409`.** Enqueuing ingestion for a source an admin has deliberately taken down would contradict the takedown intent and re-populate chunks; `409 Conflict` communicates the state precedent without enqueuing or auditing.
- **Job status reads straight from BullMQ.** `GET /:id/jobs/:jobId` calls `queue.getJob(jobId)` on the source-type queue and maps state/progress/attempts/`failedReason`/timestamps to a DTO; `GET /:id/jobs` scans recent jobs (`getJobs([...states])`) filtered to `data.contentSourceId === id`. No new persistence — BullMQ is the system of record for job state, matching SPEC → BullMQ ("Job events emitted for status visibility in admin UI"). Alternative (persisting a job-tracking table) rejected as redundant with BullMQ and out of the entity-ownership boundary.
- **Audit vocabulary extended additively in `@readion/shared`.** Add `SourceEnabled: 'source.enabled'` and `SourceReingested: 'source.reingested'` to `AuditAction`/`auditActions`. The `admin` design explicitly left the vocabulary open for downstream changes to extend; `source.added`/`source.disabled` already exist so register/disable need no addition.
- **Repository scoping is role-based, not user-owned.** Like `admin` reads, these endpoints span all sources gated solely by `RolesGuard`; content sources are not user-owned resources, so the repository-layer `userId` scoping does not apply. Cert existence is validated on register (→ `404`) and source existence on every `/:id` route (→ `404`).

## Risks / Trade-offs

- **Queue-name helper relocation touches archived `content-pipeline` worker code** → The move is a pure re-export (same string value); a unit test asserts `ingestionQueueName('web') === 'ingestion-web'` from `@readion/shared`, and the worker's existing queue tests continue to pass since the value is unchanged.
- **`GET /:id/jobs` scans queue jobs** → Scanning across states can be O(n) on a busy queue; bound it with a sane fetch window (recent N per state) and rely on the `contentSourceId` filter. Acceptable for an admin, low-traffic surface; not a hot path.
- **BullMQ job retention/eviction means an old `jobId` may be gone** → A `jobId` no longer on the queue returns `404`; the admin UI treats absence as "no longer tracked," consistent with BullMQ's `removeOnComplete`/`removeOnFail` settings configured in `content-pipeline`.
- **Disable without chunk eviction leaves stale chunks live until `chunk-lifecycle` acts** → Accepted and documented: this change's contract is the `enabled` flag and the cron-skip behavior; chunk retirement is `chunk-lifecycle`'s responsibility and already exists separately.

## Open Questions

- None blocking. The `GET /:id/jobs` recent-window size and the BullMQ state set to scan are tunable constants chosen during implementation; defaults (waiting/active/completed/failed/delayed, recent N) are sufficient for the admin surface.
