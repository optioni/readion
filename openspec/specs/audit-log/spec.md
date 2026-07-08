# Capability: Audit Log

## Purpose

Provides an append-only record of privileged admin actions. A shared `AuditLogService.record(...)` writer persists one `AuditLog` row per privileged action (role changes today; source add/disable, content quarantine, and cert publish/re-verify in later changes), admins can read the log newest-first, and entries survive actor hard-purge with the actor identifier stripped. This change owns the `AuditLog` entity and its `audit_logs` table.
## Requirements
### Requirement: Privileged actions are recorded in an append-only audit log

The system SHALL provide a shared, injectable `AuditLogService.record(...)` that persists one append-only `AuditLog` row per privileged admin action. Each row MUST capture: the actor (`userId`, nullable so it can be stripped on actor purge), an `action` string drawn from the privileged-action vocabulary (e.g. `user.role.promoted`, `user.role.demoted`, and forward-looking values for source add/disable, content quarantine, cert publish/re-verify), `targetType`, `targetId`, optional `before` and `after` JSONB snapshots, and a `createdAt` timestamp. The audit log MUST be append-only: no API exposes update or deletion of entries; the only permitted mutation is the worker hard-purge nulling the actor identifier. The `AuditLog` entity and its `audit_logs` table (with a nullable `user_id` column) are owned and created by this change.

#### Scenario: Recording a privileged action writes one row

- **WHEN** `AuditLogService.record` is called with an actor id, action `user.role.promoted`, a target user id, and before/after role snapshots
- **THEN** exactly one new `audit_logs` row exists with that actor `user_id`, `action`, `target_type`, `target_id`, `before`, `after`, and a non-null `created_at`

#### Scenario: Audit log is append-only

- **WHEN** the API surface is inspected
- **THEN** there is no endpoint to edit or delete an `AuditLog` entry
- **AND** existing entries are never overwritten by a subsequent `record` call

### Requirement: Admin can view the audit log newest-first

The system SHALL expose `GET /api/v1/admin/audit-logs`, protected by the global `JwtAuthGuard` and restricted to the `admin` role, returning a paginated collection envelope `{ data[], meta }` of audit entries ordered by `createdAt` descending. Each item MUST include `id`, `userId` (the actor, nullable), `action`, `targetType`, `targetId`, `before`, `after`, and `createdAt`. Each item MUST ALSO include a resolved `actorEmail` — the email of the actor identified by `userId`, or `null` when the actor has been hard-purged (`userId` is `null`) or the action is system-originated — and a `targetLabel`: a human-readable identifier for the target (for example the affected user's email for a role change, or the source/certification title for a content or certification action), so the console can render identity without resolving raw UUIDs. `userId` is retained unchanged so the hard-purge invariant is preserved; `actorEmail` is a read-model projection and is never persisted on the `AuditLog` row. Pagination defaults to 25 and is capped at 100. Non-admin callers MUST receive `403`; unauthenticated callers MUST receive `401`.

#### Scenario: Admin views audit entries newest-first

- **WHEN** an admin requests `GET /api/v1/admin/audit-logs` after two role changes
- **THEN** the response is `200` with a `{ data[], meta }` envelope
- **AND** entries are ordered newest first by `createdAt`
- **AND** each entry exposes `id`, `userId`, `action`, `targetType`, `targetId`, `before`, `after`, `createdAt`, `actorEmail`, and `targetLabel`

#### Scenario: Actor and target are resolved to human-readable identity

- **WHEN** an admin views a `user.role.promoted` entry whose actor and target are both existing users
- **THEN** the entry's `actorEmail` is the acting admin's email
- **AND** the entry's `targetLabel` is the promoted user's email (not the raw `targetId` UUID)

#### Scenario: Purged actor resolves to a null email

- **WHEN** an audit entry's `userId` is `null` because the actor was hard-purged (or the action is system-originated)
- **THEN** the entry's `actorEmail` is `null`
- **AND** the entry still exposes its `action`, `targetType`, `targetId`, `targetLabel`, `before`, `after`, and `createdAt`

#### Scenario: Non-admin cannot view the audit log

- **WHEN** a user with role `user` requests `GET /api/v1/admin/audit-logs`
- **THEN** the response is `403` as RFC 7807 Problem Details

#### Scenario: Unauthenticated cannot view the audit log

- **WHEN** an unauthenticated request hits `GET /api/v1/admin/audit-logs`
- **THEN** the response is `401` as RFC 7807 Problem Details

### Requirement: Audit entries survive actor hard-purge with the actor identifier stripped

`AuditLog` rows SHALL be retained when their actor is hard-purged, with the direct actor identifier (`user_id`) nulled rather than the row deleted. The `audit_logs` table MUST expose a nullable `user_id` column so the existing `users` worker hard-purge cron (which runs `UPDATE audit_logs SET user_id = NULL WHERE user_id = ?` before deleting the user) succeeds now that the table exists.

#### Scenario: Audit row outlives the purged actor

- **WHEN** an actor with prior `audit_logs` entries is hard-purged by the worker cron
- **THEN** those `audit_logs` rows still exist
- **AND** their `user_id` is `NULL`
- **AND** their `action`, `target_type`, `target_id`, `before`, `after`, and `created_at` are unchanged

