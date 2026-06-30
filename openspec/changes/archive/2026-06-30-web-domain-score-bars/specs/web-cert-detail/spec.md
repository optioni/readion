## MODIFIED Requirements

### Requirement: Overview tab shows the full per-domain score breakdown

The Overview tab SHALL show one row per certification domain (from `GET /api/v1/certifications/:id` `domains`), joining each domain's score from `GET /api/v1/user-certifications/:id/weak-areas` and colouring the score on the status scale (below 50% poor, 50–65% warning, 65–80% medium, above 80% good). Each domain row SHALL render through the shared domain-score-bar component (`web-domain-scores`): a status-coloured horizontal bar whose width is proportional to the score plus the score percentage, rather than a text-only score. A certification domain with no weak-area record yet MUST render the shared component's neutral "no data yet" state instead of a score.

#### Scenario: Domains with data are status-coloured bars

- **WHEN** the certification has domains Security, Billing, and Networking and the weak-areas report Security 48%, Billing 70%
- **THEN** Security renders a domain-score-bar in the poor colour sized to 48% and Billing a bar in the medium colour sized to 70%
- **AND** Networking, which has no weak-area record, shows the shared component's "no data yet" state with no bar fill
