## MODIFIED Requirements

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
