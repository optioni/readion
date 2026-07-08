## MODIFIED Requirements

### Requirement: Activity stat summary row

The Progress page SHALL render a four-card activity summary at the top of the page — **Sessions**, **Questions answered**, **Study time**, and **Current streak** — matching `openspec/design/Progress.html`. The current page renders only two cards (Sessions, Questions); this requirement establishes the full four-card row.

Because the API exposes no aggregate activity endpoint, every value SHALL be derived client-side from data already loaded for the page (the session list from `sessionsControllerList` filtered by `certificationId`, and the completed-session summaries from `sessionSummaryControllerSummary`), within the same bounded fan-out the page already performs over the most recent sessions page — no backend change and no new endpoint. Specifically:

- **Sessions** — the count of the user's sessions for the enrollment.
- **Questions answered** — the sum of each completed-session summary's `questionsAnswered`.
- **Study time** — the sum of each session's `durationMinutes` (exposed on `SessionResponse`), rendered in a compact `h`/`m` form (e.g. "6h 12m", "58m").
- **Current streak** — the number of consecutive days, ending on the most recent active day, on which at least one session was started, derived from each session's `startedAt` timestamp; rendered with a **singular-aware** day unit ("1 day", "2 days") from the shared singular-aware unit helper — the unit MUST NOT be hardcoded as "days".

The Questions answered / Study time / Current streak cards SHALL always be present in the row (showing a zero/empty value such as "0" or "0m" when there is no data yet), rather than being conditionally hidden.

#### Scenario: Four cards render with derived values

- **WHEN** an enrollment has completed sessions with summaries
- **THEN** the stat row renders four cards labelled "Sessions", "Questions answered", "Study time", and "Current streak"
- **THEN** Sessions shows the session count, Questions answered shows the summed `questionsAnswered` across completed-session summaries, Study time shows the summed `durationMinutes` in `h`/`m` form, and Current streak shows the consecutive-day count derived from session `startedAt` dates

#### Scenario: Current streak uses the singular unit form for one day

- **WHEN** the enrollment's current streak is a single day (one session started on the most recent active day)
- **THEN** the Current streak card reads "1 day" (singular), not "1 days"
- **AND** a two-day streak reads "2 days"

#### Scenario: Study time and current streak are derived client-side

- **WHEN** the read model exposes no dedicated study-time total or streak field
- **THEN** Study time is computed by summing the exposed per-session `durationMinutes` and Current streak by counting consecutive days with at least one session `startedAt`
- **THEN** no backend endpoint or field is assumed beyond the session list and summaries already loaded

#### Scenario: Early enrollment with no completed sessions

- **WHEN** the enrollment has no completed sessions yet
- **THEN** all four cards are still present, with Questions answered, Study time, and Current streak showing zero/empty values rather than being omitted

### Requirement: Readiness-over-time and accuracy trend

The Progress page SHALL render a passive readiness-over-time line and a historical quiz-accuracy chart **composed into one surface card** matching `openspec/design/Progress.html` — the readiness line on top, a divider, and the accuracy bars below — rather than two side-by-side cards. The readiness portion SHALL render an **80% target line** (a dashed reference marker at the readiness target). Because no time-series endpoint exists, both series SHALL be derived client-side from completed-session summaries (`sessionSummaryControllerSummary.readiness.after` and `.accuracy`) ordered chronologically, in a co-located unit-tested composable. The current readiness value SHALL come from `readinessControllerRead`.

The readiness-over-time line SHALL render, matching `openspec/design/Progress.html`, a visible **data point marker per plotted value** (with the most recent point emphasized), **y-axis percentage tick labels**, the **80% target line**, and the **current readiness value as a percentage label** — not a bare polyline. When the enrollment is not yet calibrated, the readiness portion SHALL show a friendly not-yet-calibrated early state — not a flat line with a draggable-looking handle dot that reads as a slider.

The accuracy chart SHALL render one visible bar per entry in the derived accuracy series (one completed session each), with the most recent session emphasized, matching `openspec/design/Progress.html`. Each bar's drawn height SHALL be proportional to its session `accuracy` and SHALL be visibly non-zero for any positive accuracy (the bar element MUST resolve against a defined chart height, not collapse to zero). When the series is empty, the accuracy portion SHALL show a friendly explicit empty/insufficient-data state — not a bare flat line — distinguishing "no bars because there is genuinely no completed-session accuracy data" from a rendering failure.

#### Scenario: Readiness and accuracy compose in one surface card with an 80% target

- **WHEN** the Progress page renders the readiness and accuracy figures
- **THEN** they appear composed in a single surface card — readiness line on top, a divider, accuracy bars below — with a visible 80% target line on the readiness portion
- **AND** they are not rendered as two separate side-by-side cards without a target line

#### Scenario: Calibrated enrollment with completed sessions

- **WHEN** the enrollment is calibrated (`readiness.calibrated === true`, `score` non-null) and has multiple completed sessions with summaries
- **THEN** the readiness line plots one point per completed session using each summary's `readiness.after`, ending at the current readiness `score`
- **THEN** the accuracy chart plots one bar per recent completed session using each summary's `accuracy`

#### Scenario: Readiness line renders points, axis ticks, target line, and the current value

- **WHEN** the readiness series has N plotted values for a calibrated enrollment
- **THEN** the line renders N point markers (one per plotted value) with the most recent point visually emphasized
- **THEN** y-axis percentage tick labels, the 80% target line, and the current readiness value as a percentage label are rendered
- **THEN** the readiness figure is not a bare polyline without points/axis/value

#### Scenario: Accuracy bars are drawn for a non-empty series

- **WHEN** the derived accuracy series has N entries with positive `accuracy` values
- **THEN** the chart renders exactly N bar elements (one per session), each with a visibly non-zero drawn height proportional to its `accuracy`
- **THEN** the bar for the most recent session is visually emphasized relative to the others
- **THEN** the empty/insufficient-data state is not shown

#### Scenario: Friendly low-data empty states, not slider-looking flat lines

- **WHEN** the enrollment is not yet calibrated and the accuracy series is empty
- **THEN** the readiness portion shows a friendly not-yet-calibrated early state and the accuracy portion shows a friendly explicit empty/insufficient-data state
- **THEN** neither portion renders a flat line with a draggable-looking handle dot or a bare flat line that reads as a rendering failure

#### Scenario: Not-yet-calibrated enrollment

- **WHEN** `readiness.calibrated === false` (equivalently `score === null`)
- **THEN** the readiness figure renders as "not yet calibrated" via the reused `readinessFormat` helper rather than a misleading percentage
- **THEN** the trend area shows an early/empty state instead of a fabricated line, points, axis, or value

### Requirement: Session history table

The page SHALL render a session-history table merging study/review sessions (`sessionsControllerList` filtered by `certificationId`) with mock/diagnostic attempts (`enrollmentMockExamControllerList`), most recent first. The table SHALL render a visible **column-header row** — Date, Type, Duration, Questions, Accuracy, Readiness — matching `openspec/design/Progress.html`; the header row MUST NOT be omitted. Per-session Questions, Accuracy, and Readiness-delta columns — absent from the session list DTO — SHALL be populated from `sessionSummaryControllerSummary` for completed rows on the visible page only (bounded fan-out reusing the `recentSessionSummaries` pattern). Rows without a summary (active/abandoned) SHALL show a "—" for those columns. The Date column SHALL render dates in the design's friendly form (e.g. "Today, Jun 23") rather than a raw locale string (e.g. "7.7.2026").

#### Scenario: Table renders a column-header row

- **WHEN** the session-history table renders with at least one row
- **THEN** a column-header row is shown with the headers Date, Type, Duration, Questions, Accuracy, and Readiness

#### Scenario: Completed study session row

- **WHEN** a completed study session is shown
- **THEN** its row shows a friendly-formatted date (e.g. "Today, Jun 23"), a type pill ("Study"/"Review"), duration, and Questions/Accuracy/Readiness-delta from its summary, with accuracy colour from `statusColor`
- **AND** the date is not rendered as a raw locale string like "7.7.2026"

#### Scenario: Mock attempt row

- **WHEN** a submitted mock or diagnostic attempt exists
- **THEN** it appears in the table with a "Mock"/"Diagnostic" type pill, score, and links into the mock review route via the reused `runnerRoutes` helper

#### Scenario: Session with no summary

- **WHEN** a row is an active or abandoned session with no summary
- **THEN** its Questions/Accuracy/Readiness columns render "—" without blocking the table
