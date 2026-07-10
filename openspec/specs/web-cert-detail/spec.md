## Purpose

Authenticated certification-detail page (`/user-certifications/:id`) providing an Overview, Sessions, and Exam History tabbed view for a user's enrollment. Aggregates readiness, domain scores, session history, and exam attempts into a single per-certification dashboard.
## Requirements
### Requirement: Cert-detail page is reached from the dashboard and shows the certification header with tabs

The cert-detail page SHALL be reached from the dashboard and show the certification header directly followed by the tab bar (Overview / Sessions), matching `openspec/design/CertDetail.html`. No extra "View progress" link SHALL be inserted between the header and the tab bar.

#### Scenario: No extra link between the header and tabs

- **WHEN** the cert-detail page renders
- **THEN** the certification header is directly followed by the tab bar with no intervening "View progress" link row

### Requirement: Overview tab shows a readiness and trajectory stat row

The Overview tab SHALL show a stat row with Readiness, Sessions, Questions, and Avg accuracy, matching `openspec/design/CertDetail.html`. Each stat SHALL render as its **own bordered, rounded card** (individual border, radius, and background) in a gapped row — not as four values sharing one undifferentiated container. Sessions, Questions, and Avg accuracy SHALL each show the design's sub-caption beneath the value ("completed", "answered", "per session" respectively). The Readiness stat SHALL keep its existing **trajectory** sub-label ("exam-ready in ~N weeks" when a trajectory exists) — the design's week-over-week delta is a different metric and is NOT adopted here.

#### Scenario: Stats render as individually bordered cards with sub-captions

- **WHEN** the Overview tab renders its stat row
- **THEN** each of the four stats is its own bordered, rounded card
- **AND** Sessions/Questions/Avg accuracy show the "completed"/"answered"/"per session" sub-captions

#### Scenario: Readiness keeps the trajectory sub-label

- **WHEN** the Readiness stat renders with a trajectory available
- **THEN** its sub-label shows the trajectory estimate ("exam-ready in ~N weeks"), not a week-over-week delta

### Requirement: Overview tab shows the full per-domain score breakdown

The Overview tab SHALL show the full per-domain score breakdown under the section label **"Domain scores"** (matching `openspec/design/CertDetail.html`), with a 1px divider between rows. The label MUST NOT read "Domain Breakdown".

#### Scenario: Domain breakdown uses the "Domain scores" label with row dividers

- **WHEN** the per-domain breakdown renders
- **THEN** its section label reads "Domain scores" and rows are separated by dividers

### Requirement: Overview tab shows a suggested next focus

The Overview tab SHALL show a suggested next focus, rendered as an **accent-tinted box carrying a rationale** (matching `openspec/design/CertDetail.html`) — rather than a large plain box showing only the domain name. The suggestion is derived from the most recent completed session's `GET /api/v1/sessions/:id/summary` (`nextFocus.domain`), falling back to the lowest-scoring weak-area domain from `GET /api/v1/user-certifications/:id/weak-areas` when no completed-session summary is available. The rationale MUST include the **score-based reason** — the suggested domain's score from its weak-area record (e.g. "Lowest domain score (45%).") — which is the required, always-derivable part of the rationale. The design's additional "Last studied N days ago" clause MUST be shown only as a best-effort addition **when it is derivable client-side** from the domain's most recent appearance in the session history (the newest session whose `focusArea` domains include the suggested domain, relative to `startedAt`); because no `lastStudied` field exists in the backend contract, this clause MUST be omitted rather than fabricated when it cannot be derived. The suggestion is informational and MUST NOT present a deadline or scheduled date. When there is neither a completed session summary nor any weak-area data, the box MUST show a neutral placeholder.

#### Scenario: Next focus comes from the last session summary

- **WHEN** the most recent completed session's summary reports `nextFocus.domain` of "Networking"
- **THEN** the suggested-focus box highlights "Networking" in an accent-tinted box with its rationale

#### Scenario: Box falls back to the weakest domain with a score rationale

- **WHEN** no completed-session summary is available but the lowest-scoring weak area is "Billing" at 45%
- **THEN** the accent-tinted suggested-focus box highlights "Billing" and surfaces the score-based rationale "Lowest domain score (45%)."

#### Scenario: Last-studied clause is omitted when not derivable

- **WHEN** the suggested domain has no session in the loaded history whose `focusArea` domains include it (so its last-studied date cannot be derived)
- **THEN** the rationale shows the score-based reason only and omits any "Last studied N days ago" clause rather than fabricating a date

#### Scenario: No data shows a placeholder

- **WHEN** there is neither a completed-session summary nor any weak-area data
- **THEN** the suggested-focus box shows a neutral placeholder

### Requirement: Overview tab shows recent sessions with accuracy

The Overview tab SHALL show recent sessions, matching `openspec/design/CertDetail.html`. Each recent-session row SHALL display date, duration (with a "· Mock" suffix for mock attempts), accuracy **color-coded by score band**, and a **delta badge** — the delta SHALL be supplied for every row (the panel MUST be given the per-session delta data, not left unbound). Rows SHALL be separated by 1px dividers. A right-aligned **"View all sessions →"** link SHALL appear below the recent-sessions card, navigating to the Sessions tab. The combined "Kind · focus-area" label SHALL NOT be shown in place of the duration line.

#### Scenario: Every recent-session row shows a delta badge

- **WHEN** the recent-sessions panel renders on the Overview tab
- **THEN** each row shows a delta badge and its accuracy is color-coded by score band
- **AND** a "View all sessions →" link is shown below the card

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

