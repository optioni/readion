## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up e2e harness: Testcontainers Postgres + Redis, API + worker under `@nestjs/testing`, and a registered+verified test user via existing `auth` flows (see design.md Test Boundaries)
- [x] 0.2 Write failing Playwright e2e: an authenticated user reads `/users/me`, updates `displayTimezone` + a session default, then deletes their account with password re-confirmation and can no longer log in
- [x] 0.3 Confirm it fails for the right reason (route/module absent, not a harness error)

## 1. Shared contracts & config

- [x] 1.1 RED: Unit test the session-default-preference option-set constants and the update DTO validation (allowed durations/mixes/difficulties/focus/styles, IANA timezone) in `packages/shared`
- [x] 1.2 GREEN: Add `packages/shared` constants + DTO/types (profile response, update payload) and `LIFECYCLE_DELETION_GRACE_DAYS` (default 14) + `DEFAULT_DISPLAY_TIMEZONE` (default `Europe/Helsinki`) env-schema keys for api + worker
- [x] 1.3 REFACTOR: De-duplicate option sets so DTO validators and the entity reference one source

## 2. User entity extension & migration (`packages/db`)

- [x] 2.1 RED: Integration test (Testcontainers) asserting the migrated `users` table has `display_timezone`, session-default columns, `deleted_at`, the partial unique index on `email WHERE deleted_at IS NULL`, and correct defaults on insert
- [x] 2.2 GREEN: Extend the `User` schema with the new properties and generate a migration adding the columns + replacing the email unique constraint with the soft-delete-aware partial unique index
- [x] 2.3 RED: Integration test that a soft-deleted email can be re-registered (auth lookup scoped to `deleted_at IS NULL`); if the auth lookup is not already scoped, extend it
- [x] 2.4 GREEN: Ensure active-user scoping for registration/login lookups; confirm migration SQL emits a partial (not column-level) unique index
- [x] 2.5 REFACTOR: Tidy entity definition and migration; verify `migration:up`/`migration:down` round-trip

## 3. Profile read/update (`UsersService` + `UsersController`)

- [x] 3.1 RED: Unit test `UsersService.getProfile`/`updateProfile` — returns own profile without `passwordHash`; rejects invalid timezone and out-of-set preference values; ignores immutable fields (`email`, `role`, `emailVerified`)
- [x] 3.2 GREEN: Implement `UsersService` profile read/update against the repository
- [x] 3.3 RED: Integration test (Supertest) `GET /api/v1/users/me` (200 envelope, no password; 401 unauthenticated) and `PATCH /api/v1/users/me` (200 update; 422 invalid timezone / out-of-set value; immutables unchanged)
- [x] 3.4 GREEN: Implement `UsersController` + `UsersModule` wired under the global `JwtAuthGuard`; map errors via the global exception filter (RFC 7807)
- [x] 3.5 REFACTOR: Clean up DTO wiring and response-envelope shaping

## 4. Account soft delete (`DELETE /users/me`)

- [x] 4.1 RED: Unit test soft-delete logic — wrong password → 401 (no state change); correct password → sets `deletedAt`, calls auth revoke-all-refresh-tokens, releases email; last-active-admin → 409 (no state change)
- [x] 4.2 GREEN: Implement `UsersService.deleteOwnAccount` using the auth password-verify + refresh-token-revoke surfaces and an active-admin-count guard
- [x] 4.3 RED: Integration test `DELETE /api/v1/users/me` — 204 + `deletedAt` set + refresh tokens revoked + subsequent login 401; wrong password 401; released email re-registers as a new active user; last admin blocked 409; admin deletable when another active admin exists
- [x] 4.4 GREEN: Implement controller action with password-confirmation body; surface 401/409 via the exception filter
- [x] 4.5 REFACTOR: Extract the last-admin guard as a reusable rule for later reuse by `admin`

## 5. Hard-purge cron (`apps/worker`)

- [x] 5.1 RED: Unit test purge-eligibility logic against an injected clock — selects only users with `deletedAt < now - grace`; retains those within the window
- [x] 5.2 GREEN: Implement the eligibility query + `@nestjs/schedule` processor reading `LIFECYCLE_DELETION_GRACE_DAYS`
- [x] 5.3 RED: Integration test (Testcontainers) invoking the cron method directly — eligible user + user-scoped rows (the cascade tables that exist now) are deleted in one transaction; `ContentChunk` untouched; within-window user retained
- [x] 5.4 GREEN: Implement the transactional cascade in FK-safe order over the currently-existing user-scoped tables; defensively skip tables/entities not yet present; leave `AuditLog` identifier-strip as a guarded no-op until `admin` introduces `AuditLog`
- [x] 5.5 REFACTOR: Document (in code where non-obvious) the forward-looking cascade list so later changes (`user-certifications`, `sessions`, `mock-exam`, `review-srs`, `agent`) wire their tables in

## 6. Acceptance Test — Outer Loop GREEN

- [x] 6.1 Confirm the Playwright e2e passes end-to-end
- [x] 6.2 Verify api + worker boot in the local environment (smoke test) — no startup/config errors with the new env keys
- [x] 6.3 REFACTOR: Clean up test setup, fixtures, and any temporary scaffolding

## 7. Change Review — Subagent Verification

- [x] 7.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md plus the diff and this task list (reviewer reports findings only, does not edit code)
- [x] 7.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 8. Polish

- [x] 8.1 Run linter and fix all errors (`yarn lint`)
- [x] 8.2 Run formatter and apply fixes (`yarn format`)
- [x] 8.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 8.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
