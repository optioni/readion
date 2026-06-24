## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up e2e/integration harness: spin up the API with Testcontainers Postgres (real DB, no mocks per design.md Test Boundaries), seed one `live` and one `draft` certification, and register + authenticate a test user to obtain a JWT
- [x] 0.2 Write failing acceptance test: an authenticated user enrolls in a `live` certification (`POST /api/v1/user-certifications`), it appears in their active list (`GET /api/v1/user-certifications`), they override a session pref (`PATCH`), archive it, confirm it leaves the active list, and restore it via re-enroll
- [x] 0.3 Confirm it fails for the right reason (endpoints/entity missing), not a harness/config error

## 1. UserCertification entity + migration (packages/db)

- [x] 1.1 RED: Write entity spec asserting `UserCertification` persists `user`, `certification`, `status` (default `active`), `enrolledAt`, nullable per-cert override fields, and rejects a duplicate `(user, certification)` pair
- [x] 1.2 GREEN: Define `UserCertification` via `defineEntity`/`p.` (ManyToOne → `User`, ManyToOne → `Certification`, unique index on the pair, nullable override columns) and export it from `@readion/db`
- [x] 1.3 GREEN: Create and verify the migration (`migration:create`, run `migration:up`/`migration:down` against the test DB)
- [x] 1.4 REFACTOR: Align naming/optional-props with `certification.entity.ts` and `user.entity.ts` conventions

## 2. Shared contracts (packages/shared)

- [x] 2.1 RED: Write schema spec for the `enrollment` request/response shapes — enroll body (`certificationId` + optional partial overrides), update body (partial overrides, nullable to clear), and the enrollment response DTO
- [x] 2.2 GREEN: Add `enrollment` Zod schemas, status constants, and response/request types, reusing `sessionDefaultsSchema.partial()` for overrides; export from `@readion/shared`
- [x] 2.3 REFACTOR: De-duplicate against existing user session-default exports

## 3. Service — ownership scoping & enrollment logic (apps/api)

- [x] 3.1 RED: Unit/integration spec for `UserCertificationsService` covering: enroll in live cert creates active row; enroll in draft/missing → `NotFoundException`; re-enroll archived → restore (preserves `enrolledAt`, no duplicate); enroll while active → `ConflictException`; findOne/list scoped on `userId` (cross-user → `NotFoundException`); update overrides incl. null-clear; archive/restore status flips
- [x] 3.2 GREEN: Implement `UserCertificationsService` with repository-layer `userId` scoping (`findOne(UserCertification, { id, user: userId })`), live-cert check, restore-vs-create branching, override merge/clear, status mutators
- [x] 3.3 REFACTOR: Extract the restore-vs-create decision into a small pure helper and unit-test it directly

## 4. Mapper (apps/api)

- [x] 4.1 RED: Unit spec asserting `mapUserCertificationToDto` produces the single-resource attributes (`id`, `certificationId`, `status`, `enrolledAt`, overrides) and omits other users'/downstream fields
- [x] 4.2 GREEN: Implement the mapper
- [x] 4.3 REFACTOR: Mirror the structure of `certifications.mapper.ts`

## 5. Controller + module wiring (apps/api)

- [x] 5.1 RED: Integration specs (Supertest, real DB) for each endpoint asserting status codes and envelopes: `POST /` (201 / 404 draft / 409 active / 401 unauth), `GET /` (default active, `?status=archived`, cross-user isolation), `GET /:id` (200 / 404 other-user / 404 missing), `PATCH /:id` (200 / 400 invalid / 404 other-user), `POST /:id/archive` + `POST /:id/restore` (200 / 404 other-user)
- [x] 5.2 GREEN: Implement `UserCertificationsController` (authenticated, `@CurrentUser()`, DTO validation) and `UserCertificationsModule`; register in `AppModule` behind the global `JwtAuthGuard`
- [x] 5.3 REFACTOR: Tidy DTOs/`@nestjs/swagger` annotations for clean Orval output

## 6. Generated API client

- [x] 6.1 Run `yarn codegen` against the running API and commit the regenerated `apps/web/src/api/` client

## 7. Acceptance Test — Outer Loop GREEN

- [x] 7.1 Confirm the acceptance test from 0.2 passes end-to-end
- [x] 7.2 Verify affected apps boot in the local environment (smoke test): `apps/api` starts with the new module and migration applied, no startup/config errors
- [x] 7.3 REFACTOR: Clean up test setup and shared fixtures

## 8. Change Review — Subagent Verification

- [x] 8.1 Dispatch a subagent to review the change against proposal.md, the `enrollment` spec scenarios, and design.md (reviewer reports findings by severity only, does not edit code)
- [x] 8.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted), note SUGGESTIONs; re-run affected tests

## 9. Polish

- [x] 9.1 Run linter and fix all errors (`yarn lint`)
- [x] 9.2 Run formatter and apply fixes (`yarn format`)
- [x] 9.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 9.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
