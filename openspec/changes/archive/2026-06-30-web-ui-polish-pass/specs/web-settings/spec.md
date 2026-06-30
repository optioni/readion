## MODIFIED Requirements

### Requirement: Settings page shell with three tabs

The web app SHALL provide an authenticated `/settings` page rendered inside the app shell with the sidebar showing `Settings` as the active item, and a tab bar with exactly three tabs in order: `Account`, `Study defaults`, `Notifications`. The page SHALL require authentication and follow the same route-guard behavior as other authenticated pages.

The settings content SHALL be presented in a contained, max-width reading column (matching `openspec/design/Settings.html`) rather than floating in the full page width, with section whitespace tightened to the design. Within every tab, the primary form actions — Save changes / Save defaults / Save preferences, Update password, and the Delete-account button — SHALL be **right-aligned** at the trailing edge of the content column (not left-aligned), so each section's action sits at the end of its form.

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

#### Scenario: Tab actions are right-aligned in the contained column

- **WHEN** any settings tab renders its primary action (e.g. the Account tab's Save and Update-password buttons, or the danger-zone Delete-account button)
- **THEN** the action sits at the trailing (right) edge of the contained max-width content column
- **THEN** the action is not left-aligned against the column's leading edge
