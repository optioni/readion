## Purpose

Governs the web onboarding flow that a new authenticated user traverses before reaching the dashboard. Covers the first-run entry gate, certification selection, session-preference defaults, enrollment, and the diagnostic offer/re-prompt lifecycle.
## Requirements
### Requirement: First-run onboarding entry gate

The web app SHALL route an authenticated user to the onboarding flow (`/onboarding`) on first run when they have no active certification enrollment and at least one live certification exists. A user who already has an active enrollment SHALL NOT be able to remain in the onboarding flow.

#### Scenario: New user with available certs enters onboarding

- **WHEN** an authenticated, email-verified user with zero active enrollments loads the app and `GET /certifications` returns at least one certification
- **THEN** the app navigates to `/onboarding` showing the cert-select step
- **THEN** the dashboard is not shown until onboarding completes or is skipped to the dashboard

#### Scenario: Already-enrolled user is redirected away from onboarding

- **WHEN** a user whose `GET /user-certifications?status=active` returns one or more enrollments navigates to `/onboarding`
- **THEN** the app redirects to the dashboard (`/`) without showing the cert-select step

### Requirement: No-certifications routing

When `GET /certifications` returns an empty list, the onboarding flow SHALL NOT present a cert picker. The routing SHALL branch on the user's role obtained from `GET /users/me`.

#### Scenario: First admin with no certs is routed to cert setup

- **WHEN** a user whose `GET /users/me` returns `role: "admin"` reaches onboarding and `GET /certifications` returns an empty list
- **THEN** the app routes to the admin certification-setup flow (the `web-admin` cert-setup route) rather than the cert picker

#### Scenario: Non-admin with no certs sees an empty state

- **WHEN** a user whose `GET /users/me` returns `role: "user"` reaches onboarding and `GET /certifications` returns an empty list
- **THEN** the app shows a "No certifications available yet" empty state
- **THEN** no cert-select picker, prefs form, or diagnostic offer is rendered

### Requirement: Certification selection step

The onboarding cert-select step SHALL list the certifications returned by `GET /certifications` (live certs only, as the API already filters by `state: "live"`), and SHALL let the user select exactly one to continue.

The list SHALL be **grouped by provider/vendor** (matching `openspec/design/Onboarding.html` step 1): certifications are bucketed under an uppercase vendor group header (e.g. "Amazon Web Services", "Google Cloud", "Microsoft Azure"), and each row shows the certification `name` and a `code` badge — the provider is conveyed by the group header rather than repeated inline on each row. Groups render in a stable order, and a group with no rows matching the active search is hidden.

The step SHALL render a certification **search box** above the list with a leading magnifying-glass icon and a right-aligned "N available" count suffix reflecting the total number of loaded certifications. Typing in the search box SHALL filter the already-loaded catalog client-side — no additional request is issued — matching against each certification's name, provider, and code (case-insensitive). When the query matches no certification the list SHALL show an empty result rather than the full catalog; clearing the query SHALL restore the full grouped list.

The step footer SHALL present the Continue action separated from the list by a top-border divider with the design's spacing, right-aligned, labeled "Continue →". Continue SHALL remain disabled until a certification is selected.

#### Scenario: Certs are grouped by vendor

- **WHEN** the cert-select step renders with certifications from `GET /certifications`
- **THEN** certifications are grouped under uppercase vendor/provider headers
- **THEN** each row shows the certification name and a code badge, with the provider shown as the group header (not repeated per row)

#### Scenario: User selects a certification

- **WHEN** the user selects one certification and advances
- **THEN** the chosen `certificationId` is carried into the default-preferences step

#### Scenario: Continue is disabled until a certification is chosen

- **WHEN** no certification is selected
- **THEN** the footer Continue action (labeled "Continue →", separated by a top-border divider) is disabled

#### Scenario: Search filters the catalog client-side across groups

- **WHEN** the user types a query into the cert search box
- **THEN** only certifications whose name, provider, or code matches the query (case-insensitive) remain visible, and groups with no remaining rows are hidden
- **THEN** no additional `GET /certifications` request is issued to perform the filtering
- **WHEN** the user clears the query
- **THEN** the full grouped live-cert list is shown again

#### Scenario: Search box shows a count and icon

- **WHEN** the cert-select step renders
- **THEN** the search box shows a leading magnifying-glass icon and a right-aligned "N available" suffix reflecting the total loaded certification count

### Requirement: Onboarding presents as a standalone flow without the global app chrome

The `/onboarding` route SHALL present as a standalone setup flow that HIDES the global application chrome — specifically the persistent left sidebar of the default app shell. Because the shell's default layout is applied to any page that declares no explicit layout, the onboarding page MUST opt out of that default by assigning a bare/standalone layout via `definePageMeta({ layout })` (the minimal/auth-style layout), so the global navigation sidebar does not wrap the onboarding wizard. The onboarding flow keeps its own internal step rail (the Setup wizard sidebar from `openspec/design/Onboarding.html`); only the global app shell is suppressed.

#### Scenario: Onboarding route does not render the global app sidebar

- **WHEN** an authenticated user in onboarding loads `/onboarding`
- **THEN** the page renders without the default app shell's persistent global navigation sidebar wrapping it
- **THEN** the onboarding wizard (its own setup step rail and content) is shown as a standalone flow

#### Scenario: Onboarding page opts out of the default shell layout

- **WHEN** the onboarding page component is evaluated
- **THEN** it declares an explicit bare/standalone layout via `definePageMeta({ layout })` rather than inheriting the default sidebar shell

### Requirement: Default session preferences step

The onboarding default-preferences step SHALL let the user set the five session-default fields — duration (15/30/60/90), content mix (`balanced`/`reading-heavy`/`quiz-heavy`), difficulty (`beginner`/`intermediate`/`advanced`/`adaptive`), focus area (`auto`/`weak-areas`/`new-material`/`review`), and learning style (`weak-area-focus`/`spaced-repetition`/`scenario-based`) — pre-filled from the current `GET /users/me` `sessionDefaults`, using the shared `sessionDefaultsSchema` enums as the allowed option sets.

#### Scenario: Preferences pre-filled from current profile defaults

- **WHEN** the preferences step renders and `GET /users/me` returns `sessionDefaults` (e.g. the `DEFAULT_SESSION_DEFAULTS`: duration 30, balanced, intermediate, auto, weak-area-focus)
- **THEN** each control is pre-selected to the corresponding current default value

#### Scenario: User adjusts defaults and continues

- **WHEN** the user changes duration to 60 and learning style to `spaced-repetition` and confirms
- **THEN** the chosen values are persisted to the user profile via `PATCH /users/me` with a `sessionDefaults` body carrying the chosen values for all five session-default fields
- **THEN** the same chosen `sessionDefaults` object is used as the `sessionDefaults` body for enrollment in the next step

### Requirement: Enrollment on completing preferences

Completing the preferences step SHALL enroll the user in the selected certification via `POST /user-certifications` with `{ certificationId, sessionDefaults }`, creating the `UserCertification`, and SHALL proceed to the diagnostic-offer step using the returned enrollment `id`.

#### Scenario: Enrollment creates the UserCertification

- **WHEN** the user confirms the preferences step with certification `C` selected
- **THEN** the app calls `POST /user-certifications` with `certificationId: C` and the chosen `sessionDefaults`
- **THEN** on a 201 response the returned enrollment `id` is used to fetch the diagnostic offer

#### Scenario: Enrollment error keeps the user in the flow

- **WHEN** `POST /user-certifications` returns an error (e.g. 422)
- **THEN** the app surfaces an error message and keeps the user on the preferences step without navigating to the diagnostic offer

### Requirement: Diagnostic offer step

After enrollment the onboarding flow SHALL read `GET /user-certifications/:id/diagnostic-offer`. When `offer === "onboarding"` it SHALL present an optional diagnostic exam card with the "Take a 2-minute diagnostic to personalize your first session" framing and a clear Skip. When `offer` is `"none"` it SHALL proceed directly to the dashboard.

#### Scenario: Offer presented for a fresh live enrollment

- **WHEN** `GET /user-certifications/:id/diagnostic-offer` returns `{ offer: "onboarding" }`
- **THEN** the diagnostic offer card is shown with a "Take" action and a "Skip" action

#### Scenario: Take the diagnostic

- **WHEN** the user chooses "Take" on the offer card
- **THEN** the app calls `POST /user-certifications/:id/diagnostic` to create the diagnostic attempt
- **THEN** on success the app navigates into the mock-exam runner for the returned diagnostic attempt (`type: "diagnostic"`)

#### Scenario: Skip the diagnostic

- **WHEN** the user chooses "Skip" on the offer card
- **THEN** the app calls `POST /user-certifications/:id/diagnostic-offer/dismiss`
- **THEN** the app navigates to the dashboard (`/`)

#### Scenario: No offer proceeds to dashboard

- **WHEN** `GET /user-certifications/:id/diagnostic-offer` returns `{ offer: "none" }`
- **THEN** the app navigates to the dashboard without rendering the diagnostic card

### Requirement: Diagnostic re-prompt nudge

A dismissible diagnostic re-prompt nudge SHALL be shown on the dashboard for an enrollment whose `GET /user-certifications/:id/diagnostic-offer` returns `{ offer: "re-prompt" }` (uncalibrated after the first session). The nudge SHALL reuse the same Take and Skip actions as the onboarding offer.

#### Scenario: Re-prompt shown for an uncalibrated enrollment

- **WHEN** the dashboard loads and an active enrollment's diagnostic offer is `{ offer: "re-prompt" }`
- **THEN** a re-prompt nudge is rendered for that enrollment with Take and Skip actions

#### Scenario: Re-prompt Skip dismisses without re-showing

- **WHEN** the user chooses Skip on the re-prompt nudge
- **THEN** the app calls `POST /user-certifications/:id/diagnostic-offer/dismiss`
- **THEN** after the call the offer for that enrollment becomes `{ offer: "none" }` and the nudge is not shown again

#### Scenario: Re-prompt Take starts the diagnostic

- **WHEN** the user chooses Take on the re-prompt nudge
- **THEN** the app calls `POST /user-certifications/:id/diagnostic` and navigates into the mock-exam runner for the returned diagnostic attempt

