## Why

The study session is the core loop of Readion — the place a time-constrained learner actually spends their study minutes. The backend for this loop is fully implemented and archived (`sessions`, `agent`, `quiz`, `end-of-session-summary`, `web-foundation`), and the committed Orval client already exposes every endpoint it needs. What is missing is the frontend: there is no way to start, configure, run, or wrap up a session in `apps/web`. This change builds that page set, completing the MVP vertical slice (`one certification → core study session → in-session agent → readiness dashboard`).

## What Changes

- **Session start / config screen** — minimal-chrome route reached from the dashboard. Two modes:
  - **Quick start** — one tap using the user's saved session defaults, with a suggested weak-domain prioritisation banner. Starts a session with no overrides (server applies saved defaults).
  - **Custom config** — domain-focus picker (multi-select against the cert's domains, with per-domain weak scores), plus duration / content-mix / difficulty / learning-style overrides. Reconciled to the real `createSessionRequestSchema` enums (15/30/60/90 min; balanced/reading-heavy/quiz-heavy/video-based; beginner/intermediate/exam-ready; weak-area-focus/spaced-repetition/cram).
  - Handles the resume case: starting when an `active` session already exists for the enrollment surfaces and resumes it (create returns 200 + existing session, not a second one).
- **Split-panel session view** — content (reading blocks + quiz cards) on the left, collapsible AI agent chat on the right; session timer + progress bar in the header; End-session action.
  - **Reading blocks** — render LLM Markdown TL;DR with a "Read full explanation" affordance backed by the go-deeper endpoint; source citation chips.
  - **Quiz cards** — options, confidence rating (1–5) captured with the answer, submit → scored result with post-submission option status colours, "Report this question" → quarantine, citation chips.
  - **Session resume** — on entry, fetch the session with items and resume from `lastItemIndex`; mark items complete as the learner advances.
- **In-session agent panel** — creates an in-session conversation, streams turns over SSE using the `web-foundation` SSE composable, and renders Vercel AI SDK stream parts. **Tool-result rendering**: inspect the tool name on each `tool-result` part and render the mapped UI component (`getUserProgress`, `getSessionHistory`, `explainAnswer`, `examStrategy`, `fetchMoreMaterial` fast/slow; `semanticSearch` not shown). Citation chips on grounded tool cards.
- **End-of-session summary screen** — shown on completion: questions/accuracy, per-domain accuracy, weak-area deltas, readiness change (handling not-yet-calibrated nulls), strongest/weakest question with "Ask agent about this", suggested next focus, and the **"Drill my misses"** primary CTA (→ targeted drill session or no-misses state).
- **Reuse, not rebuild** — query keys, status-colour helpers, citation-chip and Markdown rendering, and the SSE composable established by `web-foundation`/`web-dashboard`/`web-cert-detail`; consume the committed Orval `@tanstack/vue-query` composables (no `yarn codegen` needed — every endpoint already exists in the client).

## Capabilities

### New Capabilities
- `web-session-view`: The `apps/web` session lifecycle UI — start/config screen (quick-start + custom config), the split-panel session view (reading blocks, quiz cards with confidence + report, citation chips, timer/progress, resume), the in-session streaming agent panel with tool-result rendering, and the end-of-session summary screen with drill-my-misses.

### Modified Capabilities
<!-- None. This change introduces a new frontend capability only; it consumes existing committed API contracts (sessions, agent, quiz, session-summary) without changing their requirements. -->

## Impact

- **New code**: `apps/web` — session-start/config page, session-view page, summary page, agent-panel + tool-result component set, reading-block / quiz-card / confidence-rating / citation-chip components, the in-session SSE/agent composable, and Pinia/vue-query state for the active session. Playwright e2e specs in `apps/web/e2e/` and co-located component/composable unit specs.
- **Consumed API contracts (already committed in `apps/web/src/api/`)**: `enrollmentSessionsControllerCreate`, `sessionsControllerDetail`/`CompleteItem`/`GoDeeper`/`End`, `certificationsControllerDetail` (cert domains for the picker), `userCertificationsControllerListWeakAreas` (weak scores + suggested domain), `sessionAgentConversationsControllerCreateInSession`, `agentControllerDetail`/`StreamTurn`, `quizControllerSubmitAnswer`/`GenerateExplanation`/`ReportQuestion`, `sessionSummaryControllerSummary`/`Drill`.
- **No backend changes, no new entities, no migrations, no codegen.** Design reconciliation flags where artboards assume richer payloads than the contracts provide (e.g. `SubmitAnswerResponse` omits the correct-answer identity; summary omits per-domain counts, weak-area absolutes, miss count, streak) — these are resolved in `design.md` (behavioural spec + real contract win; artboard extras are derived or dropped) and surfaced for a possible follow-up backend change rather than silently assumed.
- **Dependencies** (all archived): `web-foundation`, `sessions`, `agent`, `end-of-session-summary`.
- **Design**: `../../design/SessionStart.html`, `../../design/Session.html`, `../../design/Summary.html` (shared mirror; referenced in place, not copied).
