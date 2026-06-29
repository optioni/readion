## ADDED Requirements

### Requirement: Settings page shell with three tabs

The web app SHALL provide an authenticated `/settings` page rendered inside the app shell with the sidebar showing `Settings` as the active item, and a tab bar with exactly three tabs in order: `Account`, `Study defaults`, `Notifications`. The page SHALL require authentication and follow the same route-guard behavior as other authenticated pages.

#### Scenario: Authenticated user opens settings

- **WHEN** an authenticated user navigates to `/settings`
- **THEN** the app sidebar renders with `Settings` marked active
- **THEN** a tab bar shows `Account`, `Study defaults`, and `Notifications`, with `Account` selected by default

#### Scenario: Switching tabs

- **WHEN** the user clicks the `Study defaults` tab and then the `Notifications` tab
- **THEN** the `Study defaults` panel renders, then the `Notifications` panel renders
- **THEN** the previously selected tab is no longer marked active

#### Scenario: Unauthenticated visitor is redirected

- **WHEN** an unauthenticated visitor requests `/settings`
- **THEN** they are redirected to the login route by the auth route middleware

### Requirement: Account tab shows read-only profile identity

The Account tab SHALL load the signed-in user's profile via `GET /api/v1/users/me`, narrowing the response envelope with the `@readion/shared` `userProfileResponseSchema`. It SHALL display the user's email as read-only (email is not editable through the profile contract) and a derived initials avatar. It SHALL NOT render a "Full name" field, because the `User` entity has no name attribute.

#### Scenario: Profile loads and renders email read-only

- **WHEN** `GET /api/v1/users/me` returns `{ data: { id, email: "jamie@org.io", role, emailVerified: true, displayTimezone, sessionDefaults } }`
- **THEN** the Account tab shows `jamie@org.io` in a read-only (non-editable) email field
- **THEN** a derived initials avatar is shown and no "Full name" input is present

### Requirement: Account tab edits and saves the display timezone

The Account tab SHALL render an editable display-timezone control seeded from the loaded profile's `displayTimezone`, restricted to valid IANA timezones. Saving SHALL call `PATCH /api/v1/users/me` with body `{ displayTimezone }` only, and on success SHALL reflect the saved value and invalidate the cached profile query.

#### Scenario: User changes timezone and saves

- **WHEN** the loaded profile has `displayTimezone: "Europe/Helsinki"` and the user selects `America/New_York` and clicks Save
- **THEN** `PATCH /api/v1/users/me` is called with body `{ "displayTimezone": "America/New_York" }`
- **THEN** on a `200` response the control shows `America/New_York` and the profile query is invalidated

#### Scenario: Save surfaces a validation error

- **WHEN** the save request returns a `422` problem-details response
- **THEN** an error message is shown and the control remains editable

### Requirement: Account tab triggers password reset by email

Because no dedicated change-password endpoint exists, the Account tab's password control SHALL trigger a password reset for the signed-in user by calling `POST /api/v1/auth/forgot-password` with the user's email, and SHALL show a confirmation that a reset link has been emailed. It SHALL NOT collect or submit current/new password fields against any change-password endpoint.

#### Scenario: User requests a password reset link

- **WHEN** the signed-in user (email `jamie@org.io`) activates the "Change password" / "Email me a reset link" action
- **THEN** `POST /api/v1/auth/forgot-password` is called with body `{ "email": "jamie@org.io" }`
- **THEN** a confirmation message states that a secure reset link has been emailed

### Requirement: Account tab deletes the account with password re-confirmation

The Account tab's danger zone SHALL provide a "Delete account" action that opens a confirmation modal requiring the user's current password. Confirming SHALL call `DELETE /api/v1/users/me` with body `{ password }`. On a `204` response the app SHALL clear the auth store and redirect to login (the server has revoked all refresh tokens). A failed password (`401`) or a blocked last-admin deletion SHALL keep the user on the page and surface the error.

#### Scenario: Successful deletion logs out and redirects

- **WHEN** the user opens the delete-account modal, enters their correct password, and confirms
- **THEN** `DELETE /api/v1/users/me` is called with body `{ "password": "<entered>" }`
- **THEN** on a `204` response the auth store is cleared and the user is redirected to the login route

#### Scenario: Wrong password blocks deletion

- **WHEN** the user confirms deletion with an incorrect password and the API returns `401`
- **THEN** the modal stays open, an "invalid password" error is shown, and the auth store is unchanged

#### Scenario: Deletion requires password confirmation

- **WHEN** the user opens the delete-account modal without entering a password
- **THEN** the confirm action is disabled or rejected and no `DELETE /api/v1/users/me` request is sent

### Requirement: Study defaults tab edits all five session defaults

The Study defaults tab SHALL let the user view and edit all five session-default preferences — `duration`, `contentMix`, `difficulty`, `focusArea`, and `learningStyle` — using discrete controls bound to the exact `@readion/shared` enums (`sessionDefaultDurations`, `sessionDefaultContentMixes`, `sessionDefaultDifficulties`, `sessionDefaultFocusAreas`, `sessionDefaultLearningStyles`), seeded from the loaded profile. Saving SHALL call `PATCH /api/v1/users/me` with body `{ sessionDefaults }` and validate the payload against `sessionDefaultsSchema`.

#### Scenario: All five defaults render from the profile

- **WHEN** the profile loads with `sessionDefaults: { duration: 30, contentMix: "balanced", difficulty: "intermediate", focusArea: "auto", learningStyle: "weak-area-focus" }`
- **THEN** the tab renders selectable controls for duration (`15/30/60/90`), content mix, difficulty, focus area, and learning style with the loaded values selected

#### Scenario: User updates defaults and saves

- **WHEN** the user changes `duration` to `60` and `learningStyle` to `spaced-repetition` and clicks Save defaults
- **THEN** `PATCH /api/v1/users/me` is called with a `sessionDefaults` object whose `duration` is `60` and `learningStyle` is `spaced-repetition`
- **THEN** on a `200` response the profile query is invalidated and the saved selections persist

### Requirement: Notifications tab digest preference

The `web-settings` Notifications tab SHALL render the weekly-digest preference as a real two-way switch bound to the profile contract: seeded from `GET /users/me`'s `digestOptOut`, and toggling it issues `PATCH /users/me { digestOptOut }` and reflects the new state. This replaces the prior informational-only treatment that issued no request. The tab MAY still mention the one-click unsubscribe link in the digest email.

#### Scenario: Toggle digest from Settings

- **WHEN** the user flips the weekly-digest switch in the Notifications tab
- **THEN** a `PATCH /users/me { digestOptOut }` is sent with the new value and the switch reflects the persisted state after the response
