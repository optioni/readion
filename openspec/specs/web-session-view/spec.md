## Purpose

Defines the web UI for starting and conducting a study session: the session-start screen (quick start and custom config modes), the in-session split-panel view (content + AI agent), and the post-session summary screen.
## Requirements
### Requirement: Session creation and resume expose action-local progress

Quick start and custom start SHALL expose the same shared busy behavior while creating or resolving a session. The initiating control SHALL show a spinner and "Starting…", expose `aria-busy="true"`, retain its dimensions, and reject duplicate activation. When an existing active session is resumed, busy feedback SHALL remain until navigation begins. A failure SHALL keep the selected configuration intact and return the control to an enabled retryable state.

#### Scenario: Custom start preserves configuration after failure

- **WHEN** the user selects two domains and a 30-minute duration, activates Start session, and the request fails
- **THEN** the button shows "Starting…" only while pending and sends no duplicate request
- **AND** after failure the two domains and 30-minute duration remain selected, an error is shown, and Start session is enabled

#### Scenario: Quick start remains busy until resumed-session navigation

- **WHEN** Quick start resolves to an existing active session after a delayed response
- **THEN** Quick start exposes `aria-busy="true"` and "Starting…" until navigation begins
- **AND** exactly one create/resume request is sent

### Requirement: Remote reading expansion exposes loading and recovery

When "Read full explanation" requires remote material, the initiating control SHALL show a spinner and "Loading…", expose `aria-busy="true"`, and reject duplicate activation. Existing TL;DR content and citations MUST remain visible. On failure the content SHALL show an inline error with a Retry action; on success the expanded Markdown SHALL replace the progress feedback without moving keyboard focus unexpectedly.

#### Scenario: Full explanation loads without hiding the reading block

- **WHEN** the user activates "Read full explanation" and the response is delayed
- **THEN** the existing TL;DR and citations remain visible
- **AND** the control shows a spinner with "Loading…" and repeated activation sends no duplicate request

#### Scenario: Full explanation can be retried

- **WHEN** the first explanation request fails and the retry succeeds
- **THEN** an inline error and Retry are rendered without removing the TL;DR
- **AND** activating Retry once sends one new request and replaces the error with the expanded Markdown

### Requirement: Session start screen offers a one-tap quick start from saved defaults

The session-start screen SHALL offer a one-tap quick start from the saved session defaults. Above the start card it SHALL render a **cert identity pill** showing the certification's mono code and full name (sourced for the enrollment), so the user confirms which certification the session is for. The defaults summary SHALL render **humanized labels** via the shared value→label map (e.g. content mix, difficulty, learning style), never raw enum slugs.

#### Scenario: Cert identity pill and humanized defaults render

- **WHEN** the session-start screen renders for an enrollment
- **THEN** a cert identity pill with the cert code and full name is shown above the start card
- **AND** the defaults summary values render as humanized labels, not raw enum slugs

### Requirement: Quick start surfaces the suggested weak domain

Quick start SHALL display a suggested-focus banner naming the enrollment's weakest domain and its score, sourced from `GET /api/v1/user-certifications/:id/weak-areas` (the lowest-scoring domain). The banner MUST communicate that the session will prioritise that domain. When no weak-area data exists yet for the enrollment, the banner MUST be omitted rather than rendered empty, and quick start MUST still start a session.

#### Scenario: Weakest domain is suggested

- **WHEN** the enrollment's weak areas are IAM 45%, Networking 43%, and Storage 71%
- **THEN** the quick-start banner names Networking (43%) as the prioritised weakest domain

#### Scenario: No weak-area data hides the banner

- **WHEN** the enrollment has no weak-area data yet
- **THEN** no suggested-focus banner is shown and the Start action still creates a session

### Requirement: Custom config exposes a domain-focus picker and override controls bound to the real session contract

The custom-config mode SHALL present a multi-select domain-focus picker listing the certification's domains (from `GET /api/v1/certifications/:id`), each annotated with the user's weak-area score and status colour, plus select-all / clear controls and a selected-count. It SHALL also present override controls for **duration** (15 / 30 / 60 / 90 min), **content mix** (Balanced / Reading-heavy / Quiz-heavy / Video-based), **difficulty** (Beginner / Intermediate / Exam-ready), and **learning style** (Weak-area focus / Spaced repetition / Cram). Control options MUST be exactly the values accepted by `createSessionRequestSchema`; the artboard's placeholder labels (e.g. "Adaptive" difficulty, "5m/45m" durations, "Questions/Concepts" mix) MUST NOT be offered, since they are not valid backend values.

#### Scenario: Domain picker lists cert domains with weak scores

- **WHEN** the custom-config mode opens for a cert with seven domains
- **THEN** all seven domains are listed as toggles, each showing its weak-area score with the status colour, plus a "N of 7 selected" count and select-all / clear controls

#### Scenario: Override controls offer only contract-valid values

- **WHEN** the override controls render
- **THEN** duration offers 15 / 30 / 60 / 90, content mix offers Balanced / Reading-heavy / Quiz-heavy / Video-based, difficulty offers Beginner / Intermediate / Exam-ready, and learning style offers Weak-area focus / Spaced repetition / Cram

### Requirement: Custom config creates a session with the selected overrides

Starting from custom config SHALL `POST /api/v1/user-certifications/:enrollmentId/sessions` with a body carrying only the user's chosen overrides. When one or more domains are selected the `focusArea` MUST be `{ mode: "domains", domains: [...] }`; when none are selected it MUST be `{ mode: "auto" }`. On success the app MUST navigate to the session view for the returned session id.

#### Scenario: Selected domains produce a domains focus area

- **WHEN** the user selects IAM and Networking, sets duration 60 and difficulty exam-ready, and presses Start
- **THEN** the request body includes `durationMinutes: 60`, `difficulty: "exam-ready"`, and `focusArea: { mode: "domains", domains: ["IAM", "Networking"] }`

#### Scenario: No domains selected produces an auto focus area

- **WHEN** the user clears all domains and presses Start
- **THEN** the request body's `focusArea` is `{ mode: "auto" }`

### Requirement: Starting a session resumes an existing active session instead of creating a duplicate

Because the backend enforces at most one `active` session per enrollment, the start flow SHALL treat a 200 response from the create call (an existing active session returned) the same as a 201 and navigate to that session's view. The UI MUST NOT create or imply a second concurrent session.

#### Scenario: Existing active session is resumed

- **WHEN** the user presses Start and the API responds 200 with an already-active session for the enrollment
- **THEN** the app navigates to that returned session's view rather than reporting an error or creating a new session

### Requirement: Session view renders a split panel with a collapsible agent

The session view SHALL render within the **app shell** (the global sidebar with `Sessions` active), matching `openspec/design/Session.html` and the design manifest — not the bare `minimal` layout. The content SHALL be the split panel of reading/quiz items on the left and a collapsible agent panel on the right. When the agent panel is collapsed it SHALL show a chat-bubble icon and a vertical "Ask AI" label alongside the expand control (not only a bare toggle arrow). The agent panel header SHALL show an online-status dot next to "Study assistant", and each non-user bubble SHALL render a per-message sparkle avatar.

#### Scenario: Session renders inside the app shell

- **WHEN** a session view renders
- **THEN** the global app sidebar is present with `Sessions` active, wrapping the reading/quiz + agent split

#### Scenario: Collapsed agent panel shows an icon and label

- **WHEN** the agent panel is collapsed
- **THEN** it shows a chat-bubble icon and a vertical "Ask AI" label alongside the expand control

### Requirement: Session header shows a live timer, progress, and end-session control

The session view header SHALL display the certification code/name, an elapsed timer, a progress indicator of completed items over total items (`lastItemIndex` / item count), and a progress bar. For an **active** session (`status` `active`, `endedAt` null) the timer MUST count up live client-side from the session `startedAt`, and the header MUST provide an **End session** control that calls `POST /api/v1/sessions/:id/end` and, on success, navigates to the summary screen.

For an **ended** session (`status` of `completed`, `partial`, or `abandoned`) the session view MUST NOT render the active runner: it MUST NOT show a running or uncapped timer, MUST NOT expose an "End session" or "Continue" control, and MUST instead route to the session summary (`sessionSummaryPath(:id)`) or present a read-only completed state. Any elapsed time displayed for an ended session MUST be **frozen at `endedAt − startedAt`** and MUST NOT increase over time; it MUST NEVER be computed as `now − startedAt`.

#### Scenario: Active session timer counts up and can be ended

- **WHEN** an active session with 12 items and `lastItemIndex` 3 is open
- **THEN** the header shows a 3/12 progress indicator with a corresponding progress bar and an elapsed timer counting up from `startedAt`
- **AND** pressing "End session" calls `POST /api/v1/sessions/:id/end` and on success navigates to the session summary screen

#### Scenario: Completed session does not show a free-running timer

- **WHEN** a session with `status: "completed"`, a `startedAt` ~49 hours before now, and an `endedAt` 20 minutes after `startedAt` is opened at `/sessions/:id`
- **THEN** no free-running or uncapped timer is shown (no value such as "2910:42"); any displayed time is frozen at `endedAt − startedAt` (~"20:34") and does not change across ticks
- **AND** no "End session" or "Continue" control is rendered

#### Scenario: Ended session routes away from the active runner

- **WHEN** a session whose `status` is `completed`, `partial`, or `abandoned` is opened in the session view
- **THEN** the active runner (reading/quiz card with interactive controls) is not rendered
- **AND** the view routes to the session summary or shows a read-only completed state

### Requirement: Reading blocks render Markdown TL;DR with go-deeper expansion and citation chips

A reading-block item SHALL render its `content` as Markdown (the LLM-formatted TL;DR). It MUST provide a "Read full explanation" affordance that calls `POST /api/v1/sessions/:id/items/:index/go-deeper` and renders the returned `expandedContent` Markdown inline; once expanded the affordance MUST NOT re-fetch. It MUST render source citation chips derived from the item's provenance (`supportingSpans` / `sourceChunkIds`), and each chip MUST display a **human-readable source label**. A raw content-chunk id/UUID MUST NEVER be used as a chip label; when no human title can be resolved for a `sourceChunkId` the chip MUST fall back to a generic "Source" label rather than exposing the id. Advancing past a reading block MUST mark it complete via `POST /api/v1/sessions/:id/items/:index/complete`. The block SHALL render a **domain label** (e.g. "IAM & Security") beside the "Reading" pill, sourced from the item's persisted `domain` field (`SessionItemResponse.domain`) — this supersedes the prior deferred note; the domain is now real per-item data, not a placeholder.

#### Scenario: TL;DR renders and expands on demand

- **WHEN** a reading block is shown and the user presses "Read full explanation"
- **THEN** `POST /api/v1/sessions/:id/items/:index/go-deeper` is called and the returned `expandedContent` is rendered as Markdown below the TL;DR
- **AND** pressing it again does not trigger a second request

#### Scenario: Citation chips show human labels, never raw chunk ids

- **WHEN** a reading block carries `sourceChunkIds` containing a raw UUID and `supportingSpans`
- **THEN** the block renders one citation chip per cited source with a human-readable label
- **AND** no chip label is a raw content-chunk UUID

#### Scenario: Reading block shows its domain label

- **WHEN** a reading block item with a non-empty `domain` renders
- **THEN** its domain is shown as a label beside the "Reading" pill

### Requirement: Session items are parsed by type and insufficient quiz items are skippable

The session view SHALL interpret each item's `content` by its `type`: a `reading` item's `content` is rendered as Markdown, while a `quiz` item's `content` is a JSON string the app MUST parse into either `{ questionId, question, options, format }` or `{ insufficient: true, domain }`. The parsed `questionId` MUST be used as the quiz submission target. An item parsed as `insufficient` MUST render a graceful "this question is unavailable" card that can be marked complete and advanced past, never an empty or broken quiz card.

#### Scenario: Quiz item content is parsed for the question id

- **WHEN** a quiz item's `content` is `{"questionId":"q-123","question":"...","options":["A","B"],"format":"multiple_choice"}`
- **THEN** the card renders the question and options and submits to `POST /api/v1/quiz/q-123/submit`

#### Scenario: Insufficient quiz item is skippable

- **WHEN** a quiz item's `content` parses to `{ insufficient: true, domain: "Networking" }`
- **THEN** an unavailable-question card is shown that the user can mark complete and advance past
- **AND** no submit request is made for it

### Requirement: Quiz cards capture an answer with a confidence rating and show a scored result

A quiz-card item SHALL render, beside its "Question" pill, a **"Q n of m"** position label (the item's 1-based position out of the total item count). It SHALL render its parsed question stem and options and let the user select one option. Before submission the user MUST set a confidence rating (1–5). Submitting MUST call `POST /api/v1/quiz/:questionId/submit` with `{ userCertificationId, answer, confidence, timeTakenMs }`, where `timeTakenMs` is measured client-side from when the card was shown. After submission the card MUST reflect the result: the chosen option is coloured correct (good) or incorrect (poor) per the `correct` boolean, and a Continue affordance advances to the next item and marks the current item complete.

#### Scenario: Quiz card shows its position label

- **WHEN** the quiz card is shown as the 3rd of 12 items
- **THEN** a "Q 3 of 12" label is rendered beside the "Question" pill

#### Scenario: Answer submitted with confidence and timing

- **WHEN** the user selects option B, sets confidence 4, and submits after 9 seconds
- **THEN** `POST /api/v1/quiz/:questionId/submit` is called with `answer: "B"`, `confidence: 4`, and a `timeTakenMs` near 9000

#### Scenario: Correct and incorrect states colour the chosen option

- **WHEN** the submit response returns `correct: true`
- **THEN** the chosen option is shown in the good (correct) status colour
- **WHEN** the submit response returns `correct: false`
- **THEN** the chosen option is shown in the poor (incorrect) status colour

### Requirement: Confidence rating is required and uses a 1–5 scale

Quiz cards SHALL require a confidence rating on a 1–5 scale before the answer is submitted (rate-then-submit) — the Submit control stays disabled until an option and a confidence value are both chosen. This gating is deliberate and is NOT changed to the artboard's submit-then-rate ordering. The confidence prompt SHALL interpolate the item's topic/domain (e.g. "How confident do you feel about **IAM & SCPs**?"), sourced from the item's persisted `domain` field, not a generic prompt.

#### Scenario: Confidence is required before submit with a topic-specific prompt

- **WHEN** a quiz card renders in the answering state
- **THEN** the confidence prompt names the item's topic/domain
- **AND** Submit remains disabled until both an option and a 1–5 confidence value are selected

### Requirement: Quiz cards expose a report-this-question action

Each quiz card and its explanation SHALL provide a "Report this question" action that calls `POST /api/v1/quiz/:questionId/report` with `{ userCertificationId, reason }`, and on success (204) MUST acknowledge the report in the UI. This routes the item to quarantine on the backend.

#### Scenario: Reporting a question quarantines it

- **WHEN** the user reports a question with a reason
- **THEN** `POST /api/v1/quiz/:questionId/report` is called and a confirmation is shown on the 204 response

### Requirement: Session resumes from the last incomplete item

On opening an `active` session the view SHALL position the learner at the first incomplete item using `lastItemIndex` and per-item `completed` flags from `GET /api/v1/sessions/:id?include=items`, so a refresh or navigation away returns the learner to where they left off rather than the start.

#### Scenario: Returning resumes at the saved index

- **WHEN** the user reopens an active session whose `lastItemIndex` is 5 with items 0–4 completed
- **THEN** the view renders item 5 as the current item rather than item 0

### Requirement: In-session agent panel streams turns over SSE

The agent panel SHALL ensure an in-session conversation exists by calling `POST /api/v1/sessions/:id/agent-conversations` and, on the first open, hydrate prior messages via `GET /api/v1/agent-conversations/:id?include=messages`. Sending a message MUST stream the assistant turn from `POST /api/v1/agent-conversations/:id/messages` using the `web-foundation` SSE composable, appending text deltas as they arrive and terminating on the `[DONE]` sentinel. A stream `error` event MUST surface an inline error in the conversation without crashing the panel.

#### Scenario: Sending a message streams a response

- **WHEN** the user sends "Why use an SCP here?" in the agent panel
- **THEN** an in-session conversation is created if absent and the message is posted to `POST /api/v1/agent-conversations/:id/messages`
- **AND** assistant text deltas render incrementally until the `[DONE]` sentinel ends the turn

#### Scenario: Stream error is shown inline

- **WHEN** the SSE stream emits an `error` event mid-turn
- **THEN** an error indicator is shown in the conversation and the panel remains usable for the next message

### Requirement: Agent tool results render as formatted UI components by tool name

The agent panel SHALL inspect each `tool-result` stream part and render a dedicated component keyed on the tool name rather than printing raw tool output, per the Agent Tool Result Rendering contract: `getUserProgress` → mini domain-score bars with a readiness chip; `getSessionHistory` → a compact recent-sessions list with domain and accuracy; `explainAnswer` → an explanation card with the correct answer highlighted and a citation chip; `examStrategy` → a distinct tip card; `fetchMoreMaterial` → fast path renders expanded content inline, slow path renders a "Fetching more content…" loading state then a "job enqueued" chip then a "new material ready" chip when the job-completion event arrives over SSE. `semanticSearch` results MUST NOT be rendered (internal lookup only).

#### Scenario: getUserProgress renders score bars

- **WHEN** a `tool-result` part for `getUserProgress` arrives
- **THEN** a progress component with per-domain score bars and a readiness percentage chip is rendered inline, not the raw tool payload

#### Scenario: explainAnswer renders a citation card

- **WHEN** a `tool-result` part for `explainAnswer` arrives
- **THEN** an explanation card is rendered with the correct answer highlighted and at least one citation chip

#### Scenario: fetchMoreMaterial slow path shows job progress

- **WHEN** a `fetchMoreMaterial` slow-path tool result is received and a later `job-event` with status `completed` arrives over SSE
- **THEN** the panel shows a loading state, then a "job enqueued" chip, then a "new material ready" chip

#### Scenario: semanticSearch is not rendered

- **WHEN** a `tool-result` part for `semanticSearch` arrives
- **THEN** no tool card is rendered for it and only the agent's resulting text response is shown

### Requirement: End-of-session summary screen renders the session outcome

The end-of-session summary SHALL render the session outcome, matching `openspec/design/Summary.html` for the fields the summary DTO carries. The readiness-change bar SHALL render the inset gradient fill plus a directional arrow marker (not a flat empty spacer). The header timestamp SHALL be a right-aligned relative label ("Today at h:mm A") opposite the title block. The content SHALL use the standard content width, and the Drill-my-misses CTA SHALL show its leading play icon. The streak stat SHALL remain the real day-streak metric (a "sessions in a row" count is a different metric and is not adopted).

#### Scenario: Readiness bar, timestamp, and drill CTA match the design

- **WHEN** the summary renders
- **THEN** the readiness-change bar shows a gradient fill and directional arrow
- **AND** the header timestamp is a right-aligned "Today at h:mm A" label and the Drill-my-misses CTA shows its leading icon

### Requirement: Drill-my-misses starts a targeted session or reports no misses

The summary screen SHALL provide a primary **Drill my misses** action that calls `POST /api/v1/sessions/:id/drill`. When the response `status` is `started` the app MUST navigate to the session view for the returned drill `session`. When `status` is `no_misses` the action MUST report that there are no misses to drill rather than navigating. The screen MUST also offer a secondary "Back to dashboard" action.

#### Scenario: Drill starts a new targeted session

- **WHEN** the user presses Drill my misses and the API responds `{ status: "started", session: {...} }`
- **THEN** the app navigates to the session view for the returned drill session

#### Scenario: No misses reports nothing to drill

- **WHEN** the API responds `{ status: "no_misses" }`
- **THEN** the screen shows a "no misses to drill" message and does not navigate to a new session

### Requirement: Summary shows a zero-state when no questions were answered

When the fetched summary reports `questionsAnswered === 0`, the summary screen SHALL render an explicit "no questions answered this session" empty state and MUST suppress the accuracy, readiness-delta, weak-area, and domains-covered cards rather than rendering misleading zeros ("ACCURACY 0% · 0/0", "READINESS +0% 19%→19%", weak areas "↑0%", an empty "Domains covered" box). The page header and the secondary "Back to dashboard" action MUST still render.

#### Scenario: Completed session with no answered questions

- **WHEN** the summary returns `questionsAnswered: 0`
- **THEN** an explicit "no questions answered this session" message is shown
- **AND** the accuracy, readiness-delta, weak-area, and domains cards are not rendered (no "0% / +0% / ↑0%" values)
- **AND** the "Back to dashboard" action remains available

### Requirement: Summary renders a dedicated readiness-change strip

The summary SHALL present the readiness change as a dedicated before → after strip: the `readiness.before` value, a visual connector, the `readiness.after` value, and the signed `readiness.delta` badge ("this session"). The strip MUST be sourced solely from `readiness.before/after/delta` and MUST show the not-yet-calibrated message when those values are null.

#### Scenario: Readiness strip shows before → after with delta

- **WHEN** the summary returns `readiness { before: 72, after: 75, delta: 3 }`
- **THEN** a readiness strip shows "72%", a connector, "75%", and a "↑3%" delta badge

#### Scenario: Uncalibrated readiness strip shows calibration message

- **WHEN** the summary returns `readiness` with null before/after/delta
- **THEN** the readiness strip shows the not-yet-calibrated message instead of a before → after change

### Requirement: Summary stat strip includes a streak stat sourced from real data

The summary stat strip SHALL, matching the design's four stat cells, include a **Streak** stat alongside the accuracy, readiness, and time stats. The streak value MUST be sourced from the enrollment's existing streak signal (the same data the Progress surface's "Current streak" uses) and MUST NOT be fabricated from the summary payload, which does not carry a streak. When no streak signal is available the stat cell MUST be omitted rather than showing a placeholder or zero.

#### Scenario: Streak stat renders when available

- **WHEN** the enrollment has a current streak of 4 sessions and the summary is shown
- **THEN** the stat strip includes a "Streak" cell showing 4

#### Scenario: Streak stat is omitted when unavailable

- **WHEN** no streak signal is available for the enrollment
- **THEN** no fabricated streak value is shown; the streak stat cell is omitted

