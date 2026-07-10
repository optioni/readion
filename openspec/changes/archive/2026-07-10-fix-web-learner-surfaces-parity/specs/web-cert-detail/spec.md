## MODIFIED Requirements

### Requirement: Overview tab shows a readiness and trajectory stat row

The Overview tab SHALL show a stat row with Readiness, Sessions, Questions, and Avg accuracy, matching `openspec/design/CertDetail.html`. Each stat SHALL render as its **own bordered, rounded card** (individual border, radius, and background) in a gapped row — not as four values sharing one undifferentiated container. Sessions, Questions, and Avg accuracy SHALL each show the design's sub-caption beneath the value ("completed", "answered", "per session" respectively). The Readiness stat SHALL keep its existing **trajectory** sub-label ("exam-ready in ~N weeks" when a trajectory exists) — the design's week-over-week delta is a different metric and is NOT adopted here.

#### Scenario: Stats render as individually bordered cards with sub-captions

- **WHEN** the Overview tab renders its stat row
- **THEN** each of the four stats is its own bordered, rounded card
- **AND** Sessions/Questions/Avg accuracy show the "completed"/"answered"/"per session" sub-captions

#### Scenario: Readiness keeps the trajectory sub-label

- **WHEN** the Readiness stat renders with a trajectory available
- **THEN** its sub-label shows the trajectory estimate ("exam-ready in ~N weeks"), not a week-over-week delta

### Requirement: Overview tab shows recent sessions with accuracy

The Overview tab SHALL show recent sessions, matching `openspec/design/CertDetail.html`. Each recent-session row SHALL display date, duration (with a "· Mock" suffix for mock attempts), accuracy **color-coded by score band**, and a **delta badge** — the delta SHALL be supplied for every row (the panel MUST be given the per-session delta data, not left unbound). Rows SHALL be separated by 1px dividers. A right-aligned **"View all sessions →"** link SHALL appear below the recent-sessions card, navigating to the Sessions tab. The combined "Kind · focus-area" label SHALL NOT be shown in place of the duration line.

#### Scenario: Every recent-session row shows a delta badge

- **WHEN** the recent-sessions panel renders on the Overview tab
- **THEN** each row shows a delta badge and its accuracy is color-coded by score band
- **AND** a "View all sessions →" link is shown below the card

### Requirement: Overview tab shows the full per-domain score breakdown

The Overview tab SHALL show the full per-domain score breakdown under the section label **"Domain scores"** (matching `openspec/design/CertDetail.html`), with a 1px divider between rows. The label MUST NOT read "Domain Breakdown".

#### Scenario: Domain breakdown uses the "Domain scores" label with row dividers

- **WHEN** the per-domain breakdown renders
- **THEN** its section label reads "Domain scores" and rows are separated by dividers

### Requirement: Cert-detail page is reached from the dashboard and shows the certification header with tabs

The cert-detail page SHALL be reached from the dashboard and show the certification header directly followed by the tab bar (Overview / Sessions), matching `openspec/design/CertDetail.html`. No extra "View progress" link SHALL be inserted between the header and the tab bar.

#### Scenario: No extra link between the header and tabs

- **WHEN** the cert-detail page renders
- **THEN** the certification header is directly followed by the tab bar with no intervening "View progress" link row
