## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Stand up the integration test harness for `apps/api` using `@nestjs/testing` + Supertest + the Testcontainers Postgres harness from `db-foundation` (no external services to mock — see design.md Test Boundaries)
- [x] 0.2 Write failing acceptance test (e2e in `apps/web/e2e/` driving the generated client, or API-level): the certification catalog is reachable — `GET /api/v1/certifications` returns 200 with the `{ data[], meta }` envelope and lists only `live` certs; `GET /api/v1/certifications/:id` returns the single-resource envelope for a live cert and 404 (RFC 7807) for a missing id
- [x] 0.3 Confirm it fails for the right reason (route/module missing), not a harness/setup error

## 1. CertificationsModule — Controller (outermost)

- [x] 1.1 RED: Write integration test for `CertificationsController` — `GET /api/v1/certifications` returns paginated live-only collection (seed a `live` and a `draft` row; assert draft absent, `meta.total`/`page`/`limit` present, `limit` capped at 100); `GET /api/v1/certifications/:id` returns 200 single-resource envelope with `relationships` and no user-specific fields, 404 problem-details for unknown id
- [x] 1.2 GREEN: Implement `CertificationsController` (list + detail), wire `CertificationsModule` into the app module; rely on the global `ResponseInterceptor`/`ExceptionFilter` (do not hand-wrap)
- [x] 1.3 REFACTOR: Clean up controller, query/pagination DTO validation, OpenAPI decorators for Orval

## 2. CertificationsService

- [x] 2.1 RED: Write unit/integration test for `CertificationsService` — `list({page, limit})` returns only `state: live` rows with correct pagination/total and bounded limit; `findOne(id)` returns the cert or throws `NotFoundException` for unknown id
- [x] 2.2 GREEN: Implement `CertificationsService` over the MikroORM repository (live-only filter, pagination, default 25 / max 100)
- [x] 2.3 REFACTOR: Clean up service and repository query

## 3. Certification DTOs & response mapping

- [x] 3.1 RED: Write unit test for the certification → DTO mapper — maps `name`, `provider`, `code`, weighted `domains`, `questionCount`, `passingScore`, `timeLimitMinutes`; builds the `relationships` block; omits internal/user-specific fields
- [x] 3.2 GREEN: Implement the DTO(s) (shared types in `packages/shared` where reused by web) and mapper
- [x] 3.3 REFACTOR: Clean up mapping, ensure single composable response schema for `?include` compatibility

## 4. Certification entity (packages/db) + migration

- [x] 4.1 RED: Write integration test asserting a `Certification` persists and reads back all structured fields (`domains[{name,weight}]`, exam-format facts, `provenance`, `verifiedAt`) and that `state` defaults to `draft`
- [x] 4.2 GREEN: Add the `Certification` MikroORM entity (this change owns it) with `state` (`draft`/`live`, default `draft`), structured `provenance` (`verified` | per-field `{url,passage}`), and `verifiedAt`; generate the creation migration via `yarn workspace @readion/db migration:create`
- [x] 4.3 REFACTOR: Clean up entity definition, unique constraint on exam `code`, indexes as needed

## 5. Verified seed data + validation

- [x] 5.1 RED: Write unit test for seed-data validation — every seeded cert's domain `weight` values sum to 100 and required exam-format fields are present; RED: write integration test asserting the seeder is idempotent (running twice yields no duplicates) and seeds primary-target certs (e.g. `CLF-C02`) as `state: draft` with `verified` provenance
- [x] 5.2 GREEN: Implement the verified seed data for AWS/Azure/Kubernetes/AI-ML primary-target certs (from `SPEC.md → Supported Certifications`, curated from official guides) and an idempotent seed migration keyed on exam `code`
- [x] 5.3 REFACTOR: Clean up seed data structure and the idempotent upsert

## 6. Acceptance Test — Outer Loop GREEN

- [x] 6.1 Confirm the acceptance test passes end-to-end (run migrations + seeder against the test DB; seed a `live` cert where the test asserts list contents)
- [x] 6.2 Verify affected apps start in the local environment (smoke test) — boot `apps/api` (and the worker if it loads `packages/db`) and confirm no startup/config or migration errors
- [x] 6.3 Regenerate and commit the Orval client (`yarn codegen` with `apps/api` running); REFACTOR test setup/fixtures if needed

## 7. Change Review — Subagent Verification

- [x] 7.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 7.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 8. Polish

- [x] 8.1 Run linter and fix all errors (`yarn lint`)
- [x] 8.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 8.3 Run type checker with zero errors (`yarn workspace apps/api typecheck`)
- [x] 8.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
