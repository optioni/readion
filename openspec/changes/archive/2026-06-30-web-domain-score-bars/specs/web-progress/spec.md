## MODIFIED Requirements

### Requirement: Per-domain scores with deltas

The page SHALL list per-domain scores for the certification. It SHALL render one row per `certification.domains` entry, joining the matching `userCertificationsControllerListWeakAreas` record for the score/accuracy and showing a neutral "no data yet" state for domains the user has not answered. Each domain's recent delta SHALL be derived from the latest completed session summary's `weakAreaDeltas`, shown only when a delta exists. Each domain row SHALL render through the shared domain-score-bar component (`web-domain-scores`): a status-coloured horizontal bar whose width is proportional to the score, the score percentage, and the optional signed trend delta — not a text-only score. Score colour SHALL use the reused `statusColor` helper (`statusColorForScore`), the single source for the band thresholds.

#### Scenario: Domain with weak-area data and a recent delta

- **WHEN** a domain has a weak-area record and appears in the latest summary's `weakAreaDeltas`
- **THEN** its row renders via the shared domain-score-bar with a status-coloured bar sized to the score, the score percentage, and the signed delta (e.g. "↑7%")

#### Scenario: Domain with no answers yet

- **WHEN** a certification domain has no matching weak-area record
- **THEN** its row renders the shared domain-score-bar's neutral "no data yet" state with no bar fill and no delta
