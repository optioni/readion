## MODIFIED Requirements

### Requirement: Cert-detail page is reached from the dashboard and shows the certification header with tabs

The web app SHALL provide an authenticated cert-detail page at `/user-certifications/:id` reached from each dashboard certification card. The page MUST load the enrollment via `GET /api/v1/user-certifications/:id` and resolve the certification name and provider via `GET /api/v1/certifications/:certificationId` (the enrollment row carries `certificationId` only), and MUST present a tabbed layout with **Overview**, **Sessions**, and **Exam history** tabs, defaulting to Overview.

The page MUST use the **full content width** and render a **full-bleed certification header bar** matching `openspec/design/CertDetail.html`: a breadcrumb ("← Dashboard / CODE") and the primary actions Mock exam and "Start session →". The content MUST NOT be constrained to a narrow centred column that leaves a large empty right region. Tab labels MUST use sentence case — the exam-attempts tab reads "Exam history" (not "Exam History").

#### Scenario: Navigating from a dashboard card opens the cert detail

- **WHEN** an authenticated user activates a certification card on the dashboard
- **THEN** the app navigates to `/user-certifications/:id` for that enrollment
- **AND** the page shows the certification name and provider with Overview, Sessions, and Exam history tabs, Overview active

#### Scenario: Full-width layout with a cert header bar

- **WHEN** an authenticated user opens `/user-certifications/:id`
- **THEN** the page uses the full content width with a full-bleed certification header bar showing a "← Dashboard / CODE" breadcrumb and Mock exam / "Start session →" actions
- **AND** the content is not constrained to a narrow centred column with a large empty right region

#### Scenario: Exam-history tab uses sentence casing

- **WHEN** the cert-detail page renders its tabs
- **THEN** the exam-attempts tab label reads "Exam history"

#### Scenario: Unknown or unowned enrollment

- **WHEN** the user opens `/user-certifications/:id` for an enrollment they do not own
- **THEN** the page shows a not-found state rather than another user's data (the API returns 404 for cross-user access)

### Requirement: Overview tab shows a readiness and trajectory stat row

The Overview tab SHALL render a stat row sourced from `GET /api/v1/user-certifications/:id/readiness`, `GET /api/v1/sessions?certificationId=&limit=…` (total count), and the certification's completed-session summaries. When readiness is calibrated (`calibrated: true`) the row MUST show the score as a percentage; when not calibrated (`calibrated: false`, equivalently `readinessScore` is `null`) it MUST show "not yet calibrated" instead of a number. When `trajectory` is present the row MUST show an informational "exam-ready in ~N week(s)" line derived from `trajectory.weeksToReady`, using the **singular-aware** unit form ("~1 week", "~3 weeks") from the shared pace formatter — the plural word MUST NOT be hardcoded. No per-cert exam-date countdown is shown (no such field exists in the backend contract).

The stat row MUST present **four** stats: Readiness, Sessions, Questions, and Avg accuracy (matching `openspec/design/CertDetail.html`). The Questions stat MUST show the certification's total questions-answered figure and the Avg accuracy stat MUST show an accuracy figure, both derived **client-side** with no new backend field, by aggregating the certification's completed-session summaries already joined for the Overview (`GET /api/v1/sessions/:id/summary`): the questions-answered total is the sum of each summary's `questionsAnswered`, and the accuracy figure is the mean of the summaries' per-session `accuracy` values, coloured on the status scale. When **no questions have been answered** (`questionsAnswered === 0`, e.g. no completed-session summary is available), the Avg accuracy stat MUST show a neutral placeholder (no percentage, or an em dash) and MUST NOT render a `0%` accuracy figure.

#### Scenario: Calibrated readiness with trajectory (plural weeks)

- **WHEN** the enrollment's readiness is calibrated at 72% with `trajectory.weeksToReady` of 3
- **THEN** the stat row shows "72%" and an informational "exam-ready in ~3 weeks" line

#### Scenario: Trajectory of one week uses the singular form

- **WHEN** the enrollment's `trajectory.weeksToReady` is 1
- **THEN** the trajectory line reads "exam-ready in ~1 week" (singular), not "~1 weeks"

#### Scenario: Uncalibrated readiness

- **WHEN** the enrollment's readiness is not yet calibrated
- **THEN** the stat row shows "not yet calibrated" and no readiness percentage

#### Scenario: Stat set is Readiness / Sessions / Questions / Avg accuracy

- **WHEN** the certification's completed-session summaries report `questionsAnswered` of 12, 14, and 18 with `accuracy` of 80%, 64%, and 73%
- **THEN** the stat row shows four stats — Readiness, Sessions, Questions, and Avg accuracy — with Questions reading 44 and Avg accuracy reading 72%
- **AND** the Avg accuracy figure is coloured on the status scale

#### Scenario: Accuracy is suppressed when no questions have been answered

- **WHEN** the certification has `questionsAnswered === 0` (no completed-session summary available)
- **THEN** the Questions stat shows `0` and the Avg accuracy stat shows a neutral placeholder (no percentage / em dash)
- **AND** no `0%` accuracy figure is rendered

### Requirement: Overview tab shows the full per-domain score breakdown

The Overview tab SHALL show one row per certification domain (from `GET /api/v1/certifications/:id` `domains`), joining each domain's score from `GET /api/v1/user-certifications/:id/weak-areas` and colouring the score on the status scale (below 50% poor, 50–65% warning, 65–80% medium, above 80% good). Each domain row SHALL render through the shared domain-score-bar component (`web-domain-scores`): a status-coloured horizontal bar whose width is proportional to the score plus the score percentage, rather than a text-only score. Each domain row MUST also show a **per-domain signed delta** (e.g. "↑7%") derived from the latest completed session summary's `weakAreaDeltas`, shown only when a delta exists, matching `openspec/design/CertDetail.html`. A certification domain with no weak-area record yet MUST render the shared component's neutral "no data yet" state instead of a score.

#### Scenario: Domains with data are status-coloured bars with a delta

- **WHEN** the certification has domains Security, Billing, and Networking, the weak-areas report Security 48%, Billing 70%, and the latest summary's `weakAreaDeltas` include Security ↑7%
- **THEN** Security renders a domain-score-bar in the poor colour sized to 48% with a "↑7%" delta and Billing a bar in the medium colour sized to 70%
- **AND** Networking, which has no weak-area record, shows the shared component's "no data yet" state with no bar fill and no delta

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
