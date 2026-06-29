## MODIFIED Requirements

### Requirement: Authenticated user can read their own profile

The `GET /api/v1/users/me` response SHALL include the user's `digestOptOut` boolean alongside the existing profile fields, so an authenticated client can read the current weekly-digest preference.

#### Scenario: Profile read includes digest preference

- **WHEN** an authenticated user GETs `/api/v1/users/me`
- **THEN** the `data` envelope includes `digestOptOut` reflecting the persisted `User.digestOptOut` value

### Requirement: Authenticated user can update timezone and session defaults

`PATCH /api/v1/users/me` SHALL additionally accept `digestOptOut` (boolean) as a two-way toggle, persisting it to `User.digestOptOut`. Setting it `true` opts the user out of the weekly digest; setting it `false` opts them back in. Other profile-update behavior is unchanged.

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
