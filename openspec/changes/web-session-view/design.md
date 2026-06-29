## Context

The study-session loop is fully built on the backend and committed in the Orval client; this change is the `apps/web` frontend for it. It spans three views — session start/config, the split-panel session view, and the end-of-session summary — wired to the `sessions`, `agent`, `quiz`, and `session-summary` contracts. It reuses the `web-foundation` shell (auth, layout, dark mode, vue-query plugin, Orval client, and the `useEventSource`-based SSE composable) and the status-colour / citation-chip / Markdown patterns already established by `web-dashboard` and `web-cert-detail`.

Constraints: TypeScript strict (no `any`), absolute path-alias imports, Biome, outside-in TDD with Playwright e2e first, co-located `*.spec.ts`, ≥80% coverage. No backend edits, no new entities/migrations, and no `yarn codegen` — every consumed endpoint already exists in `apps/web/src/api/`.

## Goals / Non-Goals

**Goals:**
- Start screen with quick-start (saved defaults + suggested weak domain) and custom config (domain-focus picker + duration/mix/difficulty/learning-style overrides) bound to the real `createSessionRequestSchema`.
- Split-panel session view: reading blocks (TL;DR + go-deeper + citations), quiz cards (confidence, submit, post-submit colours, report), header timer/progress, resume from `lastItemIndex`, end-session.
- In-session agent panel: SSE streaming via the foundation composable, conversation create/hydrate, and tool-result rendering by tool name.
- End-of-session summary: accuracy, domain accuracy, weak-area deltas, readiness change (calibration-aware), strongest/weakest with "ask agent", next focus, and drill-my-misses.
- Maximum reuse of foundation composables, query keys, and shared helpers.

**Non-Goals:**
- The mock-exam summary path. `Summary.html` includes a mock artboard, but the mock summary screen and its `mock-exams/:id/summary` wiring belong to `web-mock-exam`. This change builds the study-session summary and a reusable summary component; `web-mock-exam` reuses it.
- Standalone agent chat (owned by `web-agent-chat`).
- Any backend/DTO change or Orval regeneration. Gaps where the artboards assume richer payloads are reconciled in the UI here and flagged for a possible later backend change.

## Visual Design

Visual source of truth: the committed shared design mirror under `openspec/design/`. The `DesignSync` connector is **not available** in this environment, so the canonical artboards are read in place from the shared mirror and are **not** copied into this change. They load the sibling `app-shell.jsx` and `_ds/` token bundle.

| Artboard / screen | Maps to |
|---|---|
| `../../design/SessionStart.html` — "Quick start" artboard | Session-start screen, quick-start mode (defaults summary, suggested-focus banner, one-tap Start, "Customise" link) |
| `../../design/SessionStart.html` — "Custom config" artboard | Session-start screen, custom-config mode (domain-focus picker, duration/mix/difficulty controls, "Start" / "Use defaults instead") |
| `../../design/Session.html` — `SessionLayout` + `SessionHeader` | Split-panel session view shell: header (cert chip, timer, progress, End session) + content/agent columns |
| `../../design/Session.html` — `ReadingBlock`, `CitationChip` | Reading-block component (Reading badge, domain, TL;DR, "Read full explanation", citation chips) |
| `../../design/Session.html` — `QuizCard`, `QuizOption`, `ConfidenceRating` | Quiz-card component (stem, options with rest/selected/correct/incorrect/dim states, submit/continue, report) + confidence rating |
| `../../design/Session.html` — `AgentPanel`, `AgentBubble`, `ToolCard*` | Agent panel (collapsible rail, message bubbles, tool-result cards, input + quick suggestions) |
| `../../design/Summary.html` — `SummaryPage` (study scene) | End-of-session summary screen (stats strip, readiness change, domains, weak-area movement, strongest/weakest, next-focus, drill CTA) |

**Layout to implement:** A minimal-chrome layout (header only, no app sidebar) for the **session-start** screen, matching the artboard's `MinimalHeader`. The **summary** uses the standard `web-foundation` app shell (`Shell.AppSidebar active="Sessions"`). Build the split-panel `SessionLayout` and the reusable summary body once; the latter is shared into `web-mock-exam`.

> **Reconciliation (accepted, review WARNING):** the **session view** is implemented on the minimal-chrome layout (no app sidebar) rather than the standard app shell. The split-panel `SessionLayout` + custom `SessionHeader` (cert chip, live timer, progress, End session) is a full-width immersive study surface; reintroducing the sidebar would constrain the content/agent columns and duplicate navigation chrome. Accepted as an intentional, non-blocking deviation from the app-shell note above; the **summary** screen still uses the standard shell.

### Design ↔ contract reconciliation

The behavioural spec + the real backend contract win wherever the artboards diverge. The artboards were drawn ahead of the API and assume several fields the contracts do not return.

| Design element | Conflict with contract | Resolution |
|---|---|---|
| SessionStart difficulty pills "Adaptive / Easy / Medium / Hard" | `sessionDifficulties = beginner / intermediate / exam-ready` | Offer Beginner / Intermediate / Exam-ready only. "Adaptive" is not a backend value. |
| SessionStart duration "20 min", slider labels "5m/20m/45m/60m" | `sessionDurationMinutes = [15,30,60,90]` | Offer 15 / 30 / 60 / 90 (discrete control, not a free slider). |
| SessionStart content-mix pills "Questions / Mixed / Concepts" | `sessionContentMixes = balanced / reading-heavy / quiz-heavy / video-based` | Offer Balanced / Reading-heavy / Quiz-heavy / Video-based (4 options; the artboard's 3 omit video-based and mislabel the rest). |
| Custom-config artboard has **no learning-style control** | `createSessionRequestSchema` accepts `learningStyle` (weak-area-focus / spaced-repetition / cram); SPEC Session Personalization lists it as a parameter | Add a learning-style override control. Spec wins over the artboard omission. |
| "~20 questions available" cert chip on custom config | No endpoint returns a pre-creation available-question count | Drop the count, or show the duration-derived expected item count client-side; not presented as a backend figure. |
| Quiz options highlight the **correct** option (B green) after a wrong answer | `SubmitAnswerResponse` returns only `{ id, correct, answer, confidence, timeTakenMs, userCertificationId }` — the correct-answer identity is stored server-side in `questionSnapshot.correctAnswer` but **not exposed** | Colour the **chosen** option correct/incorrect from the `correct` boolean. Do not mark the correct option when the user was wrong unless the explanation (`explainAnswer`) is fetched. Flagged as a candidate backend change (expose `correctAnswer` on submit) — out of scope here. |
| ReadingBlock / QuizCard citation chips labelled "AWS Docs: SCPs" | Session items expose `sourceChunkIds` + `supportingSpans`; quiz provenance exposes structured `Provenance`; no human-readable source title is returned for session items | Render chips from available provenance fields (span/source-id); use the explanation `citations: string[]` where present. Do not invent doc titles. |
| Summary stats strip cells "Time" and "Streak" | `SessionSummaryResponse` has neither | Derive "Time" client-side from session `startedAt`/`endedAt`; drop "Streak" (no backing data). |
| Summary "Domains covered" rows show correct/total counts **and** a per-domain delta | `domains[]` provides `{ domain, accuracy }` only; deltas live separately in `weakAreaDeltas[]`; no per-domain counts exist | Render per-domain accuracy; join the delta from `weakAreaDeltas` by domain; drop the N/total counts. |
| Summary "Weak area movement" shows `before% → after%` absolutes | `weakAreaDeltas[]` provides `{ domain, delta }` only (no absolutes) | Render the delta badge; show absolutes only if separately fetched from weak-areas (not required by spec) — default to delta-only. |
| Summary strongest/weakest cards show "Selected C · Correct was B · 38s" | `strongestQuestion` / `weakestQuestion` provide `{ responseId, question }` only | Render question text + "Ask agent about this" (uses `responseId` → `explainAnswer`). Chosen/correct/time are not in-contract and are omitted. |
| Summary "Drill my misses · 4 questions" miss count | `drill` returns `{ status, session? }`; summary has no miss count | Render "Drill my misses" without a count; on `no_misses` show the empty state. |
| Summary readiness always numeric (`72% → 75%`) | `readiness.before/after/delta` are nullable (not-yet-calibrated) | Show a calibration message when null instead of a numeric change. |
| Summary mock-exam artboard | Mock summary belongs to `web-mock-exam` | Build the study-session path only; expose a reusable summary component for mock reuse. |
| Agent tool cards are static demo data | Real tool output arrives as Vercel AI SDK `tool-result` stream parts forwarded raw by the API (`yield part as SseEvent`), plus `job-event` and `error` events | Key rendering off the AI SDK part shape (`type: 'tool-result'`, tool name, output) — not a bespoke envelope. `semanticSearch` results are not rendered. |

## Test Boundaries

E2E (Playwright) drives the real `apps/web` against a mocked HTTP API so streaming and envelope shapes are exercised deterministically; component/composable unit tests mock the Orval client and the SSE source.

| Dependency | In acceptance test (Playwright e2e) | In unit tests (Vitest) |
|---|---|---|
| Readion API REST endpoints (sessions, quiz, summary, certs, weak-areas) | HTTP mock (Playwright `route` fulfil with envelope-shaped fixtures) | Mocked Orval client functions / vue-query |
| Agent SSE endpoint (`POST /agent-conversations/:id/messages`) | HTTP mock streaming `text/event-stream` chunks incl. `tool-result`, `job-event`, `[DONE]`, `error` | Mocked SSE source / `useEventSource` wrapper |
| `web-foundation` SSE composable | Real (consumes the mocked event stream) | Real for composable specs; mocked where a component is under test |
| Browser router / Pinia / vue-query | Real | Real (or test harness) |
| Auth session | Mocked authenticated state (foundation test helper) | N/A |

## Decisions

- **Quick start = empty-body create.** Quick start sends no overrides so the server applies the profile defaults (single source of truth), avoiding a defaults-drift bug between client and server. Alternative (echo the fetched defaults back in the body) was rejected as redundant and divergence-prone.
- **Treat create 200 and 201 identically.** The backend resumes the existing active session (200) rather than erroring; the UI navigates to the returned session either way, satisfying the one-active-per-enrollment invariant without a separate pre-check call. Alternative (GET active sessions first) adds a round-trip and a race.
- **Render the agent stream from raw AI SDK parts.** The API forwards `result.fullStream` parts unchanged, so the panel consumes `text-delta` / `tool-call` / `tool-result` / `job-event` / `error` part shapes and dispatches tool cards by tool name. Alternative (a normalised event envelope) would require a backend change that does not exist.
- **Confidence is part of the answer submission.** `submitAnswerRequestSchema` carries `confidence`, so the card gates submit on both option and confidence rather than posting a separate confidence call. Matches "confidence after each topic block" by collecting it before the single submit.
- **`timeTakenMs` measured client-side** from card-shown to submit, since the contract requires it and the backend does not time the question.
- **Parse `SessionItem.content` by type.** Reading-item `content` is raw LLM Markdown rendered directly. **Quiz-item `content` is a JSON string** the backend encodes as `{ questionId, question, options, format }`, or `{ insufficient: true, domain }` when generation could not produce a verified question. The frontend MUST `JSON.parse` quiz-item content to obtain the `questionId` used by `POST /quiz/:questionId/submit` and to render the stem/options, and MUST render an insufficient-material item as a gracefully skippable card (mark complete, advance) rather than an empty or broken quiz. Alternative (a structured item DTO) would need a backend change and codegen; the JSON-in-`content` shape is the committed contract.
- **Reusable summary body.** The summary screen body is a standalone component fed a `SessionSummaryResponse`, so `web-mock-exam` can mount it against `mock-exams/:id/summary` without duplication.

## Risks / Trade-offs

- [Correct-option highlight not in contract] → Colour only the chosen option from `correct`; reveal the correct answer via the explanation tool. Flag exposing `correctAnswer` on submit as a follow-up backend change.
- [SSE reliability / mid-turn disconnect] → Rely on the foundation composable's lifecycle handling; surface `error` events inline and keep the panel usable; persisted messages re-hydrate via `agent-conversations/:id?include=messages` on reload.
- [Citation chip labels are chunk-ids/spans, not titles] → Render available provenance without inventing doc titles; revisit if a source-title field is added.
- [Summary fields thinner than the artboard] → Drop unbacked stats (streak, counts, absolutes, miss count) rather than fabricate; documented in reconciliation so reviewers know it is intentional.

## Open Questions

- Should the start screen pre-check for an active session to message "Resuming your in-progress session", or rely solely on the create-200 resume? (Leaning: rely on create-200; optional friendly copy if the response indicates resume.)
- Do reading-block citation chips need a backend source-title field to be useful, warranting a follow-up change? (Tracked as a flag, not blocking.)
