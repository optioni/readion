## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Stand up an API acceptance harness (Supertest + `@nestjs/testing` + Testcontainers Postgres/Redis) that boots `CertSetupModule` with `AdminModule` (for `AuditLogService`), `CertificationsModule`, the registered `cert-extraction` queue, and real `JwtAuthGuard`/`RolesGuard`; inject a fake `llm-foundation` gateway returning canned discovery candidates and a canned extraction result; register the first user (auto-admin) plus a second `user`-role account. The worker processor is not booted here — assert the producer contract only (extraction job enqueued with the right data), per design.md Test Boundaries
- [x] 0.2 Write the failing acceptance test covering the new-cert setup flow: discover sources (200, vendor-domain ranked first, nothing persisted); extract (`POST /extract` → 202 with `jobId`, exactly one `cert-extraction` job enqueued with `{ name, code, confirmedSourceUrl }`; `GET .../extractions/:jobId` → 200 with job `state`, and `404` for an unknown job id — the worker processor is not booted here, so the per-field citation/`unverified` result is asserted in tasks group 4, with the `fields` read covered by seeding a completed-job result); create a grounded draft (201, `state: draft`, provenance + `verifiedAt` persisted, `cert.created` audit, weights-sum-to-100 `422` path, duplicate-`code` `409`); `GET .../due-for-reverification`; and `POST .../:id/reverify` (200, fields/provenance/`verifiedAt` updated, `cert.reverified` audit, state unchanged, `404`); plus `403` for `user` and `401` unauthenticated on every route
- [x] 0.3 Confirm it fails for the right reason (module/endpoints absent), not a harness/config error

## 1. Shared contracts — DTOs, provenance extension, audit action, queue name, config

- [x] 1.1 RED: Unit-test `@readion/shared` additions — the per-field provenance union (`CertificationFieldCitation | { unverified: true } | { manuallyConfirmed: true }`) and a `CertificationProvenance` that still serializes through the existing JSON column; `auditActions` contains `cert.created` and `AuditActionValue` includes it; the `cert-extraction` queue-name constant resolves identically in both apps; Zod schemas for discover request/response, extract request/result, create request, reverify request, and the due-for-reverification list item parse/reject correctly
- [x] 1.2 GREEN: Extend `CertificationProvenance`/`CertificationFieldCitation` additively; add `CertCreated: 'cert.created'` to `AuditAction`/`auditActions`; add the `cert-extraction` queue-name constant; add the request/response DTOs/types
- [x] 1.3 REFACTOR: Confirm the provenance change is JSON-only (no `packages/db` migration), and that existing `certifications`/`admin` shared tests still pass unchanged

## 2. Pure logic — provenance builder, weights validator, due derivation, discovery ranking

- [x] 2.1 RED: Unit-test (a) the per-field provenance builder mapping an extraction result to citation / `unverified` / `manuallyConfirmed` states; (b) the domain-weights-sum-to-100 validator; (c) `dueForReverification(verifiedAt, now, intervalDays)` (null `verifiedAt` and aged-past-interval are due, fresh is not); (d) the discovery candidate ranking (vendor-domain candidates ahead of third-party)
- [x] 2.2 GREEN: Implement these pure helpers
- [x] 2.3 REFACTOR: De-duplicate any shared snapshot/mapping helpers

## 3. Source discovery service (gateway web search)

- [x] 3.1 RED: Integration-test a `CertDiscoveryService` against a fake gateway — resolves the `certification-prefill` task type, supplies a web-search tool through the gateway's tool-capable call, returns candidates grounded in the (faked) search results, ranks vendor domains first, and never emits a URL absent from the results (empty array when none)
- [x] 3.2 GREEN: Implement `CertDiscoveryService` calling `LlmService` (tool-capable streaming method) with the web-search tool and `stopWhen`; map the result to `candidates[]` + `suggestedContentSources[]`
- [x] 3.3 REFACTOR: Tidy prompt assembly and result parsing; no direct provider-SDK import

## 4. Extraction worker job — scrapper fetch + grounded per-field extraction + verify

- [x] 4.1 RED: Integration-test the worker `CertExtractionProcessor` — given a stubbed scrapper returning fixture source text, it extracts each field, validates the cited passage is a **verbatim** substring via the shared extractive-contract validator, runs an independent `answer-verification` gateway call, returns grounded fields with `{ url, passage }` and flags ungrounded/failed fields `{ unverified: true }`
- [x] 4.2 GREEN: Implement the processor reusing the worker scrapper client + `LlmService` + the shared validator; register the `cert-extraction` queue/processor in the worker content-pipeline module; persist/return the job result for the API to read
- [x] 4.3 REFACTOR: Extract per-field extraction helpers; ensure no fetch strategy or grounding code is duplicated

## 5. Cert-setup service (orchestration) + read models

- [x] 5.1 RED: Integration-test `CertSetupService` — `discoverSources` (delegates to `CertDiscoveryService`, persists nothing), `enqueueExtraction` (produces the `cert-extraction` job with `{ name, code, confirmedSourceUrl }`, returns `jobId`/initial state) and `readExtractionResult(jobId)` (returns job `state` + completed `fields`, throws `NotFound` for an unknown job id), `createDraft` (validates weights→`422`, duplicate `code`→`409`, creates `state: draft` with provenance map + `verifiedAt`, writes `cert.created` audit), `reverify` (404 on missing; updates fields/provenance/`verifiedAt`; state unchanged; `cert.reverified` audit), and `listDueForReverification` (derived from `verifiedAt` + `CERT_REVERIFICATION_INTERVAL_DAYS`)
- [x] 5.2 GREEN: Implement `CertSetupService` injecting `CertDiscoveryService`, the `cert-extraction` `Queue`, the `CertificationsService`/repository, `AuditLogService` (from `AdminModule`), and config; add `CERT_REVERIFICATION_INTERVAL_DAYS` to the api Zod env schema
- [x] 5.3 REFACTOR: Map errors to NestJS `HttpException` subclasses; tidy audit `before`/`after` snapshot building

## 6. CertSetupModule controller + wiring (HTTP surface)

- [x] 6.1 RED: Controller integration tests for every route under `JwtAuthGuard` + `@Roles('admin')` — `POST /discover-sources` (200), `POST /extract` (202 + `jobId`), `GET /extractions/:jobId` (200 with state, 404 unknown), `POST /` (201, 422, 409), `GET /due-for-reverification` (`{ data[], meta }`, default/max page size), `POST /:id/reverify` (200, 404); assert `403` for `user` and `401` unauthenticated on each
- [x] 6.2 GREEN: Implement `CertSetupController` + `CertSetupModule` (import `AdminModule`, `CertificationsModule`, a queue module that `BullModule.registerQueue`s `cert-extraction` against shared Redis); register in `AppModule`
- [x] 6.3 REFACTOR: Ensure responses flow through the global `ResponseInterceptor`/`ExceptionFilter` (no manual envelope wrapping); tidy DTO validation

## 7. Worker cron — due-for-reverification surfacing

- [x] 7.1 RED: Integration-test `CertReverificationCron` — with three certs aged past the interval it sets the due-count gauge metric to 3, logs the due set, modifies no certification row, and is registered as a cron distinct from `stale-source.cron`
- [x] 7.2 GREEN: Implement `apps/worker/src/content-pipeline/cron/cert-reverification.cron.ts` + its gauge metric; add `CERT_REVERIFICATION_INTERVAL_DAYS` to the worker Zod env schema
- [x] 7.3 REFACTOR: Reuse the derived-due helper from `@readion/shared`; confirm no overlap with the stale-source re-ingestion cron

## 8. Acceptance Test — Outer Loop GREEN

- [x] 8.1 Confirm the acceptance test from group 0 passes end-to-end
- [x] 8.2 Verify affected apps boot locally — `apps/api` (new `CertSetupModule` registers the `cert-extraction` queue, no config errors) and `apps/worker` (new processor + cron register, scrapper resolves); smoke-test discovery/extraction against stubs with no startup errors
- [x] 8.3 Run `yarn codegen` and commit the regenerated Orval client under `apps/web/src/api/`
- [x] 8.4 REFACTOR: Clean up test setup, harness, and any duplication

## 9. Change Review — Subagent Verification

- [x] 9.1 Dispatch a subagent to review the change against proposal.md, the `certification-setup` spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 9.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests after fixes

## 10. Polish

- [x] 10.1 Run linter and fix all errors (`yarn lint`)
- [x] 10.2 Run formatter and apply fixes (`yarn format`)
- [x] 10.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 10.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
