## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Stand up an API acceptance harness (Supertest + `@nestjs/testing` + Testcontainers Postgres/Redis) that boots `ContentModule` with `AdminModule` (for `AuditLogService`), `CertificationsModule`, the shared ingestion queue registrations, real `JwtAuthGuard`/`RolesGuard`; register the first user (auto-admin) plus a second `user`-role account. The worker app/processor is not booted by this harness, so the test asserts the producer contract only (job present on `ingestion-<type>` + readable state), never chunk side-effects — see design.md Test Boundaries
- [x] 0.2 Write failing acceptance test covering the admin source lifecycle: register a `web` source (201, `source.added` audit, default interval), list/read it, disable then enable (audits + idempotent no-op), trigger a manual re-ingest (202 + `ingest` job on `ingestion-web` with `{ contentSourceId, domains }` + `source.reingested` audit), read job status (200 with state), and the `403`/`404`/`409` paths
- [x] 0.3 Confirm it fails for the right reason (module/endpoints absent), not a harness/config error

## 1. Shared contracts — DTOs, audit vocabulary, queue-name helper

- [ ] 1.1 RED: Unit-test `@readion/shared` additions — `ingestionQueueName('web') === 'ingestion-web'`; `auditActions` contains `source.enabled` and `source.reingested` and `AuditActionValue` includes them; Zod schemas for register-source request (cert id, `type` in `contentSourceTypes`, url, optional interval), source response, and job-status response parse/reject correctly
- [ ] 1.2 GREEN: Add `ingestionQueueName` to `@readion/shared`; add `SourceEnabled`/`SourceReingested` to `AuditAction`/`auditActions`; add register-source request schema, `ContentSourceResponse`, `IngestionJobStatus`, and `EnqueuedJobResponse` DTOs/types
- [ ] 1.3 REFACTOR: Re-export `ingestionQueueName` from `@readion/shared` in the worker's `content-queues.module.ts` (drop the local copy); confirm existing worker queue tests still pass with the unchanged string value

## 2. Source repository (data access)

- [ ] 2.1 RED: Write integration test (real Postgres) for a `ContentSourceRepository` — create with default-interval derivation from `SOURCE_RECHECK_INTERVALS`, find by id (null when absent), list by `certificationId` newest-first with pagination, toggle `enabled`
- [ ] 2.2 GREEN: Implement `ContentSourceRepository` over the existing `ContentSource` entity (no migration — entity owned by `content-pipeline`)
- [ ] 2.3 REFACTOR: Clean up query/scoping helpers

## 3. Mappers and audit snapshots (pure logic)

- [ ] 3.1 RED: Unit-test the source→`ContentSourceResponse` mapper, the BullMQ job→`IngestionJobStatus` mapper (state/progress/attemptsMade/failedReason/timestamps), and the audit `before`/`after` snapshot builders for add/disable/enable/reingest
- [ ] 3.2 GREEN: Implement the mappers and snapshot builders
- [ ] 3.3 REFACTOR: De-duplicate snapshot/mapping helpers

## 4. ContentSource admin service (orchestration)

- [ ] 4.1 RED: Integration-test `ContentSourceService` — register (validates cert exists → throws `NotFound` otherwise; writes `source.added` audit), disable/enable (idempotent no-op writes no audit; real change writes audit), reingest (refuses disabled with `Conflict`; resolves cert `domains.map(d=>d.name)`; enqueues `ingest` on `ingestionQueueName(type)`; writes `source.reingested` audit), and job status reads (`getJob`/recent-jobs scan filtered by `data.contentSourceId`)
- [ ] 4.2 GREEN: Implement `ContentSourceService` injecting `ContentSourceRepository`, the `CertificationsService`/repo, `AuditLogService` (from `AdminModule`), and the registered ingestion `Queue`s; build `IngestionJobData = { contentSourceId, domains }` under job name `ingest`
- [ ] 4.3 REFACTOR: Extract queue-resolution-by-type and tidy error mapping to NestJS `HttpException` subclasses

## 5. ContentModule controller + wiring (HTTP surface)

- [ ] 5.1 RED: Controller integration tests for every route under `JwtAuthGuard` + `@Roles('admin')` — `POST /` (201), `GET /` (`{ data[], meta }`, `?certificationId` filter, default/max page size), `GET /:id` (single envelope, 404), `POST /:id/disable|/enable` (200), `POST /:id/reingest` (202, 409 on disabled), `GET /:id/jobs` and `/:id/jobs/:jobId` (200/404); assert `403` for `user` role and `401` unauthenticated
- [ ] 5.2 GREEN: Implement `ContentController`, `ContentModule` (import `AdminModule`, `CertificationsModule`, and a queue module that `BullModule.registerQueue`s all `ingestionQueueName(type)` queues against shared Redis); register `ContentModule` in `AppModule`
- [ ] 5.3 REFACTOR: Ensure responses flow through the global `ResponseInterceptor`/`ExceptionFilter` (no manual envelope wrapping); tidy DTO validation

## 6. Acceptance Test — Outer Loop GREEN

- [ ] 6.1 Confirm the acceptance test from group 0 passes end-to-end
- [ ] 6.2 Verify affected apps start in the local environment — boot `apps/api` (new `ContentModule` registers queues, no config errors) and `apps/worker` (unchanged queue names resolve from `@readion/shared`); smoke-test with no startup errors
- [ ] 6.3 Run `yarn codegen` and commit the regenerated Orval client under `apps/web/src/api/`
- [ ] 6.4 REFACTOR: Clean up test setup, harness, and any duplication

## 7. Change Review — Subagent Verification

- [ ] 7.1 Dispatch a subagent to review the change against proposal.md, the `content-source-admin` spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [ ] 7.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests after fixes

## 8. Polish

- [ ] 8.1 Run linter and fix all errors (`yarn lint`)
- [ ] 8.2 Run formatter and apply fixes (`yarn format`)
- [ ] 8.3 Run type checker with zero errors (`yarn typecheck`)
- [ ] 8.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
