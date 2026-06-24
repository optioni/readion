## ADDED Requirements

### Requirement: Self-serve account deletion soft-deletes with password re-confirmation

The system SHALL expose `DELETE /api/v1/users/me`, protected by the global `JwtAuthGuard`, requiring the user to re-confirm their current password in the request body. On success it MUST: mark the account soft-deleted by setting `deletedAt` to the current time, revoke all of the user's outstanding refresh tokens via the `auth` refresh-token store, and release the email so it can be re-registered. After soft delete the user MUST NOT be able to authenticate. The response is `204`.

#### Scenario: Successful soft delete

- **WHEN** an authenticated user POSTs the correct current password to `DELETE /api/v1/users/me`
- **THEN** the response is `204`
- **AND** the user row has `deletedAt` set to a non-null timestamp
- **AND** all of that user's refresh tokens are revoked in the refresh-token store
- **AND** a subsequent login attempt with the same credentials fails with `401`

#### Scenario: Wrong password is rejected

- **WHEN** an authenticated user submits an incorrect current password to `DELETE /api/v1/users/me`
- **THEN** the response is `401` as RFC 7807 Problem Details
- **AND** the user row is not soft-deleted and refresh tokens remain valid

#### Scenario: Released email can be re-registered

- **WHEN** a user with email `ada@example.com` is soft-deleted
- **AND** a new registration is submitted for `ada@example.com`
- **THEN** the registration succeeds and creates a distinct new active `User`
- **AND** the soft-deleted original row is retained for the grace window

### Requirement: Deleting the last remaining admin is blocked

The system SHALL prevent soft-deleting an account when doing so would leave the system with zero active (non-soft-deleted) admins. The same guard applies regardless of whether deletion is self-serve or admin-initiated.

#### Scenario: Last admin cannot delete themselves

- **WHEN** the only active admin submits `DELETE /api/v1/users/me` with the correct password
- **THEN** the response is `409` as RFC 7807 Problem Details indicating the last admin cannot be deleted
- **AND** the account is not soft-deleted

#### Scenario: Admin can delete when another active admin exists

- **WHEN** an admin account submits `DELETE /api/v1/users/me` with the correct password while at least one other active admin exists
- **THEN** the response is `204` and the account is soft-deleted

### Requirement: Hard-purge cron permanently removes accounts past the grace window

The worker SHALL run a scheduled processor that finds accounts whose `deletedAt` is older than the configurable grace window (`LIFECYCLE_DELETION_GRACE_DAYS`, default 14 days) and permanently removes them, cascading within a transaction to all user-scoped records: `UserCertification`, `StudySession`, `SessionItem`, `QuizResponse`, `MockExam`, `WeakArea`, `ReviewItem`, `AgentConversation`, `AgentMessage`. Shared `ContentChunk`s MUST be untouched. `AuditLog` entries MUST be retained but stripped of direct identifiers. Accounts still within the grace window MUST NOT be purged.

#### Scenario: Account past grace window is hard-purged with cascade

- **WHEN** the hard-purge cron runs and a soft-deleted user's `deletedAt` is older than the configured grace window
- **THEN** the user row is permanently deleted
- **AND** all of that user's `UserCertification`, `StudySession`, `SessionItem`, `QuizResponse`, `MockExam`, `WeakArea`, `ReviewItem`, `AgentConversation`, and `AgentMessage` rows are deleted
- **AND** no `ContentChunk` rows are deleted

#### Scenario: Account within grace window is retained

- **WHEN** the hard-purge cron runs and a soft-deleted user's `deletedAt` is within the configured grace window
- **THEN** the user row and all its user-scoped records remain present

#### Scenario: Audit log entries survive purge without direct identifiers

- **WHEN** a user with prior `AuditLog` entries is hard-purged
- **THEN** those `AuditLog` rows still exist
- **AND** their direct identifiers referencing the purged user are stripped
