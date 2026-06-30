## ADDED Requirements

### Requirement: Shared domain-score bar renders a status-coloured value bar

The web app SHALL provide a single reusable domain-score-bar component, used wherever a per-domain score is listed, that renders a horizontal progress bar whose filled width is proportional to the domain's score (0–100%) and whose fill colour is the status-band colour for that score. The status band SHALL come from the shared `statusColorForScore` helper (`apps/web/app/composables/statusColor.ts`) so every surface agrees on one scale: below 50% poor, 50–65% warning, 65–80% medium, above 80% good. The component MUST render the domain label and the numeric score percentage alongside the bar.

#### Scenario: Bar width is proportional to the score

- **WHEN** the component is given a domain score of 70
- **THEN** the bar's filled element resolves to 70% of the track width
- **AND** the row shows the label and "70%"

#### Scenario: Fill colour follows the status band

- **WHEN** the component is given scores of 48, 60, 70, and 90
- **THEN** the 48 bar uses the poor colour, the 60 bar the warning colour, the 70 bar the medium colour, and the 90 bar the good colour
- **AND** the colour is derived from `statusColorForScore`, not a per-component threshold copy

### Requirement: Domain-score bar shows an optional signed trend delta

The component SHALL accept an optional signed trend delta and, when one is supplied, render it as a signed change (an up arrow for a non-negative delta, a down arrow for a negative delta, with the absolute value and a `%` suffix), coloured good for non-negative and poor for negative. When no delta is supplied the trend affordance MUST be omitted entirely rather than shown as a zero or placeholder.

#### Scenario: Positive trend delta

- **WHEN** the component is given a score and a trend delta of `+7`
- **THEN** the row renders "↑7%" in the good colour

#### Scenario: No trend delta supplied

- **WHEN** the component is given a score but no trend delta
- **THEN** no trend element is rendered for that row

### Requirement: Domain-score bar exposes an accessible label

The component SHALL expose an accessible name conveying the domain and its score (e.g. an ARIA label such as "<domain> score 70%") so the value is available to assistive technology and not communicated by colour alone.

#### Scenario: Accessible name includes domain and score

- **WHEN** the component renders a domain "Networking" at 70%
- **THEN** its accessible name includes the domain name and the score percentage

### Requirement: Domain-score bar has a neutral "no data yet" state

The component SHALL accept rows with no score yet and render an explicit neutral "no data yet" state — a neutral (non-status-coloured) empty/zero-width track and no percentage figure and no trend — instead of drawing a misleading zero-score bar in a status colour.

#### Scenario: Domain with no score yet

- **WHEN** the component is given a domain with no score (no weak-area data)
- **THEN** it renders a neutral "no data yet" state with no percentage, no trend, and no status colour applied
