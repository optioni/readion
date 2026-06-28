## ADDED Requirements

### Requirement: Cert-detail page is reached from the dashboard and shows the certification header with tabs

The web app SHALL provide an authenticated cert-detail page at `/user-certifications/:id` reached from each dashboard certification card. The page MUST load the enrollment via `GET /api/v1/user-certifications/:id` and resolve the certification name and provider via `GET /api/v1/certifications/:certificationId` (the enrollment row carries `certificationId` only), and MUST present a tabbed layout with **Overview**, **Sessions**, and **Exam History** tabs, defaulting to Overview.

#### Scenario: Navigating from a dashboard card opens the cert detail

- **WHEN** an authenticated user activates a certification card on the dashboard
- **THEN** the app navigates to `/user-certifications/:id` for that enrollment
- **AND** the page shows the certification name and provider with Overview, Sessions, and Exam History tabs, Overview active

#### Scenario: Unknown or unowned enrollment

- **WHEN** the user opens `/user-certifications/:id` for an enrollment they do not own
- **THEN** the page shows a not-found state rather than another user's data (the API returns 404 for cross-user access)

### Requirement: Overview tab shows a readiness and trajectory stat row

The Overview tab SHALL render a stat row sourced from `GET /api/v1/user-certifications/:id/readiness`, `GET /api/v1/sessions?certificationId=&limit=…` (total count), and `GET /api/v1/user-certifications/:id/review` (due count). When readiness is calibrated (`calibrated: true`) the row MUST show the score as a percentage; when not calibrated (`calibrated: false`, equivalently `readinessScore` is `null`) it MUST show "not yet calibrated" instead of a number. When `trajectory` is present the row MUST show an informational "exam-ready in ~N weeks" line derived from `trajectory.weeksToReady`, with no dates or reminders. No per-cert exam-date countdown is shown (no such field exists in the backend contract).

#### Scenario: Calibrated readiness with trajectory

- **WHEN** the enrollment's readiness is calibrated at 72% with `trajectory.weeksToReady` of 3
- **THEN** the stat row shows "72%" and an informational "exam-ready in ~3 weeks" line

#### Scenario: Uncalibrated readiness

- **WHEN** the enrollment's readiness is not yet calibrated
- **THEN** the stat row shows "not yet calibrated" and no readiness percentage

### Requirement: Overview tab shows the full per-domain score breakdown

The Overview tab SHALL show one row per certification domain (from `GET /api/v1/certifications/:id` `domains`), joining each domain's score from `GET /api/v1/user-certifications/:id/weak-areas` and colouring the score on the status scale (below 50% poor, 50–65% warning, 65–80% medium, above 80% good). A certification domain with no weak-area record yet MUST render a neutral "no data yet" placeholder instead of a score.

#### Scenario: Domains with data are status-coloured

- **WHEN** the certification has domains Security, Billing, and Networking and the weak-areas report Security 48%, Billing 70%
- **THEN** Security is shown at 48% in the poor colour and Billing at 70% in the medium colour
- **AND** Networking, which has no weak-area record, shows a "no data yet" placeholder

### Requirement: Overview tab shows a suggested next focus

The Overview tab SHALL show a suggested next focus derived from the most recent completed session's `GET /api/v1/sessions/:id/summary` (`nextFocus.domain`), falling back to the lowest-scoring weak-area domain when no completed-session summary is available. The suggestion is informational and MUST NOT present a deadline or scheduled date. When there is neither a completed session summary nor any weak-area data, the panel MUST show a neutral placeholder.

#### Scenario: Next focus comes from the last session summary

- **WHEN** the most recent completed session's summary reports `nextFocus.domain` of "Networking"
- **THEN** the suggested-next-focus panel highlights "Networking"

#### Scenario: Next focus falls back to the weakest domain

- **WHEN** no completed-session summary is available but the weakest domain is "Billing" at 41%
- **THEN** the suggested-next-focus panel highlights "Billing"

### Requirement: Overview tab shows recent sessions with accuracy

The Overview tab SHALL show up to the last three sessions for the certification from `GET /api/v1/sessions?certificationId=<certificationId>&limit=3`, each completed session joined with its `GET /api/v1/sessions/:id/summary` to show a domain label and accuracy; a session without an available summary MUST fall back to a date and focus-area label without an accuracy figure. When the enrollment has no sessions yet, the panel MUST show a "no sessions yet" placeholder.

#### Scenario: Recent completed sessions show accuracy

- **WHEN** the three most recent completed sessions report accuracies of 80%, 64%, and 73%
- **THEN** the recent-sessions panel lists three rows, each with a domain label and its accuracy

#### Scenario: No sessions shows a placeholder

- **WHEN** the enrollment has no sessions
- **THEN** the recent-sessions panel shows a "no sessions yet" placeholder

### Requirement: Sessions tab shows the full per-cert session history with a type filter

The Sessions tab SHALL render a paginated table of all sessions for the certification from `GET /api/v1/sessions?certificationId=<certificationId>&page=&limit=`, each row showing the session date, kind (study/review), focus area, duration, and status, with accuracy obtained from `GET /api/v1/sessions/:id/summary` for completed rows on the visible page (rows without a summary show no accuracy figure). The tab MUST provide an All / Study / Review type filter applied **client-side** over each row's `kind` field (the sessions list endpoint exposes no kind/type query parameter). Each row MUST link to its session view. When there are no sessions, the tab MUST show an empty state.

#### Scenario: Full history table lists all sessions

- **WHEN** the certification has eight sessions across two pages
- **THEN** the Sessions tab shows a paginated table with the first page of session rows, each with date, kind, focus area, duration, status, and (for completed rows) accuracy

#### Scenario: Type filter narrows by kind

- **WHEN** the loaded rows include both `study` and `review` sessions and the user selects the "Review" filter
- **THEN** only `review` sessions remain visible
- **AND** selecting "All" restores both kinds

#### Scenario: No sessions shows an empty state

- **WHEN** the certification has no sessions
- **THEN** the Sessions tab shows an empty state instead of a table

### Requirement: Exam History view lists mock and diagnostic attempts

The Exam History tab SHALL list the enrollment's mock and diagnostic attempts from `GET /api/v1/user-certifications/:id/mock-exams`, each row showing the attempt date, type (mock/diagnostic), status (in_progress/submitted/expired), score, and pass/fail, and linking submitted attempts into the mock-exam review route. When there are no attempts, the tab MUST show an empty state.

#### Scenario: Submitted attempts show score and pass/fail

- **WHEN** the enrollment has a submitted mock exam with score 78 and `passed: true`
- **THEN** the Exam History tab shows a row for it with type "mock", status "submitted", score 78, and a passed indicator
- **AND** the row links into the mock-exam review route

#### Scenario: No attempts shows an empty state

- **WHEN** the enrollment has no mock or diagnostic attempts
- **THEN** the Exam History tab shows an empty state instead of a list
