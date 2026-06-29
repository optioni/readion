# Capability: Authentication

## Purpose

Defines user identity management — registration, login, token issuance, refresh, logout, email verification, and password reset. Access tokens are short-lived JWTs; refresh tokens rotate on every use and are stored in Redis behind an httpOnly cookie. All credential-changing operations revoke outstanding sessions.

## Requirements

### Requirement: User entity persists identity and verification state

The system SHALL define a `User` entity owned by this change (table + first domain migration in `packages/db`) with a unique email, a bcrypt password hash, a boolean `emailVerified` flag defaulting to `false`, and a `role` enum (`user` | `admin`). The raw password MUST NEVER be persisted, returned in any API response, or logged.

#### Scenario: Email uniqueness is enforced

- **WHEN** a registration is attempted with an email that already belongs to an existing user (case-insensitive)
- **THEN** the request fails with a `409` RFC 7807 Problem Details response whose `detail` indicates the email is already taken
- **AND** no second `User` row is created

#### Scenario: Password is stored only as a bcrypt hash

- **WHEN** a user registers with password `hunter2`
- **THEN** the persisted `User.passwordHash` is a bcrypt hash (starts with `$2`) that verifies against `hunter2`
- **AND** the plaintext `hunter2` does not appear in the stored row or in any response body

### Requirement: User registration creates an unverified account and sends a verification email

The system SHALL expose `POST /api/v1/auth/register` accepting `email` and `password`. On success it MUST create a `User` with `emailVerified=false`, send a verification email via `MailService`, issue an access token + rotating refresh token, and return a `201` envelope. Email MUST be validated as an address and password MUST meet a minimum strength rule (at least 8 characters); violations return `422`.

#### Scenario: Successful registration

- **WHEN** a client POSTs `{ "email": "ada@example.com", "password": "correcthorse" }` to `/api/v1/auth/register`
- **THEN** the response is `201` with `data` containing the created user's `id`, `email`, `role`, and `emailVerified: false` (and no password field)
- **AND** an access token is present in the response body and a refresh token is set as an `httpOnly` cookie
- **AND** exactly one verification email is sent to `ada@example.com`

#### Scenario: Weak password is rejected

- **WHEN** a client registers with `password` of fewer than 8 characters
- **THEN** the response is `422` RFC 7807 with an `errors[]` entry for the `password` field
- **AND** no `User` row is created and no email is sent

### Requirement: The first registered user becomes an admin

The system SHALL assign `role=admin` to the first user ever registered, and `role=user` to every subsequent registration. The check MUST be based on whether any non-deleted `User` already exists.

#### Scenario: First user is admin

- **WHEN** the user table is empty and a user registers
- **THEN** the created user's `role` is `admin`

#### Scenario: Second user is a regular user

- **WHEN** at least one user already exists and a new user registers
- **THEN** the created user's `role` is `user`

### Requirement: Login verifies credentials and issues tokens

The system SHALL expose `POST /api/v1/auth/login` accepting `email` and `password`. On matching credentials it MUST return a `200` envelope with a fresh access token in the body and a rotating refresh token in an `httpOnly` cookie. Invalid email or password MUST return a uniform `401` that does not reveal which field was wrong.

#### Scenario: Successful login

- **WHEN** a registered user POSTs correct `email` and `password` to `/api/v1/auth/login`
- **THEN** the response is `200` with an access token in `data` and a refresh-token `httpOnly` cookie in the response
- **AND** a new refresh token is recorded in Redis for that user

#### Scenario: Wrong password is rejected uniformly

- **WHEN** a login is attempted with a correct email but wrong password
- **THEN** the response is `401` RFC 7807
- **AND** the `detail` is identical to the response for an unknown email (no account enumeration)

### Requirement: Access tokens are short-lived JWTs

The system SHALL issue JWT access tokens that expire after 15 minutes, signed with the configured JWT secret, carrying the user's `id` and `role` as claims. Expired or malformed access tokens MUST be rejected as `401` by the global guard.

#### Scenario: Valid access token authorizes a protected request

- **WHEN** a request to a protected endpoint carries a valid, unexpired access token
- **THEN** the request is authorized and the resolved principal exposes the token's `sub` (user id) and `role`

#### Scenario: Expired access token is rejected

- **WHEN** a request carries an access token whose `exp` is in the past
- **THEN** the response is `401` RFC 7807 and the request never reaches the controller

### Requirement: Refresh tokens are stored in Redis and rotate on every use

The system SHALL expose `POST /api/v1/auth/refresh` that reads the refresh token from the `httpOnly` cookie, validates it against the Redis store, and on success issues a new access token and a **new** refresh token (7-day TTL), invalidating the consumed one. Reuse of an already-rotated (consumed) refresh token MUST fail with `401`.

#### Scenario: Refresh rotates the token

- **WHEN** a client POSTs to `/api/v1/auth/refresh` with a valid refresh-token cookie
- **THEN** the response is `200` with a new access token and a new refresh-token cookie
- **AND** the previously presented refresh token is no longer accepted by a subsequent refresh

#### Scenario: Replayed (already-rotated) refresh token is rejected

- **WHEN** a refresh token that was already used once is presented again
- **THEN** the response is `401` RFC 7807 and no new tokens are issued

#### Scenario: Unknown refresh token is rejected

- **WHEN** a refresh request presents a token that is absent from the Redis store
- **THEN** the response is `401` RFC 7807

### Requirement: Logout revokes the current session

The system SHALL expose `POST /api/v1/auth/logout` that deletes the presented refresh token from Redis and clears the refresh-token cookie. After logout the same refresh token MUST NOT be usable.

#### Scenario: Logout invalidates the refresh token

- **WHEN** an authenticated client POSTs to `/api/v1/auth/logout`
- **THEN** the response clears the refresh-token cookie
- **AND** a subsequent `/api/v1/auth/refresh` with the old token returns `401`

### Requirement: Refresh token transport uses an httpOnly cookie and access token stays out of cookies

The system SHALL deliver the refresh token only as an `httpOnly`, `Secure`, `SameSite=Lax` cookie and MUST NOT place the access token in a cookie or return the refresh token in any response body.

#### Scenario: Refresh cookie attributes

- **WHEN** any endpoint issues a refresh token
- **THEN** the `Set-Cookie` header marks it `HttpOnly`, `Secure`, and `SameSite=Lax`
- **AND** no response body field contains the refresh-token value

### Requirement: State-changing requests are CSRF-protected

The system SHALL protect cookie-authenticated, state-changing requests with a CSRF defense (double-submit token validated server-side together with `SameSite`). A state-changing request that relies on the refresh cookie but lacks a valid CSRF token MUST be rejected with `403`.

#### Scenario: Missing CSRF token is rejected

- **WHEN** a `POST /api/v1/auth/refresh` is sent with a valid refresh cookie but no matching CSRF token
- **THEN** the response is `403` RFC 7807 and no new tokens are issued

#### Scenario: Matching CSRF token is accepted

- **WHEN** the same request includes a CSRF token that matches the double-submit value
- **THEN** CSRF validation passes and the request proceeds

### Requirement: Registration sends a verification email and the account can be verified

The system SHALL email a verification link on registration whose token resolves to the registering user. `POST /api/v1/auth/verify-email` accepting that token MUST set `emailVerified=true` and consume the token. The link MUST point at a frontend route built from the configured web base URL, never a backend URL.

#### Scenario: Verifying flips the flag

- **WHEN** a user submits the verification token from their email to `/api/v1/auth/verify-email`
- **THEN** the response is `200` and the user's `emailVerified` becomes `true`
- **AND** re-submitting the same token returns `400` (already consumed / invalid)

#### Scenario: Verification link targets the frontend

- **WHEN** the verification email is generated
- **THEN** the link's origin is the configured web base URL and the path is a frontend route carrying the token

### Requirement: Verification email can be resent

The system SHALL expose `POST /api/v1/auth/resend-verification` for an authenticated, not-yet-verified user that issues a fresh verification token and email. Requesting a resend for an already-verified account MUST be a no-op success that sends no email.

#### Scenario: Resend for unverified user sends a new link

- **WHEN** an authenticated unverified user POSTs to `/api/v1/auth/resend-verification`
- **THEN** a new verification email is sent and the previous verification token is invalidated

#### Scenario: Resend for verified user sends nothing

- **WHEN** an already-verified user requests a resend
- **THEN** the response is `200` and no email is sent

### Requirement: Password reset can be requested without revealing account existence

The system SHALL expose `POST /api/v1/auth/forgot-password` accepting an email. It MUST always respond `202` regardless of whether the email maps to an account. When an account exists, it MUST store a signed, 1-hour-TTL reset token in Redis and email a reset link pointing at a frontend route.

#### Scenario: Reset requested for an existing account

- **WHEN** `forgot-password` is called with the email of an existing user
- **THEN** the response is `202`, a 1-hour reset token is stored in Redis, and a reset email with a frontend link is sent

#### Scenario: Reset requested for an unknown email does not enumerate

- **WHEN** `forgot-password` is called with an email that has no account
- **THEN** the response is still `202` and no email is sent
- **AND** the response is indistinguishable from the existing-account case

### Requirement: Reset token can be validated before showing the form

The system SHALL expose `GET /api/v1/auth/reset-password?token=` that returns `200` for a valid, unexpired, unconsumed token and `400` otherwise, so the frontend can decide whether to render the new-password form.

#### Scenario: Valid token validates

- **WHEN** the frontend calls `GET /api/v1/auth/reset-password?token=<valid>`
- **THEN** the response is `200`

#### Scenario: Expired token fails validation

- **WHEN** the same endpoint is called with a token whose 1-hour TTL has elapsed
- **THEN** the response is `400` RFC 7807

### Requirement: Submitting a new password completes the reset and invalidates sessions

The system SHALL expose `POST /api/v1/auth/reset-password` accepting a valid token and a new password. On success it MUST update the bcrypt hash, consume the reset token, and revoke all of the user's outstanding refresh tokens. The new password MUST satisfy the same strength rule as registration.

#### Scenario: Successful reset

- **WHEN** a user POSTs a valid reset token and a strong new password
- **THEN** the response is `200`, the user can log in with the new password, and the old password no longer works
- **AND** the reset token can no longer be reused

#### Scenario: Reset revokes existing sessions

- **WHEN** a user with active refresh tokens completes a password reset
- **THEN** all of that user's previously issued refresh tokens are rejected on subsequent `/auth/refresh`

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

### Requirement: Password change revokes all other sessions

The system SHALL revoke all of a user's outstanding refresh tokens whenever their password changes (via reset or an authenticated change), so a leaked session cannot outlive a credential change.

#### Scenario: Changing the password drops all sessions

- **WHEN** a user's password is changed
- **THEN** every refresh token previously stored for that user is removed from Redis

### Requirement: Auth endpoints are strictly rate-limited

The system SHALL apply a strict per-IP throttle of 10 requests / 15 minutes to `/api/v1/auth/login` and `/api/v1/auth/register`, reusing the Redis-backed throttler. Exceeding the limit MUST return `429` in RFC 7807 form.

#### Scenario: Login throttle trips

- **WHEN** a single IP sends an 11th request to `/api/v1/auth/login` within a 15-minute window
- **THEN** the response is `429` RFC 7807

### Requirement: JWT and web-link configuration are validated at boot

The `apps/api` Zod env schema SHALL include a JWT config group (secret, access-token expiry, refresh-token expiry) and a public web base URL used to build verification and reset links. Boot MUST fail fast naming the offending variable when a required value is missing or malformed.

#### Scenario: Missing JWT secret fails boot

- **WHEN** the env schema parses a config that omits the JWT secret
- **THEN** parsing throws an error whose message names the JWT secret variable

#### Scenario: Malformed web base URL fails boot

- **WHEN** the env schema parses a config whose web base URL is not a valid URL
- **THEN** parsing throws an error naming the web base URL variable
