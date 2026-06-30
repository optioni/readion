# Web Progress Spec

## Purpose

Defines the per-enrollment Progress page that surfaces readiness over time, per-domain scores with deltas, session history, and mastery controls for a single `UserCertification`. Also defines the five-minute spaced-repetition review run loop (queue entry, question-and-confidence loop, completion breakdown) accessed from the Progress page.

## Requirements

### Requirement: Progress page is reachable per enrolled certification

The web app SHALL expose a Progress page scoped to a single `UserCertification`, reachable from the app shell navigation and from a certification's detail page. The page header SHALL show the certification code/name, and a cert-switcher SHALL let the user move between their active enrollments and reach "+ Add certification".

#### Scenario: Authenticated user opens the Progress page for an enrollment
- **WHEN** an authenticated user navigates to the Progress route for one of their active enrollments
- **THEN** the page loads readiness, weak-areas, and session-history data for that enrollment via `readinessControllerRead`, `userCertificationsControllerListWeakAreas`, and `sessionsControllerList` (filtered by the enrollment's `certificationId`)
- **THEN** the header shows the certification name/code resolved from `certificationsControllerDetail`

#### Scenario: User switches certification from the cert tabs
- **WHEN** the user selects a different active enrollment from the cert-switcher
- **THEN** the page re-scopes all panels to that enrollment without a full reload (vue-query refetch keyed by enrollment id)
- **THEN** selecting "+ Add certification" routes to the add-certification flow reused from `web-dashboard`

#### Scenario: Opening Progress for an enrollment the user does not own
- **WHEN** the user requests the Progress route for an enrollment id that is not theirs and the API returns 404
- **THEN** the page shows a not-found state and does not leak the existence of the resource

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

### Requirement: Per-domain scores with deltas

The page SHALL list per-domain scores for the certification. It SHALL render one row per `certification.domains` entry, joining the matching `userCertificationsControllerListWeakAreas` record for the score/accuracy and showing a neutral "no data yet" state for domains the user has not answered. Each domain's recent delta SHALL be derived from the latest completed session summary's `weakAreaDeltas`, shown only when a delta exists. Each domain row SHALL render through the shared domain-score-bar component (`web-domain-scores`): a status-coloured horizontal bar whose width is proportional to the score, the score percentage, and the optional signed trend delta — not a text-only score. Score colour SHALL use the reused `statusColor` helper (`statusColorForScore`), the single source for the band thresholds.

#### Scenario: Domain with weak-area data and a recent delta
- **WHEN** a domain has a weak-area record and appears in the latest summary's `weakAreaDeltas`
- **THEN** its row renders via the shared domain-score-bar with a status-coloured bar sized to the score, the score percentage, and the signed delta (e.g. "↑7%")

#### Scenario: Domain with no answers yet
- **WHEN** a certification domain has no matching weak-area record
- **THEN** its row renders the shared domain-score-bar's neutral "no data yet" state with no bar fill and no delta

### Requirement: Mark a concept or domain as mastered

The page SHALL let the user retire a domain from review and new-material selection via `enrollmentReviewControllerSuppressDomain` (domain scope). Within the review run loop, the user SHALL be able to retire a single concept via `reviewItemsControllerMaster`. The UI SHALL reflect the one-way nature of the backend contract: there is no un-suppress / un-master endpoint.

#### Scenario: Mark a domain as mastered from the domain list
- **WHEN** the user clicks "Mark mastered" on a domain row and confirms
- **THEN** the app calls `enrollmentReviewControllerSuppressDomain` with that domain
- **THEN** the affected weak-area/review queries are invalidated and the row reflects the retired state

#### Scenario: No un-retire affordance is offered when the backend cannot reverse it
- **WHEN** a domain has been suppressed
- **THEN** the UI does not present a functional "un-retire" action wired to a non-existent endpoint (any such artboard control is omitted or disabled with explanatory copy)

### Requirement: Session history table

The page SHALL render a session-history table merging study/review sessions (`sessionsControllerList` filtered by `certificationId`) with mock/diagnostic attempts (`enrollmentMockExamControllerList`), most recent first. Per-session Questions, Accuracy, and Readiness-delta columns — absent from the session list DTO — SHALL be populated from `sessionSummaryControllerSummary` for completed rows on the visible page only (bounded fan-out reusing the `recentSessionSummaries` pattern). Rows without a summary (active/abandoned) SHALL show a "—" for those columns.

#### Scenario: Completed study session row
- **WHEN** a completed study session is shown
- **THEN** its row shows date/time, type pill ("Study"/"Review"), duration, and Questions/Accuracy/Readiness-delta from its summary, with accuracy colour from `statusColor`

#### Scenario: Mock attempt row
- **WHEN** a submitted mock or diagnostic attempt exists
- **THEN** it appears in the table with a "Mock"/"Diagnostic" type pill, score, and links into the mock review route via the reused `runnerRoutes` helper

#### Scenario: Session with no summary
- **WHEN** a row is an active or abandoned session with no summary
- **THEN** its Questions/Accuracy/Readiness columns render "—" without blocking the table

### Requirement: Five-minute review — queue entry

The review run loop SHALL open on a queue-entry screen driven by `enrollmentReviewControllerQueue`, showing the due count and a per-domain breakdown of due items, with a primary "Start review" action calling `enrollmentReviewControllerStart`.

#### Scenario: Items are due
- **WHEN** the queue has due items (`meta.dueCount > 0`)
- **THEN** the entry screen shows the due count and the per-domain breakdown derived from the queue items' `domain`
- **THEN** "Start review" calls `enrollmentReviewControllerStart`, which returns `{ status: 'started', session }`, and the loop advances into that `review`-kind session

#### Scenario: Nothing due — all caught up
- **WHEN** `enrollmentReviewControllerStart` returns `{ status: 'all_caught_up' }` (or the queue is empty)
- **THEN** the screen shows an "all caught up" empty state offering a normal study session instead of a review

### Requirement: Five-minute review — question and confidence loop

The review session SHALL be run as the quiz-question loop established by `web-session-view`, not a self-graded flashcard. Each due concept presents a freshly generated quiz question; the user answers and gives a confidence rating (1–5); the answer is submitted via `quizControllerSubmitAnswer` (`{ answer, confidence, timeTakenMs }`). The reused `QuizCard`, `ConfidenceRating`, `CitationChip`, report, and explanation surfaces SHALL be used. In this quiz + confidence mode Leitner scheduling is driven server-side by correctness + confidence; the explicit Again/Hard/Good/Easy self-grade enum is available as the alternative run-loop mode (see "Five-minute review run loop").

#### Scenario: Answering a review question
- **WHEN** the user selects an answer, sets a confidence of 4, and submits
- **THEN** the app calls `quizControllerSubmitAnswer` with `{ answer, confidence: 4, timeTakenMs }` for that question id
- **THEN** the scored result (correct/incorrect + explanation + citation chips) is shown and the loop advances to the next due item

#### Scenario: Reporting a review question
- **WHEN** the user reports the current question
- **THEN** the app calls `quizControllerReportQuestion` and advances without crediting a score, reusing the session-view report affordance

### Requirement: Five-minute review — completion breakdown

On completing the review session, the loop SHALL show a completion screen reusing the `SessionSummaryBody` surface fed by `sessionSummaryControllerSummary` for the review session (accuracy, per-domain breakdown, readiness change). A "drill my misses" action SHALL start a targeted follow-up via the existing drill endpoint, and "Back to dashboard" SHALL return to the home route.

#### Scenario: Review session completes
- **WHEN** the last due item is answered and the review session ends
- **THEN** the completion screen renders the reused `SessionSummaryBody` with the review session's accuracy, domain breakdown, and readiness delta
- **THEN** a "drill my misses" action is offered when the session had misses or unsure answers, and "Back to dashboard" returns home

#### Scenario: Completion breakdown is sourced from the session summary, not a per-rating tally
- **WHEN** rendering the completion breakdown
- **THEN** the figures come from `sessionSummaryControllerSummary` (the real review session) rather than client-side Again/Hard/Good/Easy bucket counts that have no backend source

### Requirement: Five-minute review run loop

The `web-progress` review run loop SHALL render the reveal step's Again / Hard / Good / Easy buttons as real self-grade submissions calling the explicit self-grade endpoint, driving Leitner scheduling, in addition to (or as an alternative mode to) the existing quiz + confidence path. Each grade submits and advances to the next due item; the completion breakdown reflects the graded items.

#### Scenario: Self-grade advances the review loop

- **WHEN** the user reveals a review card and taps `Good`
- **THEN** the self-grade endpoint is called with `grade: good` for that `ReviewItem` and the loop advances to the next due item
- **AND** the completion breakdown counts the item as reviewed
