## MODIFIED Requirements

### Requirement: Readiness-over-time and accuracy trend

The Progress page SHALL render a passive readiness-over-time line and a historical quiz-accuracy chart. Because no time-series endpoint exists, both series SHALL be derived client-side from completed-session summaries (`sessionSummaryControllerSummary.readiness.after` and `.accuracy`) ordered chronologically, in a co-located unit-tested composable. The current readiness value SHALL come from `readinessControllerRead`.

The accuracy chart SHALL render one visible bar per entry in the derived accuracy series (one completed session each), with the most recent session emphasized, matching `openspec/design/Progress.html`. Each bar's drawn height SHALL be proportional to its session `accuracy` and SHALL be visibly non-zero for any positive accuracy (the bar element MUST resolve against a defined chart height, not collapse to zero). The chart SHALL distinguish "no bars because there is genuinely no completed-session accuracy data" from a rendering failure by showing an explicit empty/insufficient-data state only when the series is empty.

#### Scenario: Calibrated enrollment with completed sessions

- **WHEN** the enrollment is calibrated (`readiness.calibrated === true`, `score` non-null) and has multiple completed sessions with summaries
- **THEN** the readiness line plots one point per completed session using each summary's `readiness.after`, ending at the current readiness `score`
- **THEN** the accuracy chart plots one bar per recent completed session using each summary's `accuracy`

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
- **THEN** the trend area shows an early/empty state instead of a fabricated line
