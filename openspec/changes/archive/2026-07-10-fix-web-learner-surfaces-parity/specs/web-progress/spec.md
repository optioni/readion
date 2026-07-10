## MODIFIED Requirements

### Requirement: Activity stat summary row

The progress page SHALL show the activity stat summary — Sessions, Questions answered, Study time, Current streak — under an uppercase **"This month"** section label, with each stat rendered in its own bordered surface card (matching `openspec/design/Progress.html`), not four values sharing a single container. Section headers on the page SHALL show a live count next to the label (e.g. "10 sessions", "Last 6 sessions", "N sessions total"). The page content SHALL use the manifest **`standard`** content width (centered, ~1100px), not a `max-w-[720px]` column.

#### Scenario: Activity stats render under "This month" as bordered cards

- **WHEN** the progress page renders its activity summary
- **THEN** the stats appear under a "This month" section label, each in its own bordered surface card
- **AND** the page content uses the standard content width, not a 720px column

### Requirement: Readiness-over-time and accuracy trend

The progress page SHALL show the readiness-over-time chart and the accuracy trend under the section labels **"Readiness over time"** and (for domains) **"Domain scores"**, matching `openspec/design/Progress.html`. The readiness chart SHALL render X-axis date labels (first / middle / last session), an area fill under the line, and — when trajectory data exists — a dashed projection segment from the last point toward the target. The accuracy trend SHALL show the numeric percentage only on the most recent (last) bar and a short date caption beneath each bar.

#### Scenario: Readiness chart shows date labels, area fill, and projection

- **WHEN** the readiness-over-time chart renders with history
- **THEN** it shows first/middle/last X-axis date labels and an area fill under the line
- **AND** when trajectory data exists it draws a dashed projection segment toward the target

#### Scenario: Accuracy bars label only the last bar and caption each

- **WHEN** the accuracy trend renders
- **THEN** only the most recent bar shows its percentage, and each bar has a short date caption beneath it

### Requirement: Passive readiness trajectory call-out

The passive readiness trajectory call-out SHALL render at the **bottom of the readiness-over-time section**, directly below the readiness chart and accuracy bars, as a conclusion drawn from the visible trend (matching `openspec/design/Progress.html`) — not at the top of the page before the stats and chart.

#### Scenario: Trajectory call-out sits below the chart

- **WHEN** the progress page renders the trajectory call-out
- **THEN** it appears at the bottom of the readiness section, after the chart and accuracy bars, not before the stat summary

### Requirement: Session history table

The session history table SHALL list the per-cert sessions, and each row SHALL show the date with the session's **start time-of-day** as a secondary line beneath it (e.g. "3:42 PM"), matching `openspec/design/Progress.html`.

#### Scenario: History rows show time-of-day

- **WHEN** the session history table renders a row
- **THEN** the row shows the date and the session start time-of-day as a secondary line

### Requirement: Mark a concept or domain as mastered

The page SHALL let the user retire a domain from review and new-material selection via `enrollmentReviewControllerSuppressDomain` (domain scope). Within the review run loop, the user SHALL be able to retire a single concept via `reviewItemsControllerMaster`. The mastered state SHALL be **derived from fetched data and persist across reloads** — it MUST NOT be a local-only toggle that resets on navigation. A mastered domain SHALL render with the design's treatment (matching `openspec/design/Progress.html`): moved under a "Mastered" divider group, its name struck through, its score bar dimmed, and a "Mastered" pill badge. The UI SHALL reflect the one-way nature of the backend contract: there is no un-suppress / un-master endpoint, so no functional "Unretire" control is offered (the artboard's Unretire control is omitted).

#### Scenario: Mastering a domain persists across reloads

- **WHEN** the user marks a domain mastered and confirms
- **THEN** the app calls `enrollmentReviewControllerSuppressDomain`, invalidates the affected queries, and the domain renders in its mastered (retired) state
- **AND** after a reload the domain is still shown as mastered (derived from fetched data, not a reset local ref)

#### Scenario: Mastered domain uses the design treatment without an Unretire control

- **WHEN** a mastered domain renders
- **THEN** it appears under a "Mastered" divider with a struck-through name, dimmed bar, and "Mastered" pill
- **AND** no functional "Unretire" action is presented (one-way contract)
