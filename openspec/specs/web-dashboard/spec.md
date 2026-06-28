# Web Dashboard Spec

## Purpose

Defines the authenticated home dashboard that surfaces a user's active certification enrollments, exposes per-certification health signals (readiness score, weak areas, recent sessions, due reviews), and provides quick-start entry points for study sessions, mock exams, and spaced-repetition review runs. The dashboard is the primary navigation hub after sign-in.

## Requirements

### Requirement: Dashboard renders enrolled certifications as a vertical list

The web app SHALL provide an authenticated dashboard at the app home that fetches the user's active enrollments via `GET /api/v1/user-certifications?status=active` and renders one card per enrollment in a single vertical list. Each card MUST display the certification name and provider, resolved from `GET /api/v1/certifications` by the enrollment's `certificationId` (the enrollment row carries `certificationId` only). When the user has no active enrollments, the dashboard MUST render an empty state with an add-certification entry instead of an empty list.

#### Scenario: Enrolled certifications appear as cards

- **WHEN** an authenticated user with two active enrollments opens the dashboard
- **THEN** two certification cards are rendered, each showing its certification name and provider
- **AND** an "+ Add certification" entry is shown at the bottom of the list

#### Scenario: No enrollments shows an empty state

- **WHEN** an authenticated user with zero active enrollments opens the dashboard
- **THEN** an empty state is shown with an add-certification call to action
- **AND** no certification card is rendered

### Requirement: Lowest-readiness cert gets the hero treatment and the list is sorted by readiness

The dashboard SHALL promote the calibrated enrollment with the lowest readiness score to a gradient hero card at the top of the list, render the remaining cards in the muted surface style, and sort all cards by readiness score ascending. Enrollments whose readiness is not yet calibrated MUST be ordered after calibrated ones and MUST NOT be selected as the hero on score. When no enrollment is calibrated, the most recently enrolled certification SHALL take the hero slot. Sorting and hero selection MUST be derived from the `readinessScore` already present on each enrollment row, without a per-cert readiness request solely to order the list.

#### Scenario: Lowest-readiness cert is the hero

- **WHEN** the user has calibrated enrollments with readiness 75%, 42%, and 88%
- **THEN** the 42% certification is rendered as the gradient hero card at the top
- **AND** the remaining cards follow in ascending readiness order (75% then 88%) in the standard surface style

#### Scenario: Uncalibrated certs sort after calibrated ones

- **WHEN** the user has one calibrated enrollment (60%) and one not-yet-calibrated enrollment
- **THEN** the calibrated cert is the hero and the uncalibrated cert is rendered below it

#### Scenario: No calibrated cert falls back to most recently enrolled hero

- **WHEN** every enrollment is not yet calibrated
- **THEN** the most recently enrolled certification is rendered in the hero slot

### Requirement: Each card shows readiness with calibration state and delta

Each certification card SHALL display its exam readiness. When `GET /api/v1/user-certifications/:id/readiness` returns `calibrated: true`, the card MUST show the score as a percentage and, when a prior completed session exists, the change since the last session derived from that session's `GET /api/v1/sessions/:id/summary` (`readiness.delta`). When `calibrated` is `false` (equivalently `readinessScore` is `null`), the card MUST show "not yet calibrated" instead of a percentage and MUST NOT show a delta. No per-cert exam-date countdown is shown (no such field exists in the backend contract).

#### Scenario: Calibrated readiness shows percentage and delta

- **WHEN** an enrollment's readiness is calibrated at 75% and its last completed session's summary reports a readiness delta of +3
- **THEN** the card shows "75%" and a "+3% since last session" indicator

#### Scenario: Uncalibrated readiness shows the calibration message

- **WHEN** an enrollment's readiness is not yet calibrated
- **THEN** the card shows "not yet calibrated" and no readiness percentage or delta

### Requirement: Each card shows top weak areas with status-coloured scores

Each certification card SHALL show up to the top three weak-area domains from `GET /api/v1/user-certifications/:id/weak-areas`, each with its score coloured on the status scale (below 50% poor, 50–65% warning, 65–80% medium, above 80% good). When no weak-area data exists yet for the enrollment, the card MUST show a neutral "no data yet" placeholder rather than an empty panel.

#### Scenario: Top three weak areas are shown with status colours

- **WHEN** an enrollment has weak areas Billing 48%, Security 61%, Networking 70%, and Storage 75%
- **THEN** the card shows Billing, Security, and Networking (the lowest three)
- **AND** 48% is rendered in the poor colour, 61% in the warning colour, and 70% in the medium colour

#### Scenario: No weak-area data shows a placeholder

- **WHEN** an enrollment has no weak-area records yet
- **THEN** the weak-areas panel shows a "no data yet" placeholder

### Requirement: Each card shows recent sessions with domain and accuracy

Each certification card SHALL show up to the last three sessions for the certification from `GET /api/v1/sessions?certificationId=<certificationId>&limit=3` (filtered by the enrollment's underlying certification id). For each completed session the card MUST show a domain label and the session accuracy obtained from `GET /api/v1/sessions/:id/summary`; a session without an available summary MUST fall back to a date and focus-area label without an accuracy figure. When the enrollment has no sessions yet, the card MUST show a "no sessions yet" placeholder.

#### Scenario: Recent completed sessions show domain and accuracy

- **WHEN** an enrollment's three most recent completed sessions report accuracies of 82%, 55%, and 71%
- **THEN** the recent-sessions panel lists three rows, each with a domain label and its accuracy

#### Scenario: No sessions shows a placeholder

- **WHEN** an enrollment has no sessions
- **THEN** the recent-sessions panel shows a "no sessions yet" placeholder

### Requirement: Due-review quick-start appears only when reviews are due

Each certification card SHALL request the due-review count via `GET /api/v1/user-certifications/:id/review` and, only when `meta.dueCount` is greater than zero, render a "5-minute review" quick-start showing the due count. Activating it MUST call `POST /api/v1/user-certifications/:id/review/start` and navigate into the review run loop. When `dueCount` is zero the quick-start MUST NOT be rendered.

#### Scenario: Due reviews show the quick-start

- **WHEN** an enrollment has a due-review count of 12
- **THEN** the card shows a "5-minute review" quick-start indicating 12 due reviews

#### Scenario: No due reviews hides the quick-start

- **WHEN** an enrollment has a due-review count of 0
- **THEN** no review quick-start is rendered on the card

### Requirement: Start-Session and Mock-Exam quick-starts launch from each card

Each certification card SHALL provide a Start-Session quick-start that calls `POST /api/v1/user-certifications/:id/sessions` and a Mock-Exam quick-start that calls `POST /api/v1/user-certifications/:id/mock-exams`, each navigating to the corresponding runner route. The hero card MUST render these actions in the primary (filled) style and standard cards in the muted style, per the design.

#### Scenario: Start Session launches a session for the cert

- **WHEN** the user activates Start Session on a certification card
- **THEN** the app calls `POST /user-certifications/:id/sessions` for that enrollment and navigates to the session route

#### Scenario: Mock Exam launches a mock for the cert

- **WHEN** the user activates Mock Exam on a certification card
- **THEN** the app calls `POST /user-certifications/:id/mock-exams` for that enrollment and navigates to the mock-exam route

### Requirement: Add-certification enrolls in a new certification

The dashboard SHALL provide an "+ Add certification" entry that opens a modal listing certifications the user is not already enrolled in (derived from `GET /api/v1/certifications` minus current enrollments). Selecting one MUST call `POST /api/v1/user-certifications` to enroll and, on success, refresh the dashboard so the new certification appears as a card.

#### Scenario: Adding a certification enrolls and shows a new card

- **WHEN** the user opens the add-certification modal and selects a certification they are not enrolled in
- **THEN** the app calls `POST /user-certifications` for that certification
- **AND** on success the dashboard refreshes and the newly enrolled certification appears as a card

#### Scenario: Already-enrolled certifications are not offered

- **WHEN** the user opens the add-certification modal
- **THEN** certifications the user is already actively enrolled in are not listed as options
