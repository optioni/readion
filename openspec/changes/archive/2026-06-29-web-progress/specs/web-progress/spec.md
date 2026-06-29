## ADDED Requirements

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

### Requirement: Readiness-over-time and accuracy trend

The Progress page SHALL render a passive readiness-over-time line and a historical quiz-accuracy chart. Because no time-series endpoint exists, both series SHALL be derived client-side from completed-session summaries (`sessionSummaryControllerSummary.readiness.after` and `.accuracy`) ordered chronologically, in a co-located unit-tested composable. The current readiness value SHALL come from `readinessControllerRead`.

#### Scenario: Calibrated enrollment with completed sessions
- **WHEN** the enrollment is calibrated (`readiness.calibrated === true`, `score` non-null) and has multiple completed sessions with summaries
- **THEN** the readiness line plots one point per completed session using each summary's `readiness.after`, ending at the current readiness `score`
- **THEN** the accuracy chart plots one bar per recent completed session using each summary's `accuracy`

#### Scenario: Not-yet-calibrated enrollment
- **WHEN** `readiness.calibrated === false` (equivalently `score === null`)
- **THEN** the readiness figure renders as "not yet calibrated" via the reused `readinessFormat` helper rather than a misleading percentage
- **THEN** the trend area shows an early/empty state instead of a fabricated line

### Requirement: Passive readiness trajectory call-out

The page SHALL show the passive trajectory projection only when the backend provides it. The projection text SHALL be informational ("at your recent pace, exam-ready in ~N weeks") with no dates and no reminders.

#### Scenario: Trajectory available
- **WHEN** `readinessControllerRead` returns `trajectory: { weeksToReady }` (non-null)
- **THEN** the call-out renders "exam-ready in approximately {weeksToReady} weeks"

#### Scenario: Trajectory not yet estimable
- **WHEN** `trajectory` is null
- **THEN** the call-out is hidden and replaced by an insufficient-history hint, with no projected weeks shown

### Requirement: Per-domain scores with deltas

The page SHALL list per-domain scores for the certification. It SHALL render one row per `certification.domains` entry, joining the matching `userCertificationsControllerListWeakAreas` record for the score/accuracy and showing a neutral "no data yet" state for domains the user has not answered. Each domain's recent delta SHALL be derived from the latest completed session summary's `weakAreaDeltas`, shown only when a delta exists. Score colour SHALL use the reused `statusColor` helper.

#### Scenario: Domain with weak-area data and a recent delta
- **WHEN** a domain has a weak-area record and appears in the latest summary's `weakAreaDeltas`
- **THEN** its row shows the status-coloured score bar and the signed delta (e.g. "↑7%")

#### Scenario: Domain with no answers yet
- **WHEN** a certification domain has no matching weak-area record
- **THEN** its row renders a neutral "no data yet" state with no delta

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

The review session SHALL be run as the quiz-question loop established by `web-session-view`, not a self-graded flashcard. Each due concept presents a freshly generated quiz question; the user answers and gives a confidence rating (1–5); the answer is submitted via `quizControllerSubmitAnswer` (`{ answer, confidence, timeTakenMs }`). The reused `QuizCard`, `ConfidenceRating`, `CitationChip`, report, and explanation surfaces SHALL be used. There is no Again/Hard/Good/Easy rating enum — Leitner scheduling is driven server-side by correctness + confidence.

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
