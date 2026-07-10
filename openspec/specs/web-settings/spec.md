## Purpose

Defines the web Settings surface: a three-tab shell (Account, Study defaults, Notifications) exposing read-only profile identity, display-timezone editing, password management, account deletion with password re-confirmation, the five session defaults, and the notification/digest preference.
## Requirements
### Requirement: Settings page shell with three tabs

The web app SHALL provide an authenticated `/settings` page rendered inside the app shell with the sidebar showing `Settings` as the active item, and a tab bar with exactly three tabs in order: `Account`, `Study defaults`, `Notifications`. The page SHALL require authentication and follow the same route-guard behavior as other authenticated pages.

The settings content SHALL be presented in a contained, max-width reading column (matching `openspec/design/Settings.html`) rather than floating in the full page width. The column SHALL be **left-aligned against the sidebar** at the content area's leading edge — it MUST NOT be horizontally centered (no `mx-auto`-style centering) that would leave a large empty left gutter. Within every tab, the primary form actions — Save changes / Save defaults / Save preferences, Update password, and the Delete-account button — SHALL be **right-aligned** at the trailing edge of the content column (not left-aligned), so each section's action sits at the end of its form.

Field labels within the settings tabs SHALL use the horizontal **FieldRow** pattern from the design: a sentence-case label placed in a fixed-width column beside its field (label left, control right), rather than an uppercase `font-mono` label stacked above a full-width input. Label text colour SHALL resolve to a Readion text token (secondary/muted) rather than a raw `text-slate-400` utility value. The active tab SHALL render its underline in the **indigo accent token** (`--readion-accent-label`), and inactive tabs SHALL render no accent underline.

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

#### Scenario: Content column is left-aligned against the sidebar

- **WHEN** any settings tab renders its content column
- **THEN** the contained max-width column's left edge sits at the content area's leading padding, immediately right of the sidebar
- **THEN** the column is not horizontally centered and no large empty left gutter is present

#### Scenario: Fields use the horizontal FieldRow label pattern with a tokenized label

- **WHEN** a settings field (e.g. the Account tab's Email field) renders
- **THEN** its label is sentence-case and laid out in a fixed-width column beside the control (horizontal FieldRow), not an uppercase `font-mono` label stacked above the input
- **THEN** the label colour resolves to a Readion text token, not a raw `text-slate-400` value

#### Scenario: Active tab underline uses the indigo accent

- **WHEN** the tab bar renders with a tab selected
- **THEN** the active tab's underline uses the indigo accent token (`--readion-accent-label`)
- **THEN** the inactive tabs render no accent underline

#### Scenario: Tab actions are right-aligned in the contained column

- **WHEN** any settings tab renders its primary action (e.g. the Account tab's Save and Update-password buttons, or the danger-zone Delete-account button)
- **THEN** the action sits at the trailing (right) edge of the contained max-width content column
- **THEN** the action is not left-aligned against the column's leading edge

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

### Requirement: Account tab password management

The `web-settings` Account tab SHALL let an authenticated user change their password in-session using `POST /api/v1/auth/change-password` (current / new / confirm fields), replacing the prior stopgap that triggered the forgot-password email flow. The primary action for this section SHALL be labelled **"Update password"** (matching `openspec/design/Settings.html`), not "Change password". Validation errors (`422` weak password, `401`/`403` wrong current password) surface inline and keep the form editable; on success the form clears and a confirmation is shown.

#### Scenario: Password action reads "Update password"

- **WHEN** the Account tab renders its password section
- **THEN** the submit action for the password fields is labelled "Update password"

#### Scenario: In-session password change from Settings

- **WHEN** the user fills current + new + matching confirm and submits, and the backend returns success
- **THEN** the form clears, a success confirmation is shown, and no forgot-password email is sent

#### Scenario: Wrong current password surfaces inline

- **WHEN** the backend returns `401`/`403` because the current password is wrong
- **THEN** an inline error is shown on the current-password field and the form stays editable with entered values preserved (except passwords)

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

The Study defaults tab SHALL let the user edit **all five** session defaults — duration, content mix, difficulty, focus area, and learning style — pre-filled from `GET /users/me` `sessionDefaults` and persisted via `PATCH /users/me`, using the shared `sessionDefaultsSchema` enums as the authoritative allowed value sets. The focus-area field SHALL remain present (the artboard omitting it does not reduce the contract).

Option controls SHALL render **human-readable labels** via a value→label map (matching `openspec/design/Settings.html`) — the raw enum slugs (e.g. `beginner`, `reading-heavy`, `weak-area-focus`) MUST NOT be shown as button text. The mapping is presentational only: the value persisted to the profile remains the enum slug, and the full enum value set for each field is preserved (no options are dropped or renamed at the value level).

The **duration** field SHALL render as a slider (filled track, draggable thumb, live "N min" readout) that snaps to the real `sessionDefaultDurations` options `[15, 30, 60, 90]` — not free values and not the artboard's illustrative 5/15/30/45/60 ticks. The remaining fields SHALL render as fully-rounded pill chips with a solid-primary selected state.

Fields SHALL use the two-column **FieldRow** layout (a fixed-width label column with an optional hint on the left, the control on the right). The tab SHALL show a "Session preferences" section title and the intro copy explaining these are adaptive starting defaults ("These are your default starting values for each new session. Readion adjusts them over time based on your performance."), and the duration field SHALL show a "Default duration per session" hint.

#### Scenario: Options render human-readable labels, not raw slugs

- **WHEN** the Study defaults tab renders the difficulty, content-mix, and learning-style controls
- **THEN** each option shows a human-readable label (via the value→label map), never the raw enum slug
- **AND** the value persisted on change is still the enum slug, and every enum option remains selectable

#### Scenario: Duration renders as a slider over the real options

- **WHEN** the Session length field renders
- **THEN** it is a slider with a live "N min" readout that snaps to one of `[15, 30, 60, 90]`

#### Scenario: All five defaults are editable including focus area

- **WHEN** the Study defaults tab renders
- **THEN** duration, content mix, difficulty, focus area, and learning style are all present and editable

#### Scenario: Section framing and hint render

- **WHEN** the tab renders
- **THEN** a "Session preferences" section title and the adaptive-defaults intro copy are shown, and the duration field shows its "Default duration per session" hint

### Requirement: Notifications tab digest preference

The `web-settings` Notifications tab SHALL render the weekly-digest preference as a real two-way switch bound to the profile contract: seeded from `GET /users/me`'s `digestOptOut`, and toggling it issues `PATCH /users/me { digestOptOut }` and reflects the new state. This replaces the prior informational-only treatment that issued no request. The tab MAY still mention the one-click unsubscribe link in the digest email.

#### Scenario: Toggle digest from Settings

- **WHEN** the user flips the weekly-digest switch in the Notifications tab
- **THEN** a `PATCH /users/me { digestOptOut }` is sent with the new value and the switch reflects the persisted state after the response

