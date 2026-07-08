## MODIFIED Requirements

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

A reading-block item SHALL render its `content` as Markdown (the LLM-formatted TL;DR). It MUST provide a "Read full explanation" affordance that calls `POST /api/v1/sessions/:id/items/:index/go-deeper` and renders the returned `expandedContent` Markdown inline; once expanded the affordance MUST NOT re-fetch. It MUST render source citation chips derived from the item's provenance (`supportingSpans` / `sourceChunkIds`), and each chip MUST display a **human-readable source label**. A raw content-chunk id/UUID (e.g. `bb9dd4b7-e3e5-44e6-b006-1b6fd247e14b`) MUST NEVER be used as a chip label; when no human title can be resolved for a `sourceChunkId` the chip MUST fall back to a generic "Source" label rather than exposing the id. Advancing past a reading block MUST mark it complete via `POST /api/v1/sessions/:id/items/:index/complete`.

> **Deferred:** the design's "Reading · <domain>" label beside the "Reading" pill is NOT delivered by this change. `GET /api/v1/sessions/:id` items carry no per-item domain (no `SessionItem.domain` column/DTO), so rendering it requires a future backend change; `ReadingBlock.vue` retains an unused optional `:domain` prop for that follow-up. See `proposal.md` → "Deferred / follow-up".

#### Scenario: TL;DR renders and expands on demand

- **WHEN** a reading block is shown and the user presses "Read full explanation"
- **THEN** `POST /api/v1/sessions/:id/items/:index/go-deeper` is called and the returned `expandedContent` is rendered as Markdown below the TL;DR
- **AND** pressing it again does not trigger a second request

#### Scenario: Citation chips show human labels, never raw chunk ids

- **WHEN** a reading block carries `sourceChunkIds` containing `bb9dd4b7-e3e5-44e6-b006-1b6fd247e14b` and `supportingSpans`
- **THEN** the block renders one citation chip per cited source with a human-readable label
- **AND** no chip label is a raw content-chunk UUID

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

### Requirement: End-of-session summary screen renders the session outcome

On session completion the summary screen SHALL fetch `GET /api/v1/sessions/:id/summary` and render a **page header** — a "Session complete" badge, a "Study Session · CODE" title, the certification name · session duration, and a completion timestamp — above the outcome body. When `questionsAnswered > 0` the body SHALL render: questions answered and accuracy; per-domain accuracy (`domains[]`); weak-area score deltas (`weakAreaDeltas[]`); the readiness change (`readiness.before` → `readiness.after` with `readiness.delta`); the strongest and weakest question (`strongestQuestion` / `weakestQuestion`), each with an "Ask agent about this" action; and the suggested next focus (`nextFocus.domain`). Where `readiness.before/after/delta` are null (not yet calibrated) the screen MUST show a calibration message instead of a percentage change. Fields the summary contract does not provide (per-domain question counts, weak-area absolute before/after values, and a miss count) MUST NOT be fabricated.

#### Scenario: Summary renders the page header and outcome body

- **WHEN** the summary returns accuracy 0.67, domains for IAM/Networking, weak-area deltas, and `readiness { before: 72, after: 75, delta: 3 }`
- **THEN** the page header shows a "Session complete" badge, a "Study Session · CODE" title, the cert name · duration, and a completion timestamp
- **AND** the body shows the accuracy, per-domain accuracy rows, weak-area delta badges, and a "72% → 75% (+3%)" readiness change

#### Scenario: Uncalibrated readiness shows a calibration message

- **WHEN** the summary returns `readiness` with null before/after/delta
- **THEN** the readiness section shows a not-yet-calibrated message rather than a percentage change

## ADDED Requirements

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
