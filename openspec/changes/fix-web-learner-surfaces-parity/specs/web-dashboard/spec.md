## MODIFIED Requirements

### Requirement: Each card shows readiness with calibration state and delta

Each certification card SHALL show the readiness percentage with its calibration state and the session-over-session delta, matching `openspec/design/Dashboard.html`. Beneath the readiness percentage the card SHALL render a **ReadinessBar** — a thin rounded progress track filled to the readiness percentage. On the hero (gradient) card the track uses the white-translucent hero treatment; on standard cards it uses the status color for the readiness band. An uncalibrated (not-assessed) readiness renders the track empty with the "—" state, not a zero-filled bar.

#### Scenario: Readiness bar reflects the score on each card

- **WHEN** a cert card renders with a readiness percentage
- **THEN** a ReadinessBar track is shown filled to that percentage beneath the number
- **AND** the hero card's track uses the white-translucent treatment while standard cards use the readiness-band status color

#### Scenario: Not-assessed readiness renders an empty track

- **WHEN** a card's readiness is uncalibrated ("—")
- **THEN** the ReadinessBar renders empty rather than as a zero-filled status bar

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
