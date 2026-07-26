# Web Dashboard Spec

## Purpose

Defines the authenticated home dashboard that surfaces a user's active certification enrollments, exposes per-certification health signals (readiness score, weak areas, recent sessions, due reviews), and provides quick-start entry points for study sessions, mock exams, and spaced-repetition review runs. The dashboard is the primary navigation hub after sign-in.
## Requirements
### Requirement: Dashboard enrollment data has explicit loading and failure states

The dashboard SHALL render certification-card skeletons while the initial enrollment request is unresolved. It MUST NOT render the no-certifications state or partial-data warning before that request succeeds. If the request fails, the dashboard SHALL show "Couldn't load your certifications" with a Retry action; Retry SHALL repeat the enrollment request without reloading the document. Successfully loaded cards SHALL remain visible during background refresh.

#### Scenario: Initial dashboard request does not flash the empty state

- **WHEN** Playwright delays `GET /api/v1/user-certifications`
- **THEN** certification-card skeletons are visible and the certification region exposes `aria-busy="true"`
- **AND** neither the no-certifications state nor certification cards are shown before the response resolves

#### Scenario: Dashboard enrollment failure is retryable

- **WHEN** the first enrollment request fails and the retry succeeds with one enrollment
- **THEN** the dashboard shows "Couldn't load your certifications" and a Retry action
- **AND** activating Retry sends one new enrollment request and replaces the error with the returned certification card

### Requirement: Dashboard renders enrolled certifications as a vertical list

The dashboard SHALL render the user's active enrollments as a vertical list of certification cards within a content column set to the manifest **`standard`** content width (centered, ~1100px, matching `openspec/design/Dashboard.html`) — it MUST NOT constrain the column to the narrower `max-w-[720px]` width. Each card's title block SHALL show the certification name, provider, and a monospace **code pill** (e.g. "SAA-C03") on an elevated background beside the provider. Within a card, the weak-areas, recent-sessions, and review sections SHALL render as full-width sections separated by 1px hairline dividers directly on the card background — not as boxed `CardPanel` containers in a two-column grid. Recent sessions SHALL use the design's multi-column split (equal-width columns with vertical rules). Quick-start button copy SHALL be sentence case — "Mock exam" and "5-min review" — and the review button SHALL include the design's leading play icon.

#### Scenario: Dashboard uses the standard content width

- **WHEN** the dashboard renders its cert cards
- **THEN** the content column uses the standard (~1100px centered) width, not a 720px-capped column

#### Scenario: Card shows the certification code pill

- **WHEN** a cert card renders its title block
- **THEN** a monospace code pill (e.g. "SAA-C03") is shown beside the provider

#### Scenario: Card sections are flat and hairline-divided

- **WHEN** a card renders its weak-areas, recent-sessions, and review sections
- **THEN** the sections are full-width and separated by hairline dividers on the card background, not boxed panels in a two-column grid

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

### Requirement: Each card shows readiness with calibration state and delta

Each certification card SHALL show the readiness percentage with its calibration state and the session-over-session delta, matching `openspec/design/Dashboard.html`. Beneath the readiness percentage the card SHALL render a **ReadinessBar** — a thin rounded progress track filled to the readiness percentage. On the hero (gradient) card the track uses the white-translucent hero treatment; on standard cards it uses the status color for the readiness band. An uncalibrated (not-assessed) readiness renders the track empty with the "—" state, not a zero-filled bar.

#### Scenario: Readiness bar reflects the score on each card

- **WHEN** a cert card renders with a readiness percentage
- **THEN** a ReadinessBar track is shown filled to that percentage beneath the number
- **AND** the hero card's track uses the white-translucent treatment while standard cards use the readiness-band status color

#### Scenario: Not-assessed readiness renders an empty track

- **WHEN** a card's readiness is uncalibrated ("—")
- **THEN** the ReadinessBar renders empty rather than as a zero-filled status bar

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

Each certification card SHALL request the due-review count via `GET /api/v1/user-certifications/:id/review` and, only when a successful response reports `meta.dueCount` greater than zero, render a review-due row showing the due count. Matching `openspec/design/Dashboard.html`, this row MUST present the due count as a prominent number paired with a "reviews due" label and a pill affordance aligned to the leading (left) edge of the row; on the hero card the pill MUST use the white-translucent hero treatment. Activating it MUST call `POST /api/v1/user-certifications/:id/review/start`, expose action-local busy feedback with "Starting…", reject duplicate activation, and navigate into the review run loop on success. When `dueCount` is zero the row MUST NOT be rendered.

#### Scenario: Due reviews show the review-due row

- **WHEN** an enrollment has a due-review count of 12
- **THEN** the card shows a review-due row with the prominent count "12", a "reviews due" label, and a leading-aligned pill affordance
- **AND** activating the pill starts the review run loop

#### Scenario: Review start exposes progress

- **WHEN** the user activates the review pill and the start request remains pending
- **THEN** the initiating affordance exposes `aria-busy="true"`, a spinner, and "Starting…"
- **AND** a second activation sends no additional request

#### Scenario: No due reviews hides the row

- **WHEN** an enrollment has a due-review count of 0
- **THEN** no review-due row is rendered on the card

### Requirement: Start-Session and Mock-Exam quick-starts launch from each card

Each certification card SHALL provide a Start-Session quick-start that calls `POST /api/v1/user-certifications/:id/sessions` and a Mock-Exam quick-start that calls `POST /api/v1/user-certifications/:id/mock-exams`, each navigating to the corresponding runner route. Matching `openspec/design/Dashboard.html`, both actions MUST be placed in the card's **bottom action row** (Mock exam alongside "Start session →"), not in the card's top-right corner. The hero card MUST render these actions in the primary (filled) style and standard cards in the muted style, per the design. While either request is pending, only the initiating action SHALL show a spinner with "Starting…", expose `aria-busy="true"`, and reject duplicate activation.

#### Scenario: Start Session launches a session for the cert

- **WHEN** the user activates Start Session on a certification card
- **THEN** the app calls `POST /user-certifications/:id/sessions` for that enrollment and navigates to the session route

#### Scenario: Mock Exam launches a mock for the cert

- **WHEN** the user activates Mock Exam on a certification card
- **THEN** the app calls `POST /user-certifications/:id/mock-exams` for that enrollment and navigates to the mock-exam route

#### Scenario: Quick-start identifies the pending action

- **WHEN** the user activates Mock exam and its request remains pending
- **THEN** Mock exam shows a spinner with "Starting…" and exposes `aria-busy="true"`
- **AND** Start session remains visually distinct from the initiating busy action
- **AND** repeated activation sends no duplicate mock-exam request

#### Scenario: Actions render in the card's bottom row

- **WHEN** a certification card is rendered
- **THEN** the Mock exam and "Start session →" actions appear in the card's bottom action row, not in the top-right corner

### Requirement: Add-certification enrolls in a new certification

The dashboard SHALL provide an "+ Add certification" entry that opens a modal listing certifications the user is not already enrolled in (derived from `GET /api/v1/certifications` minus current enrollments). Selecting one MUST call `POST /api/v1/user-certifications` to enroll and, on success, refresh the dashboard so the new certification appears as a card. While enrollment is pending, the selected certification SHALL remain identifiable and show a spinner with "Adding…"; other choices SHALL be unavailable and duplicate submission SHALL be rejected. A failed enrollment SHALL preserve the modal and selected context, render the error, and return the choice to an explicitly retryable state. Matching `openspec/design/Dashboard.html`, the add-certification card MUST show the subtitle "Track another exam alongside this one" beneath its label.

#### Scenario: Adding a certification enrolls and shows a new card

- **WHEN** the user opens the add-certification modal and selects a certification they are not enrolled in
- **THEN** the app calls `POST /user-certifications` for that certification
- **AND** on success the dashboard refreshes and the newly enrolled certification appears as a card

#### Scenario: Selected certification is identifiable while enrolling

- **WHEN** the user selects "AWS Solutions Architect" and the enrollment request remains pending
- **THEN** that option shows a spinner and "Adding…" while retaining the certification name
- **AND** repeated activation sends no duplicate request

#### Scenario: Already-enrolled certifications are not offered

- **WHEN** the user opens the add-certification modal
- **THEN** certifications the user is already actively enrolled in are not listed as options

#### Scenario: Add-certification card shows the subtitle

- **WHEN** the dashboard renders the "+ Add certification" entry
- **THEN** the card shows the subtitle "Track another exam alongside this one" beneath its label

### Requirement: First-visit diagnostic banner is an accent-tinted welcome callout

The dashboard SHALL render its first-visit / diagnostic message as an accent-tinted welcome callout with a shield icon, matching `openspec/design/Dashboard.html`, rather than as plain unstyled text. The callout is informational and MUST NOT block the certification list.

#### Scenario: Diagnostic banner renders as an accent-tinted callout

- **WHEN** the dashboard shows its first-visit / diagnostic welcome message
- **THEN** the message renders as an accent-tinted callout with a shield icon
- **AND** the message is not rendered as plain unstyled text

