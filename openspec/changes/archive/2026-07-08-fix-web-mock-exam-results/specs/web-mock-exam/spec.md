## MODIFIED Requirements

### Requirement: Results scene shows the exam-faithful score breakdown by domain

On a terminal attempt the results scene SHALL render an exam-faithful hero from the `MockExamResponse`. The overall `score` is a **0..1 fraction** (`correct / total`, as computed and persisted by the backend scorer) and MUST be rendered as a percentage using `round(score × 100)` — never the raw fraction. A PASS / FAIL badge MUST be derived from `passed`. Because `passed` is nullable in the contract (a `diagnostic`-type attempt has `passed: null` — no pass/fail framing), the PASS / FAIL badge MUST be shown only when `passed` is non-null and MUST be omitted when it is null.

The hero MUST additionally show, per `openspec/design/MockExam.html` (ExamResults):
- a **passing-score reference** ("Passing score: N%") sourced from the attempt's certification `passingScore` — reachable via the attempt's `userCertificationId` — normalised to a percentage. It MUST be omitted (not defaulted) when the certification is unavailable.
- a **correct / incorrect / unanswered** count line derived from the terminal attempt itself: `correct` = the sum of `domainBreakdown[*].correct`; `unanswered` = the number of `questions[]` whose `userAnswer` is `null`; `incorrect` = total questions − correct − unanswered.

The results scene MUST render a per-domain breakdown from `domainBreakdown`, showing each domain's accuracy with the shared status-colour palette (`statusColorForScore`) and its correct/total counts, plus — per the design — a **passing-threshold marker** on each domain bar positioned at the certification passing score, a "Below passing threshold" note for any domain whose accuracy is under that threshold, and a per-domain **Weight** column sourced from the certification's per-domain `weight`. The threshold marker, weight, and below-threshold note MUST be omitted when the certification join is unavailable rather than fabricated.

Values the terminal `MockExamResponse` does not carry MUST NOT be fabricated: in particular, **elapsed / "completed in" time is not part of the contract**, so the full allowed window (`deadline − startedAt`) MUST NOT be presented as if it were elapsed time; a time value with no real source MUST be omitted.

#### Scenario: Fractional score renders as a percentage

- **WHEN** the terminal attempt has `score: 0.7`
- **THEN** the hero shows "70%" (i.e. `round(0.7 × 100)`), not "1%" and not "0.7"

#### Scenario: Pass renders the score hero

- **WHEN** the terminal attempt has `score: 0.73`, `passed: true`, a certification `passingScore` of 72%, and `domainBreakdown` for four domains
- **THEN** the hero shows "73%" with a PASS badge, a "Passing score: 72%" reference, and a "correct · incorrect · unanswered" line whose numbers match the `domainBreakdown` correct totals and the count of unanswered `questions[]`
- **AND** one breakdown row per domain is shown with its accuracy in the status colour and its correct/total counts

#### Scenario: Fail renders a fail badge

- **WHEN** the terminal attempt has `passed: false`
- **THEN** the hero shows a FAIL badge

#### Scenario: Null passed omits the badge

- **WHEN** the terminal attempt has `passed: null` (a diagnostic-type attempt)
- **THEN** the score and per-domain breakdown render but no PASS / FAIL badge is shown

#### Scenario: Per-domain passing-threshold marker and warning

- **WHEN** a domain's accuracy is below the certification passing score (e.g. 61% against a 72% passing score)
- **THEN** that domain's bar shows a threshold marker at the passing score, and a "Below passing threshold" note is shown for that domain
- **AND** domains at or above the passing score show no below-threshold note

#### Scenario: Certification data is unavailable

- **WHEN** the attempt's certification cannot be loaded
- **THEN** the score, badge, counts, and per-domain accuracy still render, and the passing-score reference, threshold markers, and Weight column are omitted rather than shown with fabricated values

#### Scenario: Allowed window is not shown as elapsed time

- **WHEN** the terminal attempt provides `deadline` and `startedAt` but no elapsed-time field
- **THEN** the results scene does not present `deadline − startedAt` as elapsed/"completed in" time; the time card is omitted when no real elapsed value is available

### Requirement: Active exam presents one question at a time with a question-nav sidebar

In the active scene the page SHALL present the current question with its domain tag, stem, and answer options, plus Previous / Skip / Next controls, and a right-hand **question-nav sidebar** of numbered squares — one per question — reflecting answered, current, and unanswered states, with a "Submit exam" action and an answered-count summary. The current-question counter MUST use the design's compact `Q N / T` form (e.g. "Q 1 / 65"). Selecting any square MUST navigate to that question. Per-option correct/incorrect status colours MUST NOT be shown during the active exam (exam-faithful — answers are revealed only after submission).

#### Scenario: Question counter uses the compact form

- **WHEN** the user is on the first question of a 65-question active attempt
- **THEN** the counter reads "Q 1 / 65" (not "Question 1 of 65")

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
