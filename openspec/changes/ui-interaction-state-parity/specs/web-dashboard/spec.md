## ADDED Requirements

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

## MODIFIED Requirements

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
