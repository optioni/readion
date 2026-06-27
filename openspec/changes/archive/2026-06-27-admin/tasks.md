## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the e2e harness: Testcontainers Postgres + Redis, API under `@nestjs/testing`, a first registered+verified user (auto-admin) plus a second `user`-role account via existing `auth` flows (see design.md Test Boundaries)
- [x] 0.2 Write a failing Playwright e2e: the admin lists users via `GET /api/v1/admin/users` (sees both with role + enrollment count), promotes the second user, demotes them again, then reads `GET /api/v1/admin/audit-logs` and sees the two role-change entries newest-first; a `user`-role caller hitting any admin route gets `403`
- [x] 0.3 Confirm it fails for the right reason (AdminModule/routes absent, not a harness error)

## 1. Shared contracts & constants (`packages/shared`)

- [x] 1.1 RED: Unit test the privileged-action vocabulary constants (`user.role.promoted`/`user.role.demoted` present, type exported) and the admin DTO/types (user-list item, audit-log entry, role-change response shapes)
- [x] 1.2 GREEN: Add `packages/shared` constants (privileged-action vocabulary) and DTO/types for the admin user-list item (`id`, `email`, `role`, `emailVerified`, `createdAt`, `enrollmentCount`) and the audit-log entry (`id`, `userId`, `action`, `targetType`, `targetId`, `before`, `after`, `createdAt`)
- [x] 1.3 REFACTOR: Single-source the action vocabulary so the entity, writer, and DTOs reference one definition

## 2. `AuditLog` entity & migration (`packages/db`)

- [x] 2.1 RED: Integration test (Testcontainers) asserting the migrated `audit_logs` table has `id`, nullable `user_id`, `action`, `target_type`, `target_id`, nullable `before`/`after` JSONB, and `created_at`, and that a row inserts and reads back correctly
- [x] 2.2 GREEN: Add the `AuditLog` entity (`packages/db`, extending `BaseSchema`) with a nullable actor `user_id` (no cascade) and JSONB `before`/`after`; generate the migration creating `audit_logs`
- [x] 2.3 REFACTOR: Register the entity, verify `migration:up`/`migration:down` round-trip, and confirm the column is named exactly `user_id` (matching the worker purge SQL)

## 3. Audit writer (`AuditLogService`, `apps/api`)

- [x] 3.1 RED: Integration test (Testcontainers) for `AuditLogService.record(...)` — one call inserts exactly one append-only row with the given actor, action, target type/id, and before/after snapshots; a second call does not overwrite the first
- [x] 3.2 GREEN: Implement the injectable `AuditLogService` with a single `record(...)` write method (no update/delete surface), exported for reuse by downstream privileged-action changes
- [x] 3.3 REFACTOR: Tidy the writer interface and its before/after snapshot typing

## 4. AdminModule — user list & role management (`apps/api`)

- [x] 4.1 RED: Unit test the role-transition logic — promote sets `admin` and reports "changed" only when previously `user`; demote sets `user` and reports "changed" only when previously `admin`; no-op transitions report "unchanged" (so no audit write)
- [x] 4.2 GREEN: Implement `AdminService` (list active users with grouped `active` enrollment counts; promote/demote applying the transition, reusing `LastActiveAdminGuard` for demotion, and calling `AuditLogService.record` only on actual change)
- [x] 4.3 RED: Integration test (Supertest) for `GET /api/v1/admin/users` (200 envelope with role + `enrollmentCount`, ≤100 cap; 401 unauthenticated; 403 for `user` role) and `GET /api/v1/admin/audit-logs` (200 newest-first envelope; 401; 403)
- [x] 4.4 RED: Integration test (Supertest) for `POST /api/v1/admin/users/:id/promote` (200 + role=admin + one audit row; already-admin no-op no audit; 404 missing; 403 non-admin) and `POST /api/v1/admin/users/:id/demote` (200 + role=user + audit row when another admin exists; 409 last admin no audit; already-user no-op; 404; 403)
- [x] 4.5 GREEN: Implement `AdminController` + `AdminModule` under `JwtAuthGuard` + `@Roles('admin')`, importing `LastActiveAdminGuard` and `AuditLogService`; map 404/409/403 via the global RFC 7807 exception filter; shape responses via the global `ResponseInterceptor` (collection envelope for lists)
- [x] 4.6 REFACTOR: Clean up DTO wiring, pagination clamping (default 25 / max 100), and module exports

## 5. Worker purge identifier-strip verification (`apps/worker`)
<!-- parallel-after: 2 -->

- [x] 5.1 RED: Integration test (Testcontainers) that seeds an `audit_logs` row for an actor, soft-deletes that actor past the grace window, invokes the existing hard-purge cron method, and asserts the user row is gone while the `audit_logs` row remains with `user_id = NULL` and all other columns unchanged
- [x] 5.2 GREEN: Confirm the existing purge nulls `audit_logs.user_id` now that the table exists; adjust only if the column/table presence guard misbehaves against the real table
- [x] 5.3 REFACTOR: Tidy the test fixture; no production change expected if the purge already behaves

## 6. Acceptance Test — Outer Loop GREEN

- [x] 6.1 Confirm the Playwright e2e passes end-to-end
- [x] 6.2 Verify api + worker boot in the local environment (smoke test) — no startup/config errors with the new module and entity
- [x] 6.3 Run `yarn codegen` (with the API running) and commit the regenerated Orval client for the new admin endpoints
- [x] 6.4 REFACTOR: Clean up test setup, fixtures, and any temporary scaffolding

## 7. Change Review — Subagent Verification

- [x] 7.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md plus the diff and this task list (reviewer reports findings only, does not edit code)
- [x] 7.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 8. Polish

- [x] 8.1 Run linter and fix all errors (`yarn lint`)
- [x] 8.2 Run formatter and apply fixes (`yarn format`)
- [x] 8.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 8.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
