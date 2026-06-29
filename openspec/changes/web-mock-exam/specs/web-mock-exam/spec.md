## ADDED Requirements

### Requirement: Mock-exam page renders a full-screen, agent-free surface keyed on generation and status

The web app SHALL provide a route at `/mock-exams/:id` that loads the attempt via `GET /api/v1/mock-exams/:id` and renders a full-screen, minimal-chrome experience with **no app sidebar and no AI agent panel** (a mock exam is agent-free). The view MUST select its scene from the attempt's `generation` (`preparing` | `ready`) and `status` (`in_progress` | `submitted` | `expired`): a **preparing** scene while `generation === 'preparing'`, an **active exam** scene while `generation === 'ready'` and `status === 'in_progress'`, and a **results/review** scene when `status` is `submitted` or `expired`.

#### Scenario: Agent-free full-screen layout

- **WHEN** an authenticated user opens `/mock-exams/:id` for any of their attempts
- **THEN** the page renders on a minimal-chrome full-screen layout with no app navigation sidebar and no agent chat panel

#### Scenario: Scene is chosen from generation and status

- **WHEN** the attempt has `generation: "preparing"`
- **THEN** the preparing scene is shown
- **WHEN** the attempt has `generation: "ready"` and `status: "in_progress"`
- **THEN** the active exam scene is shown
- **WHEN** the attempt has `status: "submitted"` or `status: "expired"`
- **THEN** the results scene is shown

### Requirement: Preparing scene streams generated questions into the nav sidebar with the timer paused

While `generation === 'preparing'` the page SHALL show a "Preparing your exam" scene and **poll `GET /api/v1/mock-exams/:id`** on an interval until `generation` becomes `ready`. As each verified question streams in, the question-nav sidebar MUST reflect the growing `questions[]` count with a "N / total ready" progress indicator. The wall-clock timer MUST be shown as paused/placeholder because the contract returns `deadline` and `remainingSeconds` as `null` until the full verified set is ready. When `generation` flips to `ready`, the page MUST transition to the active exam scene without a full reload.

#### Scenario: Questions stream into the nav as they are verified

- **WHEN** the attempt is `preparing` and successive polls of `GET /api/v1/mock-exams/:id` return `questions` of length 20, then 43, then 65 of a 65-question exam
- **THEN** the nav sidebar progress shows "20 / 65 ready", then "43 / 65 ready", then "65 / 65 ready"
- **AND** the timer is shown paused (no countdown) while `deadline` is `null`

#### Scenario: Ready transitions to the active exam

- **WHEN** a poll returns `generation: "ready"` with `deadline` and `remainingSeconds` populated
- **THEN** the page transitions to the active exam scene and stops polling for generation

### Requirement: Active exam presents one question at a time with a question-nav sidebar

In the active scene the page SHALL present the current question with its domain tag, stem, and answer options, plus Previous / Skip / Next controls, and a right-hand **question-nav sidebar** of numbered squares — one per question — reflecting answered, current, and unanswered states, with a "Submit exam" action and an answered-count summary. Selecting any square MUST navigate to that question. Per-option correct/incorrect status colours MUST NOT be shown during the active exam (exam-faithful — answers are revealed only after submission).

#### Scenario: Nav square states reflect answers

- **WHEN** an in-progress 65-question attempt has questions 0–10 answered and the user is on question 11
- **THEN** the nav shows squares 1–11 in the answered state, square 12 in the current state, and the remaining squares unanswered
- **AND** the summary reads that 11 of 65 are answered

#### Scenario: Selecting a question is not coloured by correctness during the exam

- **WHEN** the user selects an option for the current question during an active exam
- **THEN** the chosen option is shown as selected but no correct/incorrect status colour is revealed

#### Scenario: Nav navigates between questions

- **WHEN** the user clicks square 30 in the nav sidebar
- **THEN** the question pane shows question 30 as the current question

### Requirement: Answering a question persists by zero-based question index

Selecting an answer SHALL persist it via `PUT /api/v1/mock-exams/:id/answers/:questionIndex`, where `questionIndex` is the **zero-based position** of the question in the attempt (per the backend contract — not the question's `id`), with body `{ answer }`. The nav square for that question MUST move to the answered state on success. Re-selecting a different option for the same question MUST send another request for the same index, overwriting the prior answer.

#### Scenario: Answer is sent by index

- **WHEN** the user selects option "B" while on the question at position 11 (the 12th question)
- **THEN** the app calls `PUT /api/v1/mock-exams/:id/answers/11` with body `{ "answer": "B" }`
- **AND** the nav square for question 12 moves to the answered state

#### Scenario: Changing an answer overwrites at the same index

- **WHEN** the user later selects option "C" for the same question at position 11
- **THEN** the app calls `PUT /api/v1/mock-exams/:id/answers/11` with body `{ "answer": "C" }`

### Requirement: The exam shows a server-authoritative wall-clock countdown

The active scene SHALL display a countdown timer formatted `HH:MM:SS`, seeded from the attempt's server-computed `remainingSeconds` (with `deadline` as the wall-clock anchor) and ticking down locally each second. The timer MUST be derived from the server clock, not from page-open time, so that elapsed time spent away from the page is reflected. As the deadline nears, the timer MAY adopt an urgent visual treatment.

#### Scenario: Countdown reflects the server clock

- **WHEN** the attempt loads with `remainingSeconds: 6443` (and a matching `deadline`)
- **THEN** the timer shows approximately `01:47:23` and decrements once per second

#### Scenario: Reopened attempt resumes the clock from the server

- **WHEN** the user reopens an in-progress attempt whose server `remainingSeconds` is now `300`
- **THEN** the timer shows approximately `00:05:00` rather than restarting from the original time limit

### Requirement: An in-progress attempt resumes answers and the current position

On opening an `in_progress`, `ready` attempt the page SHALL rehydrate previously saved answers from `questions[].userAnswer`, mark those questions answered in the nav, and position the user at the **first unanswered question** (falling back to the first question when all are answered). This makes the exam resumable within the deadline after a browser close or navigation away.

#### Scenario: Resume positions at the first unanswered question

- **WHEN** the user reopens an in-progress attempt where questions 0–4 have a non-null `userAnswer` and question 5 does not
- **THEN** the nav shows squares 1–5 answered and the question pane opens at question 6 (position 5)

### Requirement: Submitting scores the attempt and advances to the results scene

A **Submit exam** action SHALL call `POST /api/v1/mock-exams/:id/submit`. On success the page MUST show the results scene populated from the returned terminal `MockExamResponse`. A submit confirmation MUST be offered when unanswered questions remain, communicating that unanswered questions are scored as incorrect.

#### Scenario: Manual submit moves to results

- **WHEN** the user presses "Submit exam" and confirms
- **THEN** `POST /api/v1/mock-exams/:id/submit` is called and the results scene renders from the returned attempt with `status: "submitted"`

#### Scenario: Submit warns about unanswered questions

- **WHEN** the user presses "Submit exam" with 4 of 65 questions unanswered
- **THEN** a confirmation indicates that 4 unanswered questions will be scored as incorrect before the submit request is sent

### Requirement: The exam auto-submits when the countdown reaches zero

When the local countdown reaches zero the page SHALL auto-submit by calling `POST /api/v1/mock-exams/:id/submit`. If the attempt has already been terminated server-side by the cleanup cron (the submit call returns a 409 conflict, or a refetch shows a terminal `status`), the page MUST refetch `GET /api/v1/mock-exams/:id` and render the resulting terminal attempt (`submitted` or `expired`) rather than surfacing an error. Unanswered questions are scored as incorrect by the server.

#### Scenario: Reaching zero auto-submits

- **WHEN** the countdown reaches `00:00:00` while the attempt is still in progress
- **THEN** the app calls `POST /api/v1/mock-exams/:id/submit` and renders the resulting terminal results scene

#### Scenario: Cron already expired the attempt

- **WHEN** the auto-submit call returns a 409 because the cleanup cron has already marked the attempt `expired`
- **THEN** the app refetches `GET /api/v1/mock-exams/:id` and renders the expired results scene without showing an error

### Requirement: Results scene shows the exam-faithful score breakdown by domain

On a terminal attempt the results scene SHALL render an exam-faithful hero from the `MockExamResponse`: the overall `score` as a percentage and a PASS / FAIL badge derived from `passed`. It MUST render a per-domain breakdown from `domainBreakdown`, showing each domain's accuracy with the shared status-colour palette (`statusColorForScore`) and its correct/total counts. Because `passed` is nullable in the contract (a `diagnostic`-type attempt has `passed: null` — no pass/fail framing), the PASS / FAIL badge MUST be shown only when `passed` is non-null and MUST be omitted when it is null. Fields the contract does not provide (a numeric passing-score line, per-domain weight, a per-domain passing threshold) MUST NOT be fabricated; PASS / FAIL comes from `passed`.

#### Scenario: Pass renders the score hero

- **WHEN** the terminal attempt has `score: 73`, `passed: true`, and `domainBreakdown` for four domains
- **THEN** the hero shows "73%" with a PASS badge and one breakdown row per domain showing its accuracy in the status colour and its correct/total counts

#### Scenario: Fail renders a fail badge

- **WHEN** the terminal attempt has `passed: false`
- **THEN** the hero shows a FAIL badge

#### Scenario: Null passed omits the badge

- **WHEN** the terminal attempt has `passed: null` (a diagnostic-type attempt)
- **THEN** the score and per-domain breakdown render but no PASS / FAIL badge is shown

### Requirement: Results scene reuses the shared session-summary body for readiness and drill

The results scene SHALL fetch `GET /api/v1/mock-exams/:id/summary` (which returns a `SessionSummaryResponse`) and render it through the **`SessionSummaryBody` component built by `web-session-view`**, surfacing the readiness change (calibration-aware), weak-area movement, strongest/weakest questions, suggested next focus, and the **Drill my misses** action — without duplicating that component. The mock exam being agent-free, the body's in-exam-irrelevant "Ask agent about this" affordance MUST NOT route to an in-exam agent (it is suppressed or deferred to the standalone agent chat).

#### Scenario: Summary body renders from the mock summary endpoint

- **WHEN** the results scene loads and `GET /api/v1/mock-exams/:id/summary` returns a `SessionSummaryResponse` with `readiness { before: 70, after: 74, delta: 4 }` and weak-area deltas
- **THEN** the shared summary body renders the readiness change, weak-area movement, and a Drill my misses action

#### Scenario: Drill my misses starts a targeted drill

- **WHEN** the user presses Drill my misses and `POST /api/v1/mock-exams/:id/drill` responds `{ status: "started", session: {...} }`
- **THEN** the app navigates to the session view for the returned drill session
- **WHEN** the response is `{ status: "no_misses" }`
- **THEN** the screen reports there are no misses to drill and does not navigate

### Requirement: Review mode reveals correct answers, explanations, and citations per question

From the results scene a **Review all answers** action SHALL open a review mode that steps through every question showing the user's chosen answer, the correct answer revealed, per-option correct / incorrect / dim status colours, the explanation, and citation chips — sourced from the terminal attempt's `questions[]` (`userAnswer`, `correctAnswer`, `explanation`, `citations`). The nav sidebar in review MUST recolour squares as correct / incorrect / skipped. Because these reveal fields are only present on a terminal attempt, review mode MUST be reachable only after submission/expiry. A control MUST return from review to the results scene.

#### Scenario: Review reveals correctness and explanation

- **WHEN** the user opens review for a terminal attempt and views a question where `userAnswer` is "C" and `correctAnswer` is "B"
- **THEN** option B is shown in the correct (good) colour, option C in the incorrect (poor) colour, the other options dimmed, and the question's explanation and citation chips are rendered

#### Scenario: Review nav reflects per-question outcomes

- **WHEN** review mode renders the nav sidebar for an attempt with 46 correct, 15 incorrect, and 4 unanswered questions
- **THEN** squares are coloured correct / incorrect / skipped accordingly and the counts are summarised

#### Scenario: Return to results

- **WHEN** the user activates the back control in review mode
- **THEN** the results scene is shown again

### Requirement: Expired attempts render results framed as auto-submitted on expiry

An attempt with `status: "expired"` SHALL render the same results and review surface as a submitted attempt (it is scored identically by the server), framed to communicate it was auto-submitted on reaching the deadline rather than submitted manually.

#### Scenario: Expired attempt shows scored results

- **WHEN** the user opens an attempt with `status: "expired"`, a populated `score`, and `domainBreakdown`
- **THEN** the results scene renders the score and breakdown with framing indicating the exam was auto-submitted at the deadline
- **AND** Review all answers remains available
