## Reviewed Artifacts

- proposal.md
- specs/web-session-view/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | specs + design | Neither artifact stated how a session **quiz item** yields the `questionId` required by `POST /quiz/:questionId/submit`. The backend encodes quiz-item `content` as a JSON string `{ questionId, question, options, format }` (or `{ insufficient: true, domain }`); without this, the submit target and the insufficient-material state are unimplementable. | Added a spec requirement "Session items are parsed by type and insufficient quiz items are skippable" with two scenarios; added a design Decision pinning the `SessionItem.content` encoding (Markdown for reading, JSON for quiz) and the skippable insufficient case; extended task 3.1 to test content-parsing and the insufficient card. | spec → ADDED Requirement (item parsing); design.md → Decisions; tasks.md → 3.1 |
| WARNING | proposal.md | Impact's "Consumed API contracts" list omitted two endpoints the specs/design rely on — cert domains for the picker and weak scores for the suggested domain — and listed `quizControllerGenerate`, which the session view does not call (session quiz items are pre-generated server-side). | Pinned the two missing endpoints to their concrete committed Orval methods (`certificationsControllerDetail`, `userCertificationsControllerListWeakAreas`) and removed `quizControllerGenerate` from the consumed list. | proposal.md → Impact |
| SUGGESTION | design.md | Correct-option highlighting after a wrong answer is not backed by `SubmitAnswerResponse` (the `correctAnswer` is stored in `questionSnapshot` server-side but not returned). | Already captured in the Design↔contract reconciliation table and Risks: colour only the chosen option from `correct`; reveal the correct answer via the `explainAnswer` tool; flagged exposing `correctAnswer` on submit as an out-of-scope follow-up backend change. No artifact change needed. | design.md → reconciliation / Risks (no change) |

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved. Verified directly against the committed contracts:

- **Capability coverage** — one capability (`web-session-view`) named in the proposal, one matching `specs/web-session-view/spec.md`; no modified capabilities; nothing exists only in design/tasks.
- **Endpoint pinning** — every consumed endpoint exists in the committed Orval client: `enrollmentSessionsControllerCreate`, `sessionsControllerDetail`/`CompleteItem`/`GoDeeper`/`End`, `certificationsControllerDetail`, `userCertificationsControllerListWeakAreas`, `sessionAgentConversationsControllerCreateInSession`, `agentControllerDetail`/`StreamTurn`, `quizControllerSubmitAnswer`/`GenerateExplanation`/`ReportQuestion`, `sessionSummaryControllerSummary`/`Drill`. **No `yarn codegen` is required.**
- **Agent SSE / tool-result contract** — confirmed the API forwards Vercel AI SDK `fullStream` parts unchanged (`yield part as SseEvent`) plus `job-event` and `error`, terminated by a `data: [DONE]` sentinel; the tool-result rendering requirement and design key off the raw part shape and tool name, with `semanticSearch` not rendered. This matches the implemented `AgentController.streamTurn` and `AgentService.runTurn`.
- **Scenario coverage / task alignment** — every spec scenario is concrete and testable; the outer-loop e2e (group 0/7) plus the per-component unit groups (1–6) cover all requirements in outside-in order; Test Boundaries name every mocked/real collaborator the acceptance test uses; Change Review and the four-task Polish group are present.
- **Design reconciliation** — the three artboards (`SessionStart.html`, `Session.html`, `Summary.html`) are reconciled against the real contract; all divergences (difficulty/duration/mix enums, missing learning-style control, correct-option highlight, citation labels, summary streak/counts/absolutes/miss-count, mock variant scope) resolve with the behavioural spec winning and unbacked elements dropped or derived.

## Deferred Non-Blocking Notes

- **Expose `correctAnswer` on `SubmitAnswerResponse`** — would let the session view mark the correct option after a wrong answer without a separate explanation fetch. Out of scope (backend/DTO change + codegen); documented in design.md Risks and the reconciliation table.
- **Source-title field for citation chips** — session items expose `sourceChunkIds`/`supportingSpans` but no human-readable source title; chips render from available provenance until/unless a title field is added. Tracked in design.md Open Questions.
