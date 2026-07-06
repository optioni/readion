## MODIFIED Requirements

### Requirement: User registration creates an unverified account and sends a verification email

The system SHALL expose `POST /api/v1/auth/register` accepting `email` and `password`. Registration MUST be gated by a `SIGNUPS_ENABLED` configuration flag that defaults to `true` (fail-open). When signups are enabled — or when they are disabled but no non-deleted `User` exists yet (bootstrap bypass) — a successful request MUST create a `User` with `emailVerified=false`, send a verification email via `MailService`, issue an access token + rotating refresh token, and return a `201` envelope. Email MUST be validated as an address and password MUST meet a minimum strength rule (at least 8 characters); violations return `422`. When signups are disabled and at least one non-deleted `User` already exists, registration MUST return `403` RFC 7807 Problem Details with `type: /errors/signups-disabled`, MUST NOT create a `User`, and MUST NOT send a verification email.

#### Scenario: Successful registration

- **WHEN** `SIGNUPS_ENABLED` is `true` and a client POSTs `{ "email": "ada@example.com", "password": "correcthorse" }` to `/api/v1/auth/register`
- **THEN** the response is `201` with `data` containing the created user's `id`, `email`, `role`, and `emailVerified: false` (and no password field)
- **AND** an access token is present in the response body and a refresh token is set as an `httpOnly` cookie
- **AND** exactly one verification email is sent to `ada@example.com`

#### Scenario: Weak password is rejected

- **WHEN** a client registers with `password` of fewer than 8 characters
- **THEN** the response is `422` RFC 7807 with an `errors[]` entry for the `password` field
- **AND** no `User` row is created and no email is sent

#### Scenario: Registration is refused when signups are disabled

- **WHEN** `SIGNUPS_ENABLED` is `false`, at least one non-deleted `User` already exists, and a client POSTs valid credentials to `/api/v1/auth/register`
- **THEN** the response is `403` RFC 7807 Problem Details with `type: /errors/signups-disabled`
- **AND** no `User` row is created and no verification email is sent

#### Scenario: Signups default to enabled when the flag is unset

- **WHEN** `SIGNUPS_ENABLED` is not set in the environment and a client POSTs valid credentials to `/api/v1/auth/register`
- **THEN** registration proceeds and the response is `201`

### Requirement: The first registered user becomes an admin

The system SHALL assign `role=admin` to the first user ever registered, and `role=user` to every subsequent registration. The check MUST be based on whether any non-deleted `User` already exists. The first-user registration MUST be permitted even when `SIGNUPS_ENABLED` is `false`, so a fresh instance can always create its bootstrap admin.

#### Scenario: First user is admin

- **WHEN** the user table is empty and a user registers
- **THEN** the created user's `role` is `admin`

#### Scenario: Second user is a regular user

- **WHEN** at least one user already exists and a new user registers
- **THEN** the created user's `role` is `user`

#### Scenario: First user can register even when signups are disabled

- **WHEN** `SIGNUPS_ENABLED` is `false` and no non-deleted `User` exists, and a client POSTs valid credentials to `/api/v1/auth/register`
- **THEN** the response is `201` and the created user's `role` is `admin`
- **AND** a verification email is sent
