## MODIFIED Requirements

### Requirement: Overview tab shows a readiness and trajectory stat row

The Overview tab SHALL render a stat row sourced from `GET /api/v1/user-certifications/:id/readiness`, `GET /api/v1/sessions?certificationId=&limit=…` (total count), and `GET /api/v1/user-certifications/:id/review` (due count). When readiness is calibrated (`calibrated: true`) the row MUST show the score as a percentage; when not calibrated (`calibrated: false`, equivalently `readinessScore` is `null`) it MUST show "not yet calibrated" instead of a number. When `trajectory` is present the row MUST show an informational "exam-ready in ~N weeks" line derived from `trajectory.weeksToReady`, with no dates or reminders. No per-cert exam-date countdown is shown (no such field exists in the backend contract).

The stat row MUST present **four** stats: Readiness, Sessions, Due reviews, and a fourth questions-answered / accuracy stat. The fourth stat MUST show the certification's total questions-answered figure together with an accuracy figure, both derived **client-side** with no new backend field, by aggregating the certification's completed-session summaries already joined for the Overview (`GET /api/v1/sessions/:id/summary`): the questions-answered total is the sum of each summary's `questionsAnswered`, and the accuracy figure is the mean of the summaries' per-session `accuracy` values, coloured on the status scale. When no completed-session summary is available, the fourth stat MUST show a neutral placeholder (questions answered `0`, no accuracy figure) rather than a fabricated value.

#### Scenario: Calibrated readiness with trajectory

- **WHEN** the enrollment's readiness is calibrated at 72% with `trajectory.weeksToReady` of 3
- **THEN** the stat row shows "72%" and an informational "exam-ready in ~3 weeks" line

#### Scenario: Uncalibrated readiness

- **WHEN** the enrollment's readiness is not yet calibrated
- **THEN** the stat row shows "not yet calibrated" and no readiness percentage

#### Scenario: Fourth stat shows aggregated questions answered and accuracy

- **WHEN** the certification's completed-session summaries report `questionsAnswered` of 12, 14, and 18 with `accuracy` of 80%, 64%, and 73%
- **THEN** the stat row shows four stats, the fourth reading 44 questions answered with a 72% accuracy figure
- **AND** the accuracy figure is coloured on the status scale

#### Scenario: Fourth stat with no summaries shows a placeholder

- **WHEN** the certification has no completed-session summary available
- **THEN** the fourth stat shows `0` questions answered and no accuracy figure rather than a fabricated value

### Requirement: Overview tab shows a suggested next focus

The Overview tab SHALL show a suggested next focus, rendered as a **weakest-domain side panel paired alongside the domain breakdown** (matching `openspec/design/CertDetail.html`), derived from the most recent completed session's `GET /api/v1/sessions/:id/summary` (`nextFocus.domain`), falling back to the lowest-scoring weak-area domain from `GET /api/v1/user-certifications/:id/weak-areas` when no completed-session summary is available. When the suggestion comes from the weak-area fallback, the side panel MUST surface the weakest domain together with its score (the lowest `score` among the weak-area records). The suggestion is informational and MUST NOT present a deadline or scheduled date. When there is neither a completed session summary nor any weak-area data, the panel MUST show a neutral placeholder.

#### Scenario: Next focus comes from the last session summary

- **WHEN** the most recent completed session's summary reports `nextFocus.domain` of "Networking"
- **THEN** the weakest-domain side panel highlights "Networking" alongside the domain breakdown

#### Scenario: Side panel falls back to the weakest domain with its score

- **WHEN** no completed-session summary is available but the lowest-scoring weak area is "Billing" at 41%
- **THEN** the weakest-domain side panel highlights "Billing" and surfaces its 41% score

#### Scenario: No data shows a placeholder

- **WHEN** there is neither a completed-session summary nor any weak-area data
- **THEN** the weakest-domain side panel shows a neutral placeholder
