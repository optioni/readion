# Web Progress Spec

## Purpose

Defines the per-enrollment Progress page that surfaces readiness over time, per-domain scores with deltas, session history, and mastery controls for a single `UserCertification`. Also defines the five-minute spaced-repetition review run loop (queue entry, question-and-confidence loop, completion breakdown) accessed from the Progress page.
## Requirements
### Requirement: Progress data has explicit loading, empty, failure, and refresh states

The Progress page SHALL render structural skeletons for all HTTP-backed summary, chart, domain, and history regions during initial loading. It MUST NOT render zero metrics, empty charts, or history empty states until the corresponding requests succeed. A failed region SHALL show a local error with Retry. Successful data SHALL remain visible during a background refresh.

#### Scenario: Progress initial load does not render synthetic zeroes

- **WHEN** Playwright delays the progress summary and trend requests
- **THEN** the affected stat and chart regions expose `aria-busy="true"` and render skeletons
- **AND** no `0`, empty-chart, or no-history result is presented as loaded data

#### Scenario: Trend failure retries without clearing domain scores

- **WHEN** domain scores succeed and the first trend request fails
- **THEN** the trend region renders an error and Retry while domain scores remain visible
- **AND** activating Retry sends exactly one additional trend request

### Requirement: Quick-review entry distinguishes unresolved, empty, and failure

The quick-review entry page SHALL not initialize its due count to a rendered success value. While the due-count request is pending it SHALL show the review loading presentation and expose `aria-busy="true"`. The caught-up state SHALL render only after a successful response explicitly reports zero due items. A failed request SHALL show an error and Retry.

#### Scenario: Delayed due count does not flash caught up

- **WHEN** Playwright delays the quick-review due-count response
- **THEN** the review loading presentation is visible
- **AND** "You're all caught up" and the start-review action are both absent

#### Scenario: Failed due count is retryable

- **WHEN** the first due-count request fails and Retry succeeds with `dueCount: 5`
- **THEN** the page first shows an error and Retry, never the caught-up state
- **AND** after Retry it shows the five-item queue entry and its start action

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

The progress page SHALL show the activity stat summary — Sessions, Questions answered, Study time, Current streak — under an uppercase **"This month"** section label, with each stat rendered in its own bordered surface card (matching `openspec/design/Progress.html`), not four values sharing a single container. Section headers on the page SHALL show a live count next to the label (e.g. "10 sessions", "Last 6 sessions", "N sessions total"). The page content SHALL use the manifest **`standard`** content width (centered, ~1100px), not a `max-w-[720px]` column.

#### Scenario: Activity stats render under "This month" as bordered cards

- **WHEN** the progress page renders its activity summary
- **THEN** the stats appear under a "This month" section label, each in its own bordered surface card
- **AND** the page content uses the standard content width, not a 720px column

### Requirement: Readiness-over-time and accuracy trend

The page SHALL show a "Readiness over time" chart for the last six months with projection, derived from readiness history snapshots returned by the progress endpoint (including projection logic per SPEC). The chart SHALL match `openspec/design/Progress.html`: compact plotted points connected by a line, a translucent area fill beneath it, human-readable date labels such as "Apr 3", and a dashed projected segment/point when a projected value exists. Labels MUST use bounded chart typography, remain inside the chart container, and remain legible without clipping at 375px and 1440px viewports. The per-domain breakdown keeps its **"Domain scores"** section label.

Below it, the page SHALL show "Recent accuracy" as a compact vertical bar trend using the most recent `accuracyTrend` entries. Matching the design, only the final bar SHALL carry a visible percentage label above it, and every bar SHALL have a compact date caption below it. The chart MUST remain within its content column without creating document-level horizontal overflow.

#### Scenario: Readiness chart shows date labels, area fill, and projection

- **WHEN** progress returns historical snapshots and a projected readiness value
- **THEN** the chart renders connected points with a translucent area fill and human-readable date labels (e.g. "Apr 3"), plus a dashed projected segment and projected point

#### Scenario: Accuracy bars label only the last bar and caption each

- **WHEN** progress returns six accuracy-trend points
- **THEN** six bars render with compact date captions, but only the final bar shows a visible percentage label above it

#### Scenario: Chart labels remain bounded at phone and desktop widths

- **WHEN** Playwright renders the progress charts with six long localized date labels at 375px and 1440px viewports
- **THEN** every visible chart label's bounding box is contained by its chart region
- **AND** no label uses a computed font size larger than the surrounding chart caption style
- **AND** the document has no horizontal overflow

### Requirement: Passive readiness trajectory call-out

The passive readiness trajectory call-out SHALL render at the **bottom of the readiness-over-time section**, directly below the readiness chart and accuracy bars, as a conclusion drawn from the visible trend (matching `openspec/design/Progress.html`) — not at the top of the page before the stats and chart.

#### Scenario: Trajectory call-out sits below the chart

- **WHEN** the progress page renders the trajectory call-out
- **THEN** it appears at the bottom of the readiness section, after the chart and accuracy bars, not before the stat summary

### Requirement: Per-domain scores with deltas

The page SHALL list per-domain scores for the certification. It SHALL render one row per `certification.domains` entry, joining the matching `userCertificationsControllerListWeakAreas` record for the score/accuracy and showing a neutral "no data yet" state for domains the user has not answered. Each domain's recent delta SHALL be derived from the latest completed session summary's `weakAreaDeltas`, shown only when a delta exists. Each domain row SHALL render through the shared domain-score-bar component (`web-domain-scores`): a status-coloured horizontal bar whose width is proportional to the score, the score percentage, and the optional signed trend delta — not a text-only score. Score colour SHALL use the reused `statusColor` helper (`statusColorForScore`), the single source for the band thresholds.

#### Scenario: Domain with weak-area data and a recent delta
- **WHEN** a domain has a weak-area record and appears in the latest summary's `weakAreaDeltas`
- **THEN** its row renders via the shared domain-score-bar with a status-coloured bar sized to the score, the score percentage, and the signed delta (e.g. "↑7%")

#### Scenario: Domain with no answers yet
- **WHEN** a certification domain has no matching weak-area record
- **THEN** its row renders the shared domain-score-bar's neutral "no data yet" state with no bar fill and no delta

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

### Requirement: Session history table

The session history table SHALL list the per-cert sessions, and each row SHALL show the date with the session's **start time-of-day** as a secondary line beneath it (e.g. "3:42 PM"), matching `openspec/design/Progress.html`.

#### Scenario: History rows show time-of-day

- **WHEN** the session history table renders a row
- **THEN** the row shows the date and the session start time-of-day as a secondary line

### Requirement: Five-minute review — queue entry

The five-minute review queue entry SHALL render as a centered, full-bleed hero (matching `openspec/design/QuickReview.html`) — vertically and horizontally centered in the area below the header, without a bordered/backgrounded card wrapper. It SHALL show a rounded accent-tinted **queue icon** above a plain, standalone due-count headline (not a count embedded in a circular avatar badge), the "items due for review" line, the domain breakdown chips (with no "By domain" section label), and the caption "Scheduled by spaced repetition · ~5 minutes". The `ReviewHeader` timer SHALL be a **live countdown** starting at 5:00 that decrements across the session and enters the urgent (red) state near expiry — not a static default.

The queue screen SHALL retain the "Prefer quiz instead?" mode toggle that lets the user choose the self-grade flashcard loop or the quiz + confidence run loop (a speced capability); the artboard depicts only the flashcard loop and does not remove the toggle.

#### Scenario: Queue renders as a centered hero with the icon and caption

- **WHEN** the five-minute review queue entry renders with items due
- **THEN** the content is a centered full-bleed hero with the queue icon above a plain due-count headline
- **AND** the "Scheduled by spaced repetition · ~5 minutes" caption is shown and no "By domain" label precedes the domain chips

#### Scenario: Countdown timer ticks down

- **WHEN** the review session is in progress
- **THEN** the header timer counts down from 5:00 and enters the urgent state near expiry

#### Scenario: Quiz-mode toggle remains available

- **WHEN** the queue entry renders
- **THEN** the "Prefer quiz instead?" toggle is shown, offering the self-grade or quiz+confidence run loop

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

