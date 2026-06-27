## Why

The platform has roles (`user`/`admin`) and a `RolesGuard`, but no admin-facing surface to manage them: an admin cannot see who the users are, nor promote/demote anyone, and there is no durable record of privileged actions. SPEC → AdminModule requires a user list and role management, and SPEC → Core Entities requires an append-only `AuditLog` of privileged admin actions. This change introduces both, plus the shared audit-writer that every later privileged-action change (`content-admin`, `cert-setup-grounding`) depends on.

## What Changes

- Add an `AdminModule` to `apps/api`, mounted under the global `JwtAuthGuard` and gated to the `admin` role via the existing `RolesGuard` (`@Roles('admin')`):
  - `GET /api/v1/admin/users` — paginated list of all active users with role and active-enrollment count (collection envelope `{ data[], meta }`, default 25 / max 100).
  - `POST /api/v1/admin/users/:id/promote` — set a user's role to `admin`. Idempotent (no-op + no audit entry if already `admin`).
  - `POST /api/v1/admin/users/:id/demote` — set an admin's role to `user`. Blocks demoting the **last active admin** (`409`). Idempotent for a plain `user`.
  - `GET /api/v1/admin/audit-logs` — paginated, newest-first view of the audit log.
- Introduce the **`AuditLog` entity** (owned by this change per the Entity Ownership table) and its migration creating the `audit_logs` table: nullable actor `user_id`, `action`, `target_type`, `target_id`, nullable `before`/`after` JSONB snapshots, and `created_at`. The `user_id` column name matches what the `users` worker hard-purge cron already nulls on actor deletion.
- Add a shared **`AuditLogService.record(...)`** writer (append-only) that emits an audit entry for a privileged action. This change wires it into the role-change actions; `content-admin` and `cert-setup-grounding` inject the same service for their privileged actions later.
- Reuse the `LastActiveAdminGuard` rule introduced by `users` so demotion (like deletion) cannot remove the last active admin.
- Add `packages/shared` DTOs/types and the privileged-action vocabulary constants (admin user-list item, audit-log entry, role-change request/response).
- Regenerate the Orval client so the new admin endpoints are available to `web-admin` later.

## Capabilities

### New Capabilities
- `user-admin`: Admin-only user administration — paginated list of users with role and enrollment counts, and idempotent promote/demote actions between `user` and `admin`, with a last-active-admin guard on demotion. Each successful role change writes an audit entry.
- `audit-log`: Append-only `AuditLog` of privileged admin actions (actor, action, target type/id, before/after snapshot, timestamp) via a shared `AuditLogService.record(...)` writer, an admin-only newest-first read endpoint, and survival of the actor's hard-purge with the direct actor identifier nulled.

### Modified Capabilities
<!-- None: this change consumes the auth-owned roles/RolesGuard and the user-certifications enrollment data but does not alter their spec requirements. -->

## Impact

- **apps/api:** new `AdminModule` (controller, service, DTOs) under `JwtAuthGuard` + `@Roles('admin')`; new injectable `AuditLogService` writer reused by downstream privileged-action changes. Reuses `LastActiveAdminGuard` from the `users` module.
- **packages/db:** new `AuditLog` entity + migration creating `audit_logs` (this change owns the table per the Entity Ownership table). Column `user_id` aligns with the already-present worker purge that nulls it.
- **packages/shared:** admin DTOs/types and privileged-action constant vocabulary.
- **apps/worker:** no new cron (none attributed to `admin`); an integration test now asserts the existing hard-purge nulls `audit_logs.user_id` and retains the row, since the table now exists.
- **apps/web:** new admin endpoints surface in the regenerated Orval client; UI belongs to `web-admin`.
- **Depends on:** `auth` (User entity, `role` enum, `JwtAuthGuard` + `RolesGuard` + `@Roles`), `users` (`LastActiveAdminGuard`, soft-delete/`deletedAt` scoping, worker purge that nulls `audit_logs.user_id`). Enrollment counts read the `user-certifications`-owned `UserCertification` table.
