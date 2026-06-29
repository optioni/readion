## ADDED Requirements

### Requirement: Authenticated password change

The system SHALL expose `POST /api/v1/auth/change-password` to authenticated users, accepting `currentPassword` and `newPassword`. It MUST verify `currentPassword` against the stored bcrypt hash before any change, enforce the same minimum-strength rule as registration (at least 8 characters) on `newPassword`, persist the new password only as a bcrypt hash, and — consistent with the capability invariant that credential-changing operations revoke outstanding sessions — revoke all of the user's other refresh tokens while rotating the caller's. The raw password MUST NEVER be persisted in plaintext, returned, or logged.

#### Scenario: Successful password change

- **WHEN** an authenticated user POSTs `{ "currentPassword": "correcthorse", "newPassword": "batterystaple9" }` to `/api/v1/auth/change-password` and `currentPassword` matches their stored hash
- **THEN** the response is `204` (or an envelope carrying a rotated access/refresh token)
- **AND** the persisted `User.passwordHash` is a new bcrypt hash that verifies against `batterystaple9` and no longer against `correcthorse`
- **AND** all of the user's other refresh tokens are revoked, so a refresh attempt with a pre-change refresh token fails

#### Scenario: Wrong current password is rejected

- **WHEN** an authenticated user submits a `currentPassword` that does not match their stored hash
- **THEN** the response is `401` (or `403`) RFC 7807 Problem Details indicating the current password is incorrect
- **AND** the stored `passwordHash` is unchanged and no sessions are revoked

#### Scenario: Weak new password is rejected

- **WHEN** an authenticated user submits a `newPassword` of fewer than 8 characters
- **THEN** the response is `422` RFC 7807 with an `errors[]` entry for the `newPassword` field
- **AND** the stored `passwordHash` is unchanged

#### Scenario: Unauthenticated request is rejected

- **WHEN** the endpoint is called without a valid access token
- **THEN** the response is `401` and no lookup or mutation occurs
