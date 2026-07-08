## MODIFIED Requirements

### Requirement: Dashboard renders enrolled certifications as a vertical list

The web app SHALL provide an authenticated dashboard at the app home that fetches the user's active enrollments via `GET /api/v1/user-certifications?status=active` and renders one card per enrollment in a single vertical list. Each card MUST display the certification name and provider, resolved from `GET /api/v1/certifications` by the enrollment's `certificationId` (the enrollment row carries `certificationId` only). When the user has no active enrollments, the dashboard MUST render an empty state with an add-certification entry instead of an empty list.

The list SHALL be introduced by the shared **PageHeader** (matching `openspec/design/Dashboard.html` and `openspec/design/App Shell.html`): an eyebrow reading "DASHBOARD", an h1 reading "Your certifications", and a right-aligned active-count indicator ("N active") accompanied by a green status dot. The PageHeader MUST be the shared component, not bespoke per-page header markup.

#### Scenario: Enrolled certifications appear as cards

- **WHEN** an authenticated user with two active enrollments opens the dashboard
- **THEN** two certification cards are rendered, each showing its certification name and provider
- **AND** an "+ Add certification" entry is shown at the bottom of the list

#### Scenario: No enrollments shows an empty state

- **WHEN** an authenticated user with zero active enrollments opens the dashboard
- **THEN** an empty state is shown with an add-certification call to action
- **AND** no certification card is rendered

#### Scenario: Shared PageHeader introduces the list

- **WHEN** an authenticated user with two active enrollments opens the dashboard
- **THEN** the shared PageHeader renders with the eyebrow "DASHBOARD" and the h1 "Your certifications"
- **AND** a right-aligned "2 active" indicator with a green status dot is shown

### Requirement: Lowest-readiness cert gets the hero treatment and the list is sorted by readiness

The dashboard SHALL promote the calibrated enrollment with the lowest readiness score to a gradient hero card at the top of the list, render the remaining cards in the muted surface style, and sort all cards by readiness score ascending. Enrollments whose readiness is not yet calibrated MUST be ordered after calibrated ones and MUST NOT be selected as the hero on score. When no enrollment is calibrated, the most recently enrolled certification SHALL take the hero slot. Sorting and hero selection MUST be derived from the `readinessScore` already present on each enrollment row, without a per-cert readiness request solely to order the list.

The hero card's visual hierarchy MUST match `openspec/design/Dashboard.html`: the **certification NAME is the primary heading** of the card, introduced by a "NEEDS ATTENTION" eyebrow, and the readiness percentage renders as a secondary supporting figure — the readiness percentage MUST NOT be the card's primary heading.

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

#### Scenario: Hero heading is the cert name with a NEEDS ATTENTION eyebrow

- **WHEN** the lowest-readiness certification "AWS Solutions Architect" at 42% is rendered as the hero
- **THEN** the card's primary heading is the certification name "AWS Solutions Architect", introduced by a "NEEDS ATTENTION" eyebrow
- **AND** the 42% readiness figure is shown as a secondary supporting figure, not as the card's main heading

### Requirement: Each card shows top weak areas with status-coloured scores

Each certification card SHALL show up to the top three weak-area domains from `GET /api/v1/user-certifications/:id/weak-areas`, each rendered as an inline **DomainBadge** chip — a status dot, the domain label, and its score percentage — matching `openspec/design/Dashboard.html`, rather than a bordered text list. Each chip's score MUST be coloured on the status scale (below 50% poor, 50–65% warning, 65–80% medium, above 80% good). When no weak-area data exists yet for the enrollment, the card MUST show a neutral "no data yet" placeholder rather than an empty panel.

#### Scenario: Top three weak areas are shown as status-coloured chips

- **WHEN** an enrollment has weak areas Billing 48%, Security 61%, Networking 70%, and Storage 75%
- **THEN** the card shows Billing, Security, and Networking (the lowest three) as inline DomainBadge chips, each with a status dot, label, and percentage
- **AND** 48% is rendered in the poor colour, 61% in the warning colour, and 70% in the medium colour
- **AND** the weak areas are not rendered as a bordered text list

#### Scenario: No weak-area data shows a placeholder

- **WHEN** an enrollment has no weak-area records yet
- **THEN** the weak-areas panel shows a "no data yet" placeholder

### Requirement: Each card shows recent sessions with domain and accuracy

Each certification card SHALL show up to the last three sessions for the certification from `GET /api/v1/sessions?certificationId=<certificationId>&limit=3` (filtered by the enrollment's underlying certification id). Recent sessions MUST render as a compact multi-column mini layout matching `openspec/design/Dashboard.html` — for each session a **when** label, its **duration**, and its **+delta** — rather than a single text line. For each completed session the card MUST show a domain label and the session accuracy obtained from `GET /api/v1/sessions/:id/summary`; a session without an available summary MUST fall back to a date and focus-area label without an accuracy figure. When the enrollment has no sessions yet, the card MUST show a "no sessions yet" placeholder.

#### Scenario: Recent completed sessions show a compact when/duration/delta layout

- **WHEN** an enrollment's three most recent completed sessions report accuracies of 82%, 55%, and 71%
- **THEN** the recent-sessions panel lists three rows, each in a compact layout showing a when label, a duration, and a signed delta
- **AND** each row carries a domain label and its accuracy

#### Scenario: No sessions shows a placeholder

- **WHEN** an enrollment has no sessions
- **THEN** the recent-sessions panel shows a "no sessions yet" placeholder

### Requirement: Due-review quick-start appears only when reviews are due

Each certification card SHALL request the due-review count via `GET /api/v1/user-certifications/:id/review` and, only when `meta.dueCount` is greater than zero, render a review-due row showing the due count. Matching `openspec/design/Dashboard.html`, this row MUST present the due count as a prominent number paired with a "reviews due" label and a pill affordance aligned to the leading (left) edge of the row; on the hero card the pill MUST use the white-translucent hero treatment. Activating it MUST call `POST /api/v1/user-certifications/:id/review/start` and navigate into the review run loop. When `dueCount` is zero the row MUST NOT be rendered.

#### Scenario: Due reviews show the review-due row

- **WHEN** an enrollment has a due-review count of 12
- **THEN** the card shows a review-due row with the prominent count "12", a "reviews due" label, and a leading-aligned pill affordance
- **AND** activating the pill starts the review run loop

#### Scenario: No due reviews hides the row

- **WHEN** an enrollment has a due-review count of 0
- **THEN** no review-due row is rendered on the card

### Requirement: Start-Session and Mock-Exam quick-starts launch from each card

Each certification card SHALL provide a Start-Session quick-start that calls `POST /api/v1/user-certifications/:id/sessions` and a Mock-Exam quick-start that calls `POST /api/v1/user-certifications/:id/mock-exams`, each navigating to the corresponding runner route. Matching `openspec/design/Dashboard.html`, both actions MUST be placed in the card's **bottom action row** (Mock exam alongside "Start session →"), not in the card's top-right corner. The hero card MUST render these actions in the primary (filled) style and standard cards in the muted style, per the design.

#### Scenario: Start Session launches a session for the cert

- **WHEN** the user activates Start Session on a certification card
- **THEN** the app calls `POST /user-certifications/:id/sessions` for that enrollment and navigates to the session route

#### Scenario: Mock Exam launches a mock for the cert

- **WHEN** the user activates Mock Exam on a certification card
- **THEN** the app calls `POST /user-certifications/:id/mock-exams` for that enrollment and navigates to the mock-exam route

#### Scenario: Actions render in the card's bottom row

- **WHEN** a certification card is rendered
- **THEN** the Mock exam and "Start session →" actions appear in the card's bottom action row, not in the top-right corner

### Requirement: Add-certification enrolls in a new certification

The dashboard SHALL provide an "+ Add certification" entry that opens a modal listing certifications the user is not already enrolled in (derived from `GET /api/v1/certifications` minus current enrollments). Selecting one MUST call `POST /api/v1/user-certifications` to enroll and, on success, refresh the dashboard so the new certification appears as a card. Matching `openspec/design/Dashboard.html`, the add-certification card MUST show the subtitle "Track another exam alongside this one" beneath its label.

#### Scenario: Adding a certification enrolls and shows a new card

- **WHEN** the user opens the add-certification modal and selects a certification they are not enrolled in
- **THEN** the app calls `POST /user-certifications` for that certification
- **AND** on success the dashboard refreshes and the newly enrolled certification appears as a card

#### Scenario: Already-enrolled certifications are not offered

- **WHEN** the user opens the add-certification modal
- **THEN** certifications the user is already actively enrolled in are not listed as options

#### Scenario: Add-certification card shows the subtitle

- **WHEN** the dashboard renders the "+ Add certification" entry
- **THEN** the card shows the subtitle "Track another exam alongside this one" beneath its label

## ADDED Requirements

### Requirement: First-visit diagnostic banner is an accent-tinted welcome callout

The dashboard SHALL render its first-visit / diagnostic message as an accent-tinted welcome callout with a shield icon, matching `openspec/design/Dashboard.html`, rather than as plain unstyled text. The callout is informational and MUST NOT block the certification list.

#### Scenario: Diagnostic banner renders as an accent-tinted callout

- **WHEN** the dashboard shows its first-visit / diagnostic welcome message
- **THEN** the message renders as an accent-tinted callout with a shield icon
- **AND** the message is not rendered as plain unstyled text
