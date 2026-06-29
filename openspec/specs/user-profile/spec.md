# Spec: User Profile

## Purpose

Defines the user profile surface: the additional fields carried on the `User` entity (timezone, session defaults, soft-delete marker), and the authenticated endpoints for reading and updating those fields.

## Requirements

### Requirement: User entity carries profile fields

The system SHALL extend the `auth`-owned `User` entity (no new entity; `users` owns a migration only) with a `displayTimezone` (IANA zone string, default `Europe/Helsinki`), session-default-preference columns covering the five Session Personalization parameters, and a nullable soft-delete marker. All timestamps MUST continue to be stored in UTC; `displayTimezone` is presentation metadata only.

#### Scenario: New user gets default timezone and preferences

- **WHEN** a `User` row is created by registration (via the `auth` module)
- **THEN** its `displayTimezone` defaults to `Europe/Helsinki`
- **AND** its session default preferences default to a defined neutral set: duration `30`, content mix `balanced`, difficulty `intermediate`, focus area `auto`, learning style `weak-area-focus`

#### Scenario: Migration extends the users table without a new entity

- **WHEN** the `users` change migration runs against a database that already has the `auth` `users` table
- **THEN** the `users` table gains `display_timezone`, the session-default-preference columns, and `deleted_at`
- **AND** no new table is created by this change

### Requirement: Authenticated user can read their own profile

The system SHALL expose `GET /api/v1/users/me`, protected by the global `JwtAuthGuard`, returning the authenticated principal's profile in the single-resource envelope `{ data }`. The response MUST include `id`, `email`, `role`, `emailVerified`, `displayTimezone`, `sessionDefaults` (the five preferences), and `digestOptOut` (the weekly-digest preference), so an authenticated client can read the current weekly-digest preference. It MUST NEVER include the password hash.

#### Scenario: Authenticated read returns own profile

- **WHEN** a request with a valid access token for user `ada@example.com` GETs `/api/v1/users/me`
- **THEN** the response is `200` with `data` containing `id`, `email: "ada@example.com"`, `role`, `emailVerified`, `displayTimezone`, and `sessionDefaults`
- **AND** the payload contains no `passwordHash` field

#### Scenario: Profile read includes digest preference

- **WHEN** an authenticated user GETs `/api/v1/users/me`
- **THEN** the `data` envelope includes `digestOptOut` reflecting the persisted `User.digestOptOut` value

#### Scenario: Unauthenticated read is rejected

- **WHEN** a request with no access token GETs `/api/v1/users/me`
- **THEN** the response is `401` as an RFC 7807 Problem Details body

### Requirement: Authenticated user can update timezone and session defaults

The system SHALL expose `PATCH /api/v1/users/me`, protected by the global `JwtAuthGuard`, accepting a partial body of `displayTimezone`, `sessionDefaults`, and/or `digestOptOut` fields. The `digestOptOut` field (boolean) is a two-way toggle persisted to `User.digestOptOut`: setting it `true` opts the user out of the weekly digest; setting it `false` opts them back in. `email`, `role`, `emailVerified`, and `passwordHash` MUST NOT be mutable through this endpoint and SHALL be ignored or rejected. On success it returns `200` with the updated profile in `{ data }`.

#### Scenario: Update display timezone

- **WHEN** an authenticated user PATCHes `/api/v1/users/me` with `{ "displayTimezone": "America/New_York" }`
- **THEN** the response is `200` and `data.displayTimezone` is `"America/New_York"`
- **AND** the persisted user row reflects the new timezone

#### Scenario: Invalid timezone is rejected

- **WHEN** an authenticated user PATCHes `/api/v1/users/me` with `{ "displayTimezone": "Mars/Olympus" }`
- **THEN** the response is `422` as RFC 7807 Problem Details indicating an invalid IANA timezone
- **AND** the user row is unchanged

#### Scenario: Update a session default preference

- **WHEN** an authenticated user PATCHes `/api/v1/users/me` with `{ "sessionDefaults": { "duration": 60, "learningStyle": "spaced-repetition" } }`
- **THEN** the response is `200` and `data.sessionDefaults.duration` is `60` and `data.sessionDefaults.learningStyle` is `"spaced-repetition"`
- **AND** unspecified session-default fields retain their prior values

#### Scenario: Out-of-set preference value is rejected

- **WHEN** an authenticated user PATCHes `/api/v1/users/me` with `{ "sessionDefaults": { "duration": 45 } }`
- **THEN** the response is `422` as RFC 7807 Problem Details (allowed durations are `15`, `30`, `60`, `90`)
- **AND** the user row is unchanged

#### Scenario: Immutable fields are not changed

- **WHEN** an authenticated user PATCHes `/api/v1/users/me` with `{ "email": "new@example.com", "role": "admin" }`
- **THEN** the user's `email` and `role` are unchanged

#### Scenario: Opt out via authenticated profile update

- **WHEN** an authenticated user PATCHes `{ "digestOptOut": true }`
- **THEN** the response reflects `digestOptOut: true`
- **AND** the persisted `User.digestOptOut` is `true`, so the weekly-digest cron skips this user

#### Scenario: Opt back in via authenticated profile update

- **WHEN** a user who previously opted out (including via the email unsubscribe link) PATCHes `{ "digestOptOut": false }`
- **THEN** the persisted `User.digestOptOut` becomes `false` and the user is eligible for the digest again

#### Scenario: Invalid type is rejected

- **WHEN** `digestOptOut` is sent as a non-boolean
- **THEN** the response is `422` RFC 7807 with an `errors[]` entry for `digestOptOut` and the stored value is unchanged
