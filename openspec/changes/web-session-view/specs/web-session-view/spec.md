## ADDED Requirements

### Requirement: Session start screen offers a one-tap quick start from saved defaults

The web app SHALL provide a minimal-chrome session-start route for an enrollment (no app sidebar / dashboard chrome) whose default mode is **Quick start**. Quick start MUST display the user's saved session defaults (duration, content mix, difficulty, learning style) as a read-only summary and a **Start session** action. Pressing Start MUST create a session via `POST /api/v1/user-certifications/:enrollmentId/sessions` with an **empty override body**, so the server applies the saved profile defaults, and on success MUST route to the session view for the returned session id. The screen MUST also offer a "Customise this session" affordance that switches to the custom-config mode.

#### Scenario: Quick start shows saved defaults and starts a session

- **WHEN** an authenticated user opens the session-start screen for an active enrollment whose saved defaults are 30 min / balanced / intermediate / weak-area-focus
- **THEN** the quick-start card shows those four defaults as a summary
- **AND** pressing "Start session" sends `POST /api/v1/user-certifications/:enrollmentId/sessions` with an empty body
- **AND** on a 201 response the app navigates to the session view for the returned session id

#### Scenario: Customise switches to the config mode

- **WHEN** the user presses "Customise this session" on the quick-start card
- **THEN** the custom-config mode is shown with the domain-focus picker and session-setting overrides
- **AND** a "Use defaults instead" affordance is available to return to quick start

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

The session view SHALL render a split-panel layout: study content (reading blocks and quiz cards) on the left and the AI agent chat on the right, both visible by default. The agent panel MUST be collapsible to a narrow rail to maximise content width and re-expandable. The session view MUST load the session and its items via `GET /api/v1/sessions/:id?include=items`.

#### Scenario: Split panel is shown with both columns

- **WHEN** the user opens the session view for an active session
- **THEN** the left column renders the session content and the right column renders the agent panel

#### Scenario: Agent panel collapses and expands

- **WHEN** the user collapses the agent panel
- **THEN** the agent panel shrinks to a rail and the content column widens
- **AND** re-expanding restores the full agent panel

### Requirement: Session header shows a live timer, progress, and end-session control

The session view header SHALL display the certification code/name, a live elapsed timer derived client-side from the session `startedAt`, a progress indicator of completed items over total items (`lastItemIndex` / item count), and a progress bar. It MUST provide an **End session** control that calls `POST /api/v1/sessions/:id/end` and, on success, navigates to the summary screen for the session.

#### Scenario: Timer and progress render

- **WHEN** an active session with 12 items and `lastItemIndex` 3 is open
- **THEN** the header shows a 3/12 progress indicator with a corresponding progress bar and an elapsed timer counting up from `startedAt`

#### Scenario: End session ends and routes to summary

- **WHEN** the user presses End session
- **THEN** `POST /api/v1/sessions/:id/end` is called and on success the app navigates to the session summary screen

### Requirement: Reading blocks render Markdown TL;DR with go-deeper expansion and citation chips

A reading-block item SHALL render its `content` as Markdown (the LLM-formatted TL;DR), labelled with the item's domain. It MUST provide a "Read full explanation" affordance that calls `POST /api/v1/sessions/:id/items/:index/go-deeper` and renders the returned `expandedContent` Markdown inline; once expanded the affordance MUST NOT re-fetch. It MUST render source citation chips derived from the item's provenance (`supportingSpans` / `sourceChunkIds`). Advancing past a reading block MUST mark it complete via `POST /api/v1/sessions/:id/items/:index/complete`.

#### Scenario: TL;DR renders and expands on demand

- **WHEN** a reading block is shown and the user presses "Read full explanation"
- **THEN** `POST /api/v1/sessions/:id/items/:index/go-deeper` is called and the returned `expandedContent` is rendered as Markdown below the TL;DR
- **AND** pressing it again does not trigger a second request

#### Scenario: Citation chips render from provenance

- **WHEN** a reading block carries `supportingSpans` and `sourceChunkIds`
- **THEN** the block renders one citation chip per cited source

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

A quiz-card item SHALL render its parsed question stem and options and let the user select one option. Before submission the user MUST set a confidence rating (1–5). Submitting MUST call `POST /api/v1/quiz/:questionId/submit` with `{ userCertificationId, answer, confidence, timeTakenMs }`, where `timeTakenMs` is measured client-side from when the card was shown. After submission the card MUST reflect the result: the chosen option is coloured correct (good) or incorrect (poor) per the `correct` boolean, and a Continue affordance advances to the next item and marks the current item complete.

#### Scenario: Answer submitted with confidence and timing

- **WHEN** the user selects option B, sets confidence 4, and submits after 9 seconds
- **THEN** `POST /api/v1/quiz/:questionId/submit` is called with `answer: "B"`, `confidence: 4`, and a `timeTakenMs` near 9000

#### Scenario: Correct and incorrect states colour the chosen option

- **WHEN** the submit response returns `correct: true`
- **THEN** the chosen option is shown in the good (correct) status colour
- **WHEN** the submit response returns `correct: false`
- **THEN** the chosen option is shown in the poor (incorrect) status colour

### Requirement: Confidence rating is required and uses a 1–5 scale

Each quiz card SHALL expose a five-point confidence control (1 = not at all, 5 = very confident). The submit action MUST be disabled until both an option and a confidence value are chosen, guaranteeing the `confidence` field sent to the API is an integer in 1–5.

#### Scenario: Submit is gated on option and confidence

- **WHEN** an option is selected but no confidence value is set
- **THEN** the submit action is disabled
- **WHEN** both an option and a confidence value (3) are set
- **THEN** the submit action is enabled and sends `confidence: 3`

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

On session completion the summary screen SHALL fetch `GET /api/v1/sessions/:id/summary` and render: questions answered and accuracy; per-domain accuracy (`domains[]`); weak-area score deltas (`weakAreaDeltas[]`); the readiness change (`readiness.before` → `readiness.after` with `readiness.delta`); the strongest and weakest question (`strongestQuestion` / `weakestQuestion`), each with an "Ask agent about this" action; and the suggested next focus (`nextFocus.domain`). Where `readiness.before/after/delta` are null (not yet calibrated) the screen MUST show a calibration message instead of a percentage change. Fields the summary contract does not provide (per-domain question counts, weak-area absolute before/after values, a miss count, a streak) MUST NOT be fabricated.

#### Scenario: Summary renders accuracy, deltas, and readiness change

- **WHEN** the summary returns accuracy 0.67, domains for IAM/Networking, weak-area deltas, and `readiness { before: 72, after: 75, delta: 3 }`
- **THEN** the screen shows the accuracy, per-domain accuracy rows, weak-area delta badges, and a "72% → 75% (+3%)" readiness change

#### Scenario: Uncalibrated readiness shows a calibration message

- **WHEN** the summary returns `readiness` with null before/after/delta
- **THEN** the readiness section shows a not-yet-calibrated message rather than a percentage change

### Requirement: Drill-my-misses starts a targeted session or reports no misses

The summary screen SHALL provide a primary **Drill my misses** action that calls `POST /api/v1/sessions/:id/drill`. When the response `status` is `started` the app MUST navigate to the session view for the returned drill `session`. When `status` is `no_misses` the action MUST report that there are no misses to drill rather than navigating. The screen MUST also offer a secondary "Back to dashboard" action.

#### Scenario: Drill starts a new targeted session

- **WHEN** the user presses Drill my misses and the API responds `{ status: "started", session: {...} }`
- **THEN** the app navigates to the session view for the returned drill session

#### Scenario: No misses reports nothing to drill

- **WHEN** the API responds `{ status: "no_misses" }`
- **THEN** the screen shows a "no misses to drill" message and does not navigate to a new session
