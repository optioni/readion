## ADDED Requirements

### Requirement: Admin can list all users with role and enrollment counts

The system SHALL expose `GET /api/v1/admin/users`, protected by the global `JwtAuthGuard` and restricted to the `admin` role via the `RolesGuard` (`@Roles('admin')`). It returns a paginated collection envelope `{ data[], meta }` of all active (non-soft-deleted) users, newest first. Each item MUST include `id`, `email`, `role`, `emailVerified`, `createdAt`, and `enrollmentCount` (the user's count of `active` `UserCertification` rows). Pagination defaults to 25 per page and is capped at 100. Non-admin callers MUST receive `403`; unauthenticated callers MUST receive `401`.

#### Scenario: Admin lists users

- **WHEN** an authenticated `admin` requests `GET /api/v1/admin/users`
- **THEN** the response is `200` with a `{ data[], meta }` envelope
- **AND** each `data` item has `id`, `email`, `role`, `emailVerified`, `createdAt`, and an integer `enrollmentCount` equal to that user's number of `active` `UserCertification` rows
- **AND** `meta` reports the total count and the page size used

#### Scenario: Pagination is bounded

- **WHEN** an admin requests `GET /api/v1/admin/users?perPage=500`
- **THEN** the response is `200` and at most 100 items are returned

#### Scenario: Non-admin is forbidden

- **WHEN** an authenticated user with role `user` requests `GET /api/v1/admin/users`
- **THEN** the response is `403` as RFC 7807 Problem Details

#### Scenario: Unauthenticated is rejected

- **WHEN** an unauthenticated request hits `GET /api/v1/admin/users`
- **THEN** the response is `401` as RFC 7807 Problem Details

### Requirement: Admin can promote a user to admin

The system SHALL expose `POST /api/v1/admin/users/:id/promote` (admin-only) that sets the target user's `role` to `admin`. When the role actually changes, the action MUST write an `AuditLog` entry (action `user.role.promoted`, target the user, before/after role snapshot). Promoting a user who is already `admin` is an idempotent no-op that MUST NOT write an audit entry. A non-existent target MUST return `404`.

#### Scenario: Promote a regular user

- **WHEN** an admin POSTs `/api/v1/admin/users/:id/promote` for a user whose role is `user`
- **THEN** the response is `200` and the target user's `role` is now `admin`
- **AND** exactly one new `AuditLog` row exists with action `user.role.promoted`, the target user's id, and `before.role = "user"` / `after.role = "admin"`

#### Scenario: Promoting an existing admin is a no-op

- **WHEN** an admin POSTs `/api/v1/admin/users/:id/promote` for a user already in role `admin`
- **THEN** the response is `200`, the role remains `admin`
- **AND** no new `AuditLog` row is written

#### Scenario: Promoting a missing user

- **WHEN** an admin POSTs `/api/v1/admin/users/:id/promote` for an id that does not exist
- **THEN** the response is `404` as RFC 7807 Problem Details

#### Scenario: Non-admin cannot promote

- **WHEN** a user with role `user` POSTs `/api/v1/admin/users/:id/promote`
- **THEN** the response is `403` as RFC 7807 Problem Details

### Requirement: Admin can demote an admin to user, except the last admin

The system SHALL expose `POST /api/v1/admin/users/:id/demote` (admin-only) that sets the target user's `role` to `user`. When the role actually changes, it MUST write an `AuditLog` entry (action `user.role.demoted`, before/after role snapshot). Demotion MUST be blocked with `409` when it would leave zero active admins (reusing the `LastActiveAdminGuard` rule). Demoting a user already in role `user` is an idempotent no-op that MUST NOT write an audit entry. A non-existent target MUST return `404`.

#### Scenario: Demote an admin when another active admin exists

- **WHEN** an admin POSTs `/api/v1/admin/users/:id/demote` for an `admin` while at least one other active admin exists
- **THEN** the response is `200` and the target user's `role` is now `user`
- **AND** a new `AuditLog` row exists with action `user.role.demoted`, `before.role = "admin"` / `after.role = "user"`

#### Scenario: Demoting the last active admin is blocked

- **WHEN** an admin POSTs `/api/v1/admin/users/:id/demote` for the only remaining active admin
- **THEN** the response is `409` as RFC 7807 Problem Details indicating the last admin cannot be demoted
- **AND** the target's role remains `admin`
- **AND** no `AuditLog` row is written

#### Scenario: Demoting a regular user is a no-op

- **WHEN** an admin POSTs `/api/v1/admin/users/:id/demote` for a user already in role `user`
- **THEN** the response is `200`, the role remains `user`
- **AND** no new `AuditLog` row is written

#### Scenario: Non-admin cannot demote

- **WHEN** a user with role `user` POSTs `/api/v1/admin/users/:id/demote`
- **THEN** the response is `403` as RFC 7807 Problem Details
