## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the Playwright e2e harness for the mock-exam loop (see design.md Test Boundaries): authenticated state via the foundation helper, and HTTP route mocks for `GET /mock-exams/:id` (a scripted sequence: `preparing` with a growing `questions[]`, then `ready` with `deadline`/`remainingSeconds`, then terminal on refetch), `PUT /mock-exams/:id/answers/:index`, `POST /mock-exams/:id/submit` (terminal + a 409 cron-race variant), `GET /mock-exams/:id/summary`, and `POST /mock-exams/:id/drill`
- [x] 0.2 Write the failing acceptance test in `apps/web/e2e/` covering the full loop: open `/mock-exams/:id` in `preparing` → questions stream into the nav with the timer paused → transition to the active exam when `ready` → answer questions (persisted by zero-based index) with the countdown running → submit → results scene shows the score hero + per-domain breakdown + reused summary body → open review mode (revealed correct/incorrect + explanation + citations) → return to results
- [x] 0.3 Confirm it fails for the right reason (the `/mock-exams/:id` route/page is absent), not a harness/setup error

## 1. Query keys, API bindings, and the countdown composable

- [x] 1.1 RED: Unit-test the mock-exam query-key factory (`detail`, `summary`) and the thin wrappers over the committed Orval composables (`mockExamControllerFindOne`, `mockExamControllerSaveAnswer`, `mockExamControllerSubmit`, `mockExamSummaryControllerSummary`, `mockExamSummaryControllerDrill`); and unit-test a new `useDeadlineCountdown` composable that seeds from `remainingSeconds`/`deadline`, ticks down once per second, formats `HH:MM:SS`, clamps at `00:00:00`, and emits a zero-reached signal (use fake timers)
- [x] 1.2 GREEN: Implement the query keys, the binding helpers, and `useDeadlineCountdown` beside the existing `useElapsedTimer` (no new Orval generation)
- [x] 1.3 REFACTOR: De-duplicate against existing session-view query-key and timer patterns; keep `useDeadlineCountdown` (count-down, `HH:MM:SS`) distinct from `useElapsedTimer` (count-up, `MM:SS`)

## 2. Exam header and question-nav sidebar components

- [x] 2.1 RED: Unit-test the `ExamHeader` (cert chip, mode label `Preparing exam…`/`Mock Exam`/`Review mode`, 1-based Q counter, countdown slot, optional client-only Flag, urgent treatment near zero) and the `MockExamNavPanel` (preparing: "N / total ready" + progress bar; active: answered/current/unanswered squares + legend + Submit + answered-count; review: correct/incorrect/skipped recolour + counts; square click emits a navigate-to-index event; 1-based labels over zero-based indices)
- [x] 2.2 GREEN: Build `ExamHeader` and `MockExamNavPanel` to the `../../design/MockExam.html` artboards on the `minimal` layout, applying the reconciliation (shared `statusColorForScore` cut-offs, not the artboard's bespoke thresholds; Flag is session-local or omitted; total derived from `questions.length`, not hard-coded 65)
- [x] 2.3 REFACTOR: Extract the nav-square state mapping and share the `QuizOption` visual states with the session view's quiz options

## 3. Preparing scene — stream-in via polling

- [x] 3.1 RED: Unit-test the preparing scene (renders while `generation === 'preparing'`; `GET /mock-exams/:id` is polled on an interval; the nav reflects the growing `questions.length` against the target with a "N / total ready" indicator; the timer is shown paused while `deadline`/`remainingSeconds` are null; transitions to the active scene and stops polling when `generation` flips to `ready`)
- [x] 3.2 GREEN: Build the preparing scene to the `ExamLoading` artboard, driving stream-in with a vue-query `refetchInterval` gated on `generation === 'preparing'` (polling, not SSE — there is no mock-exam SSE endpoint)
- [x] 3.3 REFACTOR: Centralise the generation/status scene-selection logic for reuse by the page shell

## 4. Active exam scene — question pane, answering, countdown, resume

- [x] 4.1 RED: Unit-test the active scene (renders the current question's domain tag/stem/options with Previous/Skip/Next; selecting an option calls `PUT /mock-exams/:id/answers/:index` with the **zero-based** index and `{ answer }`, moves the nav square to answered, and re-selecting overwrites at the same index; no correct/incorrect colour is revealed during the exam; the countdown runs from `remainingSeconds`; resume rehydrates `userAnswer`s and positions at the first unanswered question; nav square click navigates)
- [x] 4.2 GREEN: Build the active scene to the `ExamActive` artboard, wiring answer persistence by index, the server-anchored countdown, resume positioning, and nav navigation
- [x] 4.3 REFACTOR: Extract the index↔1-based-number mapping and the answer-mutation handler into focused units

## 5. Submit and auto-submit-on-expiry

- [x] 5.1 RED: Unit-test submission (Submit calls `POST /mock-exams/:id/submit` and shows the results scene from the terminal response; a confirmation warns when unanswered questions remain, noting they score as incorrect) and auto-submit (reaching `00:00:00` calls submit; a 409 or terminal-on-refetch triggers a `GET /mock-exams/:id` refetch and renders the terminal/`expired` scene without surfacing an error)
- [x] 5.2 GREEN: Implement the Submit action, the unanswered-confirmation, the countdown-zero auto-submit, and the graceful cron-race handling
- [x] 5.3 REFACTOR: Consolidate the submit/refetch/terminal-transition flow shared by manual and auto submit

## 6. Results scene — score breakdown plus reused summary body

- [x] 6.1 RED: Unit-test the results scene (score hero shows `score`% with PASS/FAIL from `passed`, and **omits the badge when `passed` is null** — diagnostic-type; per-domain breakdown from `domainBreakdown` shows accuracy in the shared status colour + correct/total counts; no fabricated passing-score number, weight, or threshold; `GET /mock-exams/:id/summary` (`mockExamSummaryControllerSummary`) feeds the reused `SessionSummaryBody`; the body's ask-agent affordance is suppressed and exactly one "Back to dashboard" control exists (no duplicate from the artboard); "Review all answers" is the only added results-scene action; Drill my misses → `POST /mock-exams/:id/drill` (`mockExamSummaryControllerDrill`) → `status: started` navigates to the drill session, `no_misses` sets `drillNoMisses`; `expired` renders the same surface with auto-submitted framing)
- [x] 6.2 GREEN: Build the results scene to the `ExamResults` artboard, composing the `MockExamResponse`-driven hero/breakdown with the reused `SessionSummaryBody` (fed by the summary endpoint, with `timeLabel` derived from `startedAt`/`deadline`), applying the reconciliation and the action-ownership split (Review all answers on the hero; Drill my misses + single Back to dashboard from the body); add a suppress-ask-agent prop to `SessionSummaryBody`
- [x] 6.3 REFACTOR: Keep the score-breakdown component standalone; reuse the shared status-colour and delta-badge helpers

## 7. Review mode

- [x] 7.1 RED: Unit-test review mode (reachable only from a terminal attempt; steps through every question revealing the chosen vs correct option with correct/incorrect/dim colours, the explanation, and citation chips from `questions[]`; the nav recolours squares correct/incorrect/skipped with counts; a back control returns to results)
- [x] 7.2 GREEN: Build the review scene to the `ExamReview` artboard, sourcing reveal fields from the terminal attempt's `questions[]` and reusing `CitationChip` and the `QuizOption` states
- [x] 7.3 REFACTOR: Share the option-state derivation with the active scene; de-duplicate citation rendering

## 8. Page shell — scene selection and route wiring

- [x] 8.1 RED: Unit-test the `/mock-exams/[id]` page shell (loads via `mockExamControllerFindOne`; selects preparing/active/results/review from `generation` + `status`; loading and not-found/error states; uses the `minimal` layout with no sidebar and no agent panel)
- [x] 8.2 GREEN: Build the page at `apps/web/app/pages/mock-exams/[id]/index.vue` wiring the four scenes, the shared `ExamHeader`/`NavPanel`, and the scene-selection logic
- [x] 8.3 REFACTOR: Tidy the page composition so each scene is a focused child component

## 9. Acceptance Test — Outer Loop GREEN

- [x] 9.1 Confirm the e2e acceptance test passes end-to-end
- [x] 9.2 Verify `apps/web` starts in the local environment (smoke test) — boot the app and confirm no startup/config errors
- [x] 9.3 REFACTOR: Clean up test setup, fixtures, and mocks

## 10. Change Review — Subagent Verification

- [x] 10.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 10.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 11. Polish

- [x] 11.1 Run linter and fix all errors (`yarn lint`)
- [x] 11.2 Run formatter and apply fixes (`yarn format`)
- [x] 11.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [x] 11.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
