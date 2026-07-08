## MODIFIED Requirements

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
