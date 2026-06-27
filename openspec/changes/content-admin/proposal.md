## Why

The content pipeline (`content-pipeline`) can ingest sources and the worker re-enqueues stale sources on a cron, but there is no human-operated way to **register a source for a certification, enable/disable it, force an immediate re-ingestion, or see whether an ingestion job is running, done, or failed**. SPEC → ContentModule and SPEC → Frontend → Admin require an admin-facing surface over the already-built pipeline so operators can curate a certification's knowledge base and react to takedowns or stale content. This is the backend that the Phase 10 `web-admin` UI consumes; without it the admin source-management screen has no API to generate against.

## What Changes

- Add `ContentModule` (admin-facing) in `apps/api`, mounted under `/api/v1/admin/content-sources/*`, protected by the global `JwtAuthGuard` + `@Roles('admin')` (`RolesGuard`).
- **Register a source**: `POST /api/v1/admin/content-sources` — create a `ContentSource` (cert + type + url), deriving the default `recheckIntervalMinutes` from the source type when omitted.
- **List / read sources**: `GET /api/v1/admin/content-sources?certificationId=…` (collection envelope `{ data[], meta }`) and `GET /api/v1/admin/content-sources/:id` (single envelope `{ data, relationships }`).
- **Enable / disable a source**: `POST /api/v1/admin/content-sources/:id/disable` and `POST /api/v1/admin/content-sources/:id/enable` — disabling is the takedown lever (the worker cron already skips disabled sources; chunk superseding/eviction is owned by `chunk-lifecycle` and is out of scope here).
- **Manual re-ingest**: `POST /api/v1/admin/content-sources/:id/reingest` — resolve the source's certification domain list and enqueue an `ingest` job onto that source type's existing BullMQ queue (`ingestion-<type>`) immediately, returning the `jobId` and initial state. Refuse to enqueue for a disabled source.
- **Ingestion job status**: `GET /api/v1/admin/content-sources/:id/jobs` (recent jobs for the source across queue states) and `GET /api/v1/admin/content-sources/:id/jobs/:jobId` (state, progress, timestamps, `failedReason`) read from the source-type queue.
- **Audit every privileged action** via the existing shared `AuditLogService.record(...)` (owned by `admin`): register, disable, enable, and manual re-ingest. Extend the shared `auditActions` vocabulary in `@readion/shared` with `source.enabled` and `source.reingested` (the set was designed as open/forward-looking; `source.added` and `source.disabled` already exist).
- Promote the worker's `ingestion-<type>` queue-name helper into `@readion/shared` so the API enqueues onto the exact same queue names the worker processes, with no string drift. Register those queues in the API via `BullModule.registerQueue` against the shared Redis (mirrors the `mock-exam` cross-app queue pattern).
- Add request/response DTOs + Zod schemas in `@readion/shared` (register-source request, source response, job-status response) and regenerate the committed Orval client.

This change **orchestrates** the existing pipeline — it does not duplicate fetch strategies, chunking, tagging, embedding, queues, or processors, all owned by `content-pipeline`.

## Capabilities

### New Capabilities
- `content-source-admin`: Admin-only management of content sources over the existing ingestion pipeline — register/list/read a source, enable/disable (takedown lever), trigger an immediate re-ingestion job, read ingestion job status, with every privileged action written to the append-only audit log.

### Modified Capabilities
<!-- None. No existing capability's spec-level requirements change. The audit-log vocabulary is extended via an additive shared constant, not a behavioral change to the `audit-log` capability's requirements. -->

## Impact

- **New code**: `apps/api/src/content/` (module, controller, service, source repository, job-status service, mapper, DTOs). New Zod schemas/DTOs + audit-action values + shared `ingestionQueueName` helper in `packages/shared`.
- **Touched code**: `apps/worker/src/content-pipeline/queues/content-queues.module.ts` re-exports `ingestionQueueName` from `@readion/shared` (DRY; no behavioral change). Regenerated Orval client under `apps/web/src/api/`.
- **Reused, not modified**: `ContentSource`/`ContentChunk` entities + `content_sources` table and the `ingestion-<type>` BullMQ queues (`content-pipeline`); `AuditLog` entity + `AuditLogService` (`admin`); `JwtAuthGuard`/`RolesGuard`/`@Roles` (`auth`); `Certification` domain list (`certifications`).
- **No new entity, no new migration** — content-admin owns no entity (per the Entity ownership table); it writes `AuditLog` rows and `ContentSource` rows through existing tables.
- **No new cron and no new feature metric** are attributed to this change (the stale-source cron and ingestion-count metric are owned by `content-pipeline`).
- **Dependencies**: `content-pipeline`, `auth`, `admin` — all archived/implemented. The Phase 10 `web-admin` UI and the `cert-setup-grounding` change both depend on this API.
