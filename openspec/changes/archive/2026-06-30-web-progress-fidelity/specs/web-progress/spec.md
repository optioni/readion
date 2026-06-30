## ADDED Requirements

### Requirement: Activity stat summary row

The Progress page SHALL render a four-card activity summary at the top of the page — **Sessions**, **Questions answered**, **Study time**, and **Current streak** — matching `openspec/design/Progress.html`. The current page renders only two cards (Sessions, Questions); this requirement establishes the full four-card row.

Because the API exposes no aggregate activity endpoint, every value SHALL be derived client-side from data already loaded for the page (the session list from `sessionsControllerList` filtered by `certificationId`, and the completed-session summaries from `sessionSummaryControllerSummary`), within the same bounded fan-out the page already performs over the most recent sessions page — no backend change and no new endpoint. Specifically:

- **Sessions** — the count of the user's sessions for the enrollment.
- **Questions answered** — the sum of each completed-session summary's `questionsAnswered`.
- **Study time** — the sum of each session's `durationMinutes` (exposed on `SessionResponse`), rendered in a compact `h`/`m` form (e.g. "6h 12m", "58m").
- **Current streak** — the number of consecutive days, ending on the most recent active day, on which at least one session was started, derived from each session's `startedAt` timestamp; rendered with a "days" unit.

The Questions answered / Study time / Current streak cards SHALL always be present in the row (showing a zero/empty value such as "0" or "0m" when there is no data yet), rather than being conditionally hidden.

#### Scenario: Four cards render with derived values

- **WHEN** an enrollment has completed sessions with summaries
- **THEN** the stat row renders four cards labelled "Sessions", "Questions answered", "Study time", and "Current streak"
- **THEN** Sessions shows the session count, Questions answered shows the summed `questionsAnswered` across completed-session summaries, Study time shows the summed `durationMinutes` in `h`/`m` form, and Current streak shows the consecutive-day count derived from session `startedAt` dates

#### Scenario: Study time and current streak are derived client-side

- **WHEN** the read model exposes no dedicated study-time total or streak field
- **THEN** Study time is computed by summing the exposed per-session `durationMinutes` and Current streak by counting consecutive days with at least one session `startedAt`
- **THEN** no backend endpoint or field is assumed beyond the session list and summaries already loaded

#### Scenario: Early enrollment with no completed sessions

- **WHEN** the enrollment has no completed sessions yet
- **THEN** all four cards are still present, with Questions answered, Study time, and Current streak showing zero/empty values rather than being omitted

## MODIFIED Requirements

### Requirement: Readiness-over-time and accuracy trend

The Progress page SHALL render a passive readiness-over-time line and a historical quiz-accuracy chart. Because no time-series endpoint exists, both series SHALL be derived client-side from completed-session summaries (`sessionSummaryControllerSummary.readiness.after` and `.accuracy`) ordered chronologically, in a co-located unit-tested composable. The current readiness value SHALL come from `readinessControllerRead`.

The readiness-over-time line SHALL render, matching `openspec/design/Progress.html`, a visible **data point marker per plotted value** (with the most recent point emphasized), **y-axis percentage tick labels**, and the **current readiness value as a percentage label** — not a bare polyline. When the enrollment is not yet calibrated, the chart SHALL show the "not yet calibrated" early state instead of points, axis, or a value.

The accuracy chart SHALL render one visible bar per entry in the derived accuracy series (one completed session each), with the most recent session emphasized, matching `openspec/design/Progress.html`. Each bar's drawn height SHALL be proportional to its session `accuracy` and SHALL be visibly non-zero for any positive accuracy (the bar element MUST resolve against a defined chart height, not collapse to zero). The chart SHALL distinguish "no bars because there is genuinely no completed-session accuracy data" from a rendering failure by showing an explicit empty/insufficient-data state only when the series is empty.

#### Scenario: Calibrated enrollment with completed sessions

- **WHEN** the enrollment is calibrated (`readiness.calibrated === true`, `score` non-null) and has multiple completed sessions with summaries
- **THEN** the readiness line plots one point per completed session using each summary's `readiness.after`, ending at the current readiness `score`
- **THEN** the accuracy chart plots one bar per recent completed session using each summary's `accuracy`

#### Scenario: Readiness line renders points, axis ticks, and the current value

- **WHEN** the readiness series has N plotted values for a calibrated enrollment
- **THEN** the line renders N point markers (one per plotted value) with the most recent point visually emphasized
- **THEN** y-axis percentage tick labels are rendered and the current readiness value is shown as a percentage label
- **THEN** the readiness figure is not a bare polyline without points/axis/value

#### Scenario: Accuracy bars are drawn for a non-empty series

- **WHEN** the derived accuracy series has N entries with positive `accuracy` values
- **THEN** the chart renders exactly N bar elements (one per session), each with a visibly non-zero drawn height proportional to its `accuracy`
- **THEN** the bar for the most recent session is visually emphasized relative to the others
- **THEN** the empty/insufficient-data state is not shown

#### Scenario: Explicit empty state only when there is no data

- **WHEN** the derived accuracy series is empty (no completed sessions have summaries)
- **THEN** the chart renders zero bar elements and shows the explicit empty/insufficient-data state
- **THEN** the empty state is the only reason "no bars" appears — a non-empty series never renders without bars

#### Scenario: Not-yet-calibrated enrollment

- **WHEN** `readiness.calibrated === false` (equivalently `score === null`)
- **THEN** the readiness figure renders as "not yet calibrated" via the reused `readinessFormat` helper rather than a misleading percentage
- **THEN** the trend area shows an early/empty state instead of a fabricated line, points, axis, or value

### Requirement: Passive readiness trajectory call-out

The page SHALL show the passive trajectory projection only when the backend provides it (`readinessControllerRead` returns `trajectory.weeksToReady`). The call-out SHALL render the fuller copy from `openspec/design/Progress.html` with a trend icon: a recent-pace rate plus the estimated time-to-ready, e.g. "At your recent pace (X% readiness/session avg.), you'll be exam-ready in approximately N weeks." The pace rate is not a dedicated API field; it SHALL be derived client-side from the same readiness series used by the trend chart (the average per-session readiness gain). The text SHALL remain informational — no dates and no reminders. When the projection is not yet estimable, the uncalibrated/insufficient-data branch SHALL show a "Complete at least N sessions to see your pace estimate" hint with no projected weeks and no pace rate.

#### Scenario: Trajectory available

- **WHEN** `readinessControllerRead` returns `trajectory: { weeksToReady }` (non-null)
- **THEN** the call-out renders the fuller copy with a trend icon: the recent-pace rate (derived client-side from the readiness series) and "exam-ready in approximately {weeksToReady} weeks"

#### Scenario: Trajectory not yet estimable

- **WHEN** `trajectory` is null
- **THEN** the call-out shows the insufficient-data branch ("Complete at least N sessions to see your pace estimate") with no projected weeks and no pace rate shown
