## 0. Acceptance Tests — Outer Loop RED

- [x] 0.1 Stand up the integration harness: Testcontainers Postgres, real `JwtAuthGuard`/`RolesGuard`, helpers to seed a `Certification` (draft), `ContentSource`s (enabled/disabled), and `ContentChunk`s (active/superseded, multi-domain `domainTags`); worker fetch strategy / domain tagger / embedder mocked per design.md Test Boundaries
- [x] 0.2 Write failing API acceptance test (Supertest): "Admin retrieves the coverage report for a draft cert" — `GET /api/v1/certifications/:id/coverage` as admin returns 200 `{ data }` with the first domain `chunkCount` 12 / `chunkThreshold` 20 / `met` false and overall `met` false / `state` draft; plus "Non-admin user is forbidden" (403) and "Coverage for a missing certification returns 404"
- [x] 0.3 Write failing worker acceptance test: "Ingestion that completes the bar promotes the cert" — a draft cert one source short, an ingestion run for a new enabled source completes via `IngestionService`, and the cert's `state` becomes `live`; plus "Ingestion that does not complete the bar leaves the cert draft" and "A live certification is never demoted by re-evaluation"
- [x] 0.4 Confirm both acceptance tests fail for the right reason (missing endpoint / missing promotion hook), not a harness/setup error

## 1. Admin coverage read model (`apps/api`) — outermost

- [x] 1.1 RED: Write unit test for `CertificationCoverageService` — given a cert + mocked coverage-stats loader and pure evaluator, it assembles the `CoverageReport` envelope payload; and 404 when the cert is absent
- [x] 1.2 GREEN: Implement `CertificationCoverageController` (`GET /api/v1/certifications/:id/coverage`, `@Roles('admin')` via `RolesGuard`) + `CertificationCoverageService` returning the single-resource `{ data }` envelope; wire into the certifications/admin module
- [x] 1.3 REFACTOR: Clean up DTO shaping; ensure 403 (non-admin) and 404 (missing cert) flow through the global `ExceptionFilter` as RFC 7807
- [x] 1.4 Regenerate the Orval client (`yarn codegen`) and commit the generated output for the new endpoint

## 2. Promotion hook on ingestion completion (`apps/worker`) — outermost

- [x] 2.1 RED: Write unit test for the promotion step — given a mocked coverage-stats loader + pure evaluator + cert repository, a `draft` cert that now meets the bar is flipped to `live`; a `draft` cert that does not meet the bar is left `draft`; a `live` cert is never written/demoted; re-running on a passing `live` cert is a no-op
- [x] 2.2 GREEN: Implement the promotion service and invoke it at the end of `IngestionService.ingest()` (after reconciliation + `updateLastFetchedAt`), scoped to `source.certificationId`; emit a structured log line on promotion
- [x] 2.3 REFACTOR: Keep the hook side-effect-only and idempotent; ensure it never throws into the ingestion job on a no-op

## 3. Coverage stats query (`packages/db`) — inward

- [x] 3.1 RED: Write real-DB test for the coverage-stats query helper — seed active + superseded chunks (multi-domain `domainTags`) across enabled/disabled sources; assert per-domain active chunk counts, per-domain distinct enabled-source counts, and total active chunk count, with superseded chunks excluded
- [x] 3.2 GREEN: Implement the MikroORM/SQL aggregation returning `{ domains: { name, chunkCount, enabledSourceCount }[], totalChunks }` for a `certificationId`, matching the stored `domainTags` shape
- [x] 3.3 REFACTOR: Ensure the query is scoped/indexed by `certificationId` and shared by both `apps/api` and `apps/worker`

## 4. Pure coverage evaluator + types (`packages/shared`) — deepest

- [x] 4.1 RED: Write table-driven unit tests for `evaluateCoverage(domainList, domainStats, totalChunks, questionCount, thresholds)` covering each spec scenario: all-pass, a domain below the per-domain minimum, a configured domain with zero chunks (absent from `domainStats`, zero-filled), total below `multiple × questionCount`, a domain with chunks but no enabled source, empty domain list, and overridden thresholds
- [x] 4.2 GREEN: Implement `evaluateCoverage` (zero-filling any configured domain absent from `domainStats`) plus the `CoverageReport` / `CoverageThresholds` types and the `DEFAULT_MIN_CHUNKS_PER_DOMAIN = 20` / `DEFAULT_TOTAL_CHUNK_MULTIPLE = 3` constants in `packages/shared`
- [x] 4.3 REFACTOR: Keep the evaluator pure (no DB/IO) and the per-domain + overall `met` computation single-sourced

## 5. Threshold configuration (`apps/api` + `apps/worker`)

- [x] 5.1 RED: Write env-schema tests asserting `CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN` and `CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE` parse, default to the shared constants (20, 3), and reject non-positive values in both apps' Zod schemas
- [x] 5.2 GREEN: Add the two vars to both Zod env schemas (defaults from the shared constants) and thread them into the coverage service / promotion hook; add them to each app's `.env.example`
- [x] 5.3 REFACTOR: Source both defaults from the shared constants so the api and worker schemas cannot diverge

## 6. Acceptance Tests — Outer Loop GREEN

- [x] 6.1 Confirm both acceptance tests (API coverage endpoint + worker promotion) pass end-to-end
- [x] 6.2 Verify all affected apps start in the local environment (smoke test) — boot `apps/api` and `apps/worker` and confirm no startup/config errors with the new env vars
- [x] 6.3 REFACTOR: Clean up test setup, seed helpers, and mocks if needed

## 7. Change Review — Subagent Verification

- [x] 7.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 7.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 8. Polish

- [x] 8.1 Run linter and fix all errors (`yarn lint`)
- [x] 8.2 Run formatter and apply fixes (`yarn format`)
- [x] 8.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 8.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
