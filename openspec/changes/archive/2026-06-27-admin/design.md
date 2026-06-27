## Context

The `auth` change established the `User` entity with a `role` enum (`user`/`admin`), the global `JwtAuthGuard`, a `RolesGuard`, and a `@Roles(...)` decorator (`apps/api/src/auth/auth.guards.ts`). The `users` change added soft-delete (`deletedAt`), the `LastActiveAdminGuard` rule (`apps/api/src/users/last-active-admin.guard.ts`), and a worker hard-purge cron that already runs `UPDATE audit_logs SET user_id = NULL WHERE user_id = ?` defensively before deleting a user (`apps/worker/src/users/user-purge.service.ts`). The `user-certifications` change owns `UserCertification` (enrollment join entity).

There is no admin-facing surface to list users, change roles, or read a record of privileged actions. SPEC → AdminModule and SPEC → Core Entities (`AuditLog`) require both. Per the Entity Ownership table, this change owns the `AuditLog` entity + migration; it consumes (does not modify) `auth`, `users`, and `user-certifications` artifacts.

## Goals / Non-Goals

**Goals:**
- `AdminModule` (`apps/api`) under `JwtAuthGuard` + `@Roles('admin')`: paginated user list with enrollment counts, idempotent promote/demote actions, paginated newest-first audit-log read.
- Own and create the `AuditLog` entity + `audit_logs` migration with a nullable `user_id` matching the worker purge's expectation.
- A shared injectable `AuditLogService.record(...)` writer (append-only) reused by `content-admin` and `cert-setup-grounding` later; wired here into role changes.
- Reuse `LastActiveAdminGuard` so demotion cannot remove the last active admin.
- Regenerate the Orval client for `web-admin`.

**Non-Goals:**
- Any admin frontend/UI (belongs to `web-admin`).
- Content-source management, quarantine review, cert publish/re-verify actions, and their audit writes (belong to `content-admin` / `cert-setup-grounding`, which inject the `AuditLogService` introduced here).
- A new worker cron (none is attributed to `admin`; the identifier-strip already lives in the `users` purge).
- Changing the `auth` roles/guard or `users` deletion spec requirements.

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (`users`, `user_certifications`, `audit_logs`) | real (Testcontainers) | real (Testcontainers) for entity/repo + audit writer; n/a for pure role-transition logic |
| Redis refresh-token store (`auth`) | real (Testcontainers, via login flow) | n/a |
| API HTTP layer | real (Supertest + `@nestjs/testing`) | n/a |
| Auth register/login + guards (`JwtAuthGuard`/`RolesGuard`) | real (existing flows; first user is admin) | n/a |
| `LastActiveAdminGuard` (`users`) | real (counts active admins in test DB) | invoked directly against a seeded DB |
| Worker hard-purge identifier-strip (`users`) | cron method invoked directly against real DB | n/a |
| Playwright e2e | drives real API; admin obtained via first-user-admin registration | n/a |

## Decisions

- **`AuditLog` is a new owned entity; column `user_id` is the nullable actor FK.** Create `audit_logs` with `id` (uuid PK), `user_id` (nullable, the actor — nulled on purge, not FK-cascaded so the row survives), `action` (string), `target_type` (string), `target_id` (string), `before` (JSONB nullable), `after` (JSONB nullable), `created_at`. The column name `user_id` is fixed by the already-shipped worker purge SQL — using anything else would silently break the strip step. Alternative (a denormalized `actor_email_hash` retained after purge) was rejected as out of scope: the SPEC only requires retaining the row stripped of direct identifiers, which nulling `user_id` satisfies, and role-change snapshots store only the `role` value (no PII).
- **Append-only enforced by surface, not a DB trigger.** The service exposes only `record(...)` (insert) and a read query; no update/delete endpoint or method exists. The single permitted mutation is the worker's `user_id` null on purge. A DB-level immutability trigger was considered unnecessary given no write path exists and it would block the legitimate strip update.
- **`AuditLogService` is the shared writer.** It lives in the admin module but is exported so `content-admin`/`cert-setup-grounding` inject it for their privileged actions. Role changes call it within the same request; the action vocabulary (`user.role.promoted`, `user.role.demoted`, plus forward-looking `source.*`, `content.quarantined`, `cert.published`, `cert.reverified`) is a `packages/shared` constant so writers across changes stay consistent.
- **Promote/demote are idempotent POST actions, audited only on real change.** Following the SPEC action convention `POST /:resource/:id/:action`. If the target already holds the requested role, the call is a `200` no-op and writes no audit entry — this keeps the log meaningful (one entry per actual transition) and the endpoints safe to retry.
- **Demotion reuses `LastActiveAdminGuard`.** The guard already counts active (`deletedAt IS NULL`) admins and throws `409` when ≤ 1; demoting the last admin has identical semantics to deleting them, so the existing rule is reused rather than duplicated. It is imported from the `users` module.
- **Admin endpoints are role-scoped, not ownership-scoped.** The repository-layer `userId` ownership scoping applies to user-owned resources; admin reads deliberately span all users, gated solely by `RolesGuard`. The user list filters to active users (`deletedAt IS NULL`) since soft-deleted accounts cannot authenticate and are pending purge.
- **Enrollment count via grouped count over `user_certifications`.** `enrollmentCount` is the count of `active`-status `UserCertification` rows per user, computed with a grouped/aggregate query (not N+1 per-user loads).

## Risks / Trade-offs

- **`audit_logs.user_id` name drift** → The worker purge hard-codes the column name; the migration must use exactly `user_id`. An integration test invokes the purge after seeding an audit row and asserts the row survives with `user_id = NULL`.
- **Last-admin race on concurrent demotions** → Two simultaneous demotions could each see two admins and both proceed. Mitigate by performing the active-admin count and the role write within one transaction (the guard runs inside the same unit of work as the update), matching how `users` guards deletion.
- **Self-demotion** → An admin demoting themselves is allowed when another active admin exists and blocked (`409`) when they are the last; covered by the last-admin guard counting active admins regardless of who the caller is.
- **Audit snapshots leaking PII** → Restrict role-change `before`/`after` to the `role` value only, so nulling `user_id` fully de-identifies the retained row.

## Open Questions

- None blocking. The privileged-action vocabulary is introduced as an open string-constant set; downstream changes (`content-admin`, `cert-setup-grounding`) extend it with their own action values when they wire in the `AuditLogService`.
