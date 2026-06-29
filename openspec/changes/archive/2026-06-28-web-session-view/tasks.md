## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the Playwright e2e harness for the session loop (see design.md Test Boundaries): authenticated state via the foundation helper, HTTP route mocks for sessions/quiz/summary/certifications/weak-areas with envelope-shaped fixtures, and a streaming `text/event-stream` mock for the agent endpoint emitting `text-delta`, `tool-result`, `job-event`, `[DONE]`, and `error` events
- [x] 0.2 Write failing acceptance test in `apps/web/e2e/` covering the full loop: open session-start → quick start creates a session → split-panel session view loads items → answer a quiz card with confidence + submit → ask the agent and see a streamed reply with a tool-result card → end session → summary renders → drill-my-misses
- [x] 0.3 Confirm it fails for the right reason (routes/pages absent), not a harness/setup error

## 1. Query keys, API bindings, and shared helpers

- [x] 1.1 RED: Write unit tests for the session-view query-key factory and the thin wrappers over the committed Orval composables (`enrollmentSessionsControllerCreate`, `sessionsControllerDetail`/`CompleteItem`/`GoDeeper`/`End`, `quizControllerSubmitAnswer`/`GenerateExplanation`/`ReportQuestion`, `sessionSummaryControllerSummary`/`Drill`, `sessionAgentConversationsControllerCreateInSession`, `agentControllerDetail`) — assert keys and that the create call treats 200 (resume) and 201 identically
- [x] 1.2 GREEN: Implement the query keys and binding helpers, reusing foundation status-colour, citation-chip, and Markdown utilities (no new Orval generation)
- [x] 1.3 REFACTOR: De-duplicate against existing dashboard/cert-detail helpers

## 2. Session-start screen — quick start and custom config

- [x] 2.1 RED: Unit-test the quick-start mode (renders saved defaults summary; suggested weakest-domain banner from weak-areas; banner hidden when no data; Start posts an empty body) and the custom-config mode (domain picker with weak scores + select-all/clear/count; override controls offering only contract-valid duration/mix/difficulty/learning-style values per design.md reconciliation; focusArea = domains vs auto; Start posts only chosen overrides)
- [x] 2.2 GREEN: Build the minimal-chrome start layout and the quick-start + custom-config components to the `../../design/SessionStart.html` artboards, applying the reconciliation (drop "Adaptive"/"Questions"/"Concepts"/slider labels and the "~N available" count; add the learning-style control); wire navigation on the create response (200 and 201 both navigate)
- [x] 2.3 REFACTOR: Extract the override-control and domain-toggle subcomponents

## 3. Reading-block and quiz-card components

- [x] 3.1 RED: Unit-test item-content parsing by type (reading → Markdown; quiz → JSON `{questionId,question,options,format}` or `{insufficient:true,domain}`), the reading block (Markdown TL;DR, "Read full explanation" calls go-deeper once and renders `expandedContent`, citation chips from provenance, advancing marks the item complete), the quiz card (option states, confidence 1–5 gates submit, submit posts `{answer,confidence,timeTakenMs}` to the parsed `questionId`, post-submit colours the chosen option from `correct`, report posts a reason and confirms on 204), and the insufficient-quiz-item skippable card
- [x] 3.2 GREEN: Build `ReadingBlock`, `QuizCard`, `QuizOption`, `ConfidenceRating`, and `CitationChip` to the `../../design/Session.html` artboards, applying the reconciliation (colour only the chosen option; do not mark the correct option on a wrong answer; chips from `sourceChunkIds`/`supportingSpans`, not invented titles)
- [x] 3.3 REFACTOR: Share the citation-chip and status-colour logic with the summary components

## 4. Session view shell — layout, header, resume

- [x] 4.1 RED: Unit-test the session view (loads `?include=items`; renders split panel; resumes at first incomplete item via `lastItemIndex`/completed flags; header live timer from `startedAt`; progress = completed/total; End session calls `/end` and navigates to summary; agent panel collapses/expands)
- [x] 4.2 GREEN: Build the `SessionLayout` + `SessionHeader` to the `../../design/Session.html` artboard atop the foundation app shell; wire item sequencing, completion, timer, progress, and end-session
- [x] 4.3 REFACTOR: Extract the timer/progress logic into a composable with focused unit tests

## 5. In-session agent panel — SSE streaming and tool-result rendering

- [x] 5.1 RED: Unit-test the agent composable/panel (ensures an in-session conversation via `POST /sessions/:id/agent-conversations`; hydrates messages via `agent-conversations/:id?include=messages`; streams turns through the foundation SSE composable appending text deltas to `[DONE]`; surfaces `error` inline) and the tool-result dispatcher mapping each tool name to its card — `getUserProgress`, `getSessionHistory`, `explainAnswer`, `examStrategy`, `fetchMoreMaterial` (fast inline vs slow loading → enqueued chip → ready chip on `job-event`), and `semanticSearch` rendering nothing
- [x] 5.2 GREEN: Build the `AgentPanel`, `AgentBubble`, and tool-result card set to the `../../design/Session.html` artboard, dispatching on raw Vercel AI SDK `tool-result` part shapes per design.md
- [x] 5.3 REFACTOR: Consolidate the tool-card registry and shared chip components

## 6. End-of-session summary screen

- [x] 6.1 RED: Unit-test the summary screen against `sessionSummaryControllerSummary` (accuracy, per-domain accuracy, weak-area delta badges, readiness before→after with calibration-null handling, strongest/weakest with "Ask agent about this" using `responseId`, next-focus) and the drill action (`status: started` navigates to the drill session; `status: no_misses` shows the empty state)
- [x] 6.2 GREEN: Build the reusable summary body component and the study-session summary route to the `../../design/Summary.html` (study scene), applying the reconciliation (derive Time client-side; drop Streak / per-domain counts / weak-area absolutes / miss count; join domain deltas from `weakAreaDeltas`)
- [x] 6.3 REFACTOR: Keep the summary body standalone so `web-mock-exam` can reuse it; extract the delta badge

## 7. Acceptance Test — Outer Loop GREEN

- [x] 7.1 Confirm the e2e acceptance test passes end-to-end
- [x] 7.2 Verify `apps/web` starts in the local environment (smoke test) — boot the app and confirm no startup/config errors
- [x] 7.3 REFACTOR: Clean up test setup, fixtures, and mocks

## 8. Change Review — Subagent Verification

- [x] 8.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 8.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 9. Polish

- [x] 9.1 Run linter and fix all errors (`yarn lint`)
- [x] 9.2 Run formatter and apply fixes (`yarn format`)
- [x] 9.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [x] 9.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
