## Context

The mock-exam backend (`mock-exam` change) is fully built and committed in the Orval client; this change is the `apps/web` frontend for it — a single full-screen page at `/mock-exams/:id` with four scenes (preparing, active, results, review). The create/start action and the entry links already exist upstream: `useQuickStartActions.startMockExam` (in `web-dashboard`/`web-cert-detail`) calls `enrollmentMockExamControllerCreate` then `router.push(mockExamRunPath(id))`, and `ExamHistoryTab` links submitted attempts to the same route. This change owns only the destination page, which does not exist yet.

It reuses the `web-foundation` shell (auth, vue-query plugin, Orval client, minimal-chrome layout) and the `web-session-view` building blocks: the `SessionSummaryBody` component (fed a `SessionSummaryResponse`), the `statusColor` helpers, `CitationChip`, `DeltaBadge`, the `formatElapsed`/timer pattern, and the quiz-option visual states.

Constraints: TypeScript strict (no `any`), absolute path-alias imports, Biome, outside-in TDD with Playwright e2e first, co-located `*.spec.ts`, ≥80% coverage. No backend edits, no new entities/migrations, and no `yarn codegen` — every consumed endpoint already exists in `apps/web/src/api/`.

## Goals / Non-Goals

**Goals:**
- Full-screen, agent-free, sidebar-free mock-exam page that branches on `generation` (`preparing`/`ready`) and `status` (`in_progress`/`submitted`/`expired`).
- Preparing scene that **polls** `GET /mock-exams/:id` and streams verified questions into the nav sidebar with the timer paused (`deadline`/`remainingSeconds` are `null` until ready).
- Active timed exam: one question at a time, question-nav sidebar, wall-clock **countdown** seeded from server `remainingSeconds`/`deadline`, answers persisted by **zero-based index**, status colours hidden.
- Resume from the server clock and saved `userAnswer`s; position at first unanswered question.
- Submit and **auto-submit on expiry** (with graceful 409/cron handling).
- Results scene: exam-faithful score hero (overall `score`, PASS/FAIL from `passed`) + per-domain `domainBreakdown`, **plus** the reused `SessionSummaryBody` from `GET /mock-exams/:id/summary` for readiness/weak-area/drill.
- Review mode revealing `correctAnswer`/`explanation`/`citations` per question (terminal only).
- Expired state on the same results/review surface, framed as auto-submitted.

**Non-Goals:**
- Starting/creating a mock exam (owned upstream by `web-dashboard`/`web-cert-detail`).
- The diagnostic variant's onboarding offer / re-prompt (owned by `web-onboarding`/`diagnostic`). The page renders a `diagnostic`-type attempt correctly if navigated to (no pass/fail framing follows naturally from `passed: null`), but the offer flow is out of scope.
- The standalone agent chat and any in-exam agent (mock exams are agent-free; `web-agent-chat` owns standalone chat).
- Any backend/DTO change or Orval regeneration. Gaps where the artboards assume richer payloads are reconciled in the UI here and flagged for a possible later backend change.

## Visual Design

Visual source of truth: the committed shared design mirror under `openspec/design/`. The `DesignSync` connector is **not available** in this environment, so the canonical artboard is read in place from the shared mirror and is **not** copied into this change. It loads the sibling `app-shell.jsx` and `_ds/` token bundle.

| Artboard (in `../../design/MockExam.html`) | Maps to |
|---|---|
| `ExamLoading` — "Loading — questions streaming in, timer paused" | Preparing scene: "Preparing your exam" panel, "N / total ready" progress, nav sidebar filling, paused timer placeholder (`-- : -- : --`) |
| `ExamActive` — "Active — option selected (not submitted)" | Active scene: `ExamHeader` (cert chip, "Mock Exam", Q counter, countdown, Flag), domain tag, stem, `QuizOption` rows, Previous / Skip / Next, `NavPanel` with Submit |
| `ExamResults` — "Results — score breakdown by domain" | Results scene: score hero (overall %, PASS/FAIL), per-domain breakdown rows, "Review all answers" / "Return to dashboard" — **plus** the reused `SessionSummaryBody` |
| `ExamReview` — "Review mode — correct / incorrect revealed with explanation" | Review scene: revealed option colours, explanation block, citation chips, review-coloured `NavPanel`, "Back to results" |

**Layout to implement:** the existing `minimal` layout (header-only, no app sidebar), matching the artboard's full-bleed exam frame. The page builds its own `ExamHeader` and `NavPanel`; it does **not** reuse `SessionHeader`/`SessionLayout` (those carry an agent column and an elapsed timer the mock exam must not have). The `QuizOption` visual states (rest / selected / correct / incorrect / dim) are shared with the session view's quiz options.

### Design ↔ contract reconciliation

The behavioural spec + the real backend contract win wherever the artboard diverges. The artboard was drawn ahead of the API and assumes several fields and features the contracts do not provide.

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Per-question **Flag** button + `flagged` nav state | No flag concept exists in `MockExamResponse`/`MockExamQuestionResponse`; no flag endpoint; flags would not survive the resume the spec requires | Treat flag as **client-only, session-local** presentation state (a within-sitting aid), explicitly not persisted and lost on reload — or omit it. Not presented as backed by the API. Flagged as a candidate backend feature. |
| Results "Passing score: 72%" numeric line | `MockExamResponse` exposes `passed` (boolean) but **not** the passing-score number | Derive PASS/FAIL from `passed`. Show the numeric passing score only if separately fetched from `GET /certifications/:id`; otherwise omit the number. Default: omit (no extra fetch required by spec). |
| Results per-domain **Weight** column and **passing-threshold** marker on each bar | `domainBreakdown` is `Record<domain, { correct, total, accuracy }>` — no per-domain weight or threshold | Render per-domain accuracy (status-coloured) + correct/total counts. Drop the weight column and threshold marker; they are not in the mock contract. (Domain weights live on `Certification` and could be joined via a later enhancement.) |
| Results domain colour thresholds (`<65` poor, `<72` warn, else good) hard-coded in the artboard | The app's shared palette is `statusColorForScore` (`<50` poor, `<65` warn, `<=80` medium, else good) | Use the shared `statusColorForScore`/`statusTextColorClass` so the mock results match the rest of the app, not the artboard's bespoke cut-offs. |
| Active/results "Ask agent about this" reachable from the reused summary body | Mock exams are agent-free and `web-mock-exam` does not depend on `agent`/`web-agent-chat` | Suppress the summary body's ask-agent affordance in the mock context (add an optional `hideAskAgent`/disable prop to `SessionSummaryBody`, or do not wire its emit). Revisit when `web-agent-chat` ships. |
| Timer shown counting (`01:47:23`) and the loading timer as `-- : -- : --` | Contract returns `deadline`/`remainingSeconds` as **`null` until ready**, then a server-authoritative countdown | Pause/placeholder the timer while `preparing`; once `ready`, run a **countdown** seeded from `remainingSeconds` (anchored to `deadline`), formatted `HH:MM:SS`. `useElapsedTimer` counts **up** in `MM:SS`, so add a sibling `useDeadlineCountdown` rather than overload it. |
| Nav squares and Q counter are 1-based; answer endpoint path | Answers persist via `PUT /mock-exams/:id/answers/:questionIndex` with a **zero-based** index | Display 1-based question numbers; send the zero-based array index in the request path. Keep the mapping explicit to avoid an off-by-one. |
| Loading copy "timer starts once all 65 questions are ready" / hard-coded 65 + "130-minute window" | Question count and time limit are not echoed pre-ready; only the streamed `questions[]` length and (once ready) `deadline` are known | Drive the "total" from the attempt's `questions.length` target as it streams (use the in-flight length and, once `ready`, the final count); do not hard-code 65/130. Keep the reassuring "the clock keeps running if you close this tab" copy (it matches the resume contract). |
| Stream-in shown as a live fill with no transport named | There is **no SSE endpoint** for mock-exam generation — generation runs server-side via the BullMQ processor; the client observes it by reading the growing `questions[]` | Implement stream-in as **polling** `GET /mock-exams/:id` (vue-query `refetchInterval`) while `generation === 'preparing'`; stop on `ready`. Not EventSource. |
| Review mode reachable as a standalone artboard with full reveal | `correctAnswer`/`explanation`/`citations` are only present when `status` is terminal | Gate review on a terminal attempt; from a fresh/active attempt review is not reachable. |

## Decisions

- **Poll, don't stream, for generation.** The mock-exam backend has no SSE endpoint; the generation processor fills `questions[]` server-side and flips `generation` to `ready` (by setting `startedAt`) once the verified set is complete. The page therefore uses a vue-query `refetchInterval` on `GET /mock-exams/:id` while `preparing` and stops once `ready`. This mirrors the contract exactly and avoids inventing a transport. Alternative (SSE) would require a backend change that does not exist.
- **Countdown is server-anchored, ticked locally.** Seed the countdown from `remainingSeconds` and anchor to `deadline` (both server-computed and clamped to ≥0). A local 1-second interval ticks the display; on refocus/refetch the value is re-seeded from the server so elapsed-while-away time is honoured (exam-faithful). A new `useDeadlineCountdown` composable (`HH:MM:SS`) sits beside the session view's `useElapsedTimer` (`MM:SS`, counts up) rather than overloading it.
- **Answer by index, display by number.** Persist answers with the zero-based array index in the `PUT .../answers/:questionIndex` path while rendering 1-based question numbers, keeping a single explicit index↔number mapping to avoid off-by-one bugs.
- **Auto-submit is best-effort, refetch is the source of truth.** When the countdown hits zero the page calls submit; the cleanup cron is the server-side backstop. A 409 (already terminal) or a terminal `status` on refetch is treated as success — the page refetches and renders the terminal attempt instead of erroring. This keeps client and cron from racing into an error state.
- **Two endpoints feed the post-submission screen.** The exam-faithful score hero + domain breakdown come from `GET /mock-exams/:id` (`MockExamResponse.score`/`passed`/`domainBreakdown`); the readiness change, weak-area movement, strongest/weakest, and drill come from `GET /mock-exams/:id/summary` (`SessionSummaryResponse`) rendered through the reused `SessionSummaryBody`. Composing both satisfies the artboard's bespoke results screen *and* the reuse mandate, with no duplicated summary logic.
- **Reuse `SessionSummaryBody`, suppress ask-agent.** The shared body already renders domains, readiness, weak-area movement, strongest/weakest, next-focus, and the drill/back CTAs against a `SessionSummaryResponse`. It is mounted with its real props: `drill` → `POST /mock-exams/:id/drill` (`useMockExamSummaryControllerDrill`), `drillNoMisses` set from a `no_misses` response, `timeLabel` derived client-side from `startedAt`/`deadline`, and `back` → return to dashboard. Its `ask-agent` affordance is suppressed in the mock context (mock exams are agent-free and this change does not depend on `agent`).
- **Action ownership between the results hero and the reused body (avoid duplicate CTAs).** The `MockExamResponse`-driven score hero owns the **Review all answers** action (it has no equivalent in the summary body). The reused `SessionSummaryBody` owns **Drill my misses** and the single **Back to dashboard** action. The bespoke "Return to dashboard" button from the `ExamResults` artboard is therefore **not** duplicated — there is exactly one dashboard-return control (the body's `back` emit), and the only added results-scene control is "Review all answers". This keeps a single primary path and avoids two competing "back" buttons.
- **No `SessionLayout`/`SessionHeader` reuse.** Those carry an agent column and an up-counting timer; the exam needs neither. The mock page builds a dedicated `ExamHeader` + `NavPanel` on the `minimal` layout.

## Test Boundaries

E2E (Playwright) drives the real `apps/web` against a mocked HTTP API so the polling stream-in, the countdown, and the submit/expiry envelopes are exercised deterministically; component/composable unit tests mock the Orval client.

| Dependency | In acceptance test (Playwright e2e) | In unit tests (Vitest) |
|---|---|---|
| `GET /mock-exams/:id` (load / poll / resume) | HTTP mock returning a sequence: `preparing` with growing `questions`, then `ready`, then terminal on refetch | Mocked Orval `mockExamControllerFindOne` / vue-query (incl. successive poll values) |
| `PUT /mock-exams/:id/answers/:index` | HTTP mock asserting the zero-based path + `{ answer }` body, echoing the updated attempt | Mocked `mockExamControllerSaveAnswer` |
| `POST /mock-exams/:id/submit` | HTTP mock returning a terminal attempt; a 409 variant for the cron-race path | Mocked `mockExamControllerSubmit` |
| `GET /mock-exams/:id/summary` + `POST /mock-exams/:id/drill` | HTTP mock returning a `SessionSummaryResponse` and a `{ status }` drill result | Mocked `mockExamSummaryControllerSummary` / `Drill` |
| Wall-clock countdown / timers | Real with controlled clock (fake timers where needed) | Fake timers asserting `HH:MM:SS` formatting and tick-down |
| Browser router / Pinia / vue-query | Real | Real (or test harness) |
| Auth session | Mocked authenticated state (foundation helper) | N/A |

## Risks / Trade-offs

- [Polling cadence vs perceived latency] → Use a short `refetchInterval` (e.g. ~1–2s) only while `preparing`; stop immediately on `ready`. Acceptable load since generation is a brief, one-time window per attempt.
- [Client/cron auto-submit race] → Treat 409 and terminal-on-refetch as success and render the terminal attempt; never surface an error for an already-expired exam.
- [Flag feature has no backing] → Implement as session-local only (or omit); never imply persistence across resume. Flagged as a candidate backend feature.
- [Passing-score number and per-domain weight/threshold absent] → Omit the number and the weight/threshold markers rather than fabricate; PASS/FAIL from `passed` is sufficient and exam-faithful. Optional `GET /certifications/:id` join is a later enhancement.
- [Reused summary body's ask-agent in an agent-free context] → Suppress the affordance via a prop; revisit when `web-agent-chat` lands so post-exam questions can route to the standalone tutor.

## Open Questions

- Should the results screen fetch `GET /certifications/:id` to show the numeric passing score and per-domain weights, or stay minimal (PASS/FAIL + accuracy only)? (Leaning: stay minimal; add the join only if product wants the threshold context.)
- Should the in-session-irrelevant ask-agent affordance be removed from `SessionSummaryBody` via a prop now, or deferred until `web-agent-chat` can wire post-exam questions to the standalone tutor? (Leaning: add a suppress prop now; wire later.)
