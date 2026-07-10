## Context

37 findings across the five study-flow surfaces. This change reconciles them against `web-session-view`, `web-mock-exam`, and `web-progress`, and against the shared session-summary DTOs — a large cluster of summary findings is blocked on data the app doesn't have, and several session/review findings are already-decided behavior.

**Amendment (post-planning):** two Study-session findings — the ReadingBlock domain label and the topic-specific confidence prompt — were originally reconciled below as no-dependency presentational fixes. Implementation investigation found that was wrong: `SessionItem` (the persisted row, `packages/db`) carries no `domain` column, and `mapItemToDto` (`apps/api/src/sessions/sessions.service.ts`) never forwarded `itemPlan.domain` (computed per-item by `session-planner.ts`, including the round-robin/`auto`-focus-area case) into the API response. The currently-archived `web-session-view` spec already documented this gap as explicitly deferred. Per an explicit decision, this change now includes the small backend addition rather than descoping: a `SessionItem.domain` column + migration, persisting `itemPlan.domain` at generation time in both `apps/api/src/sessions/sessions.service.ts` (synchronous item generation) and `apps/worker/src/sessions/session-item-generator.service.ts` (async fill-queue generation), and surfacing it via `SessionItemResponse`/`SessionItemResponseDto` + `yarn codegen`. This is the one exception to "no API/DB changes" in this otherwise web-only parity change. The row below is updated to reflect it.

## Reconciliation decisions

| Finding(s) | Screen | Decision | Rationale |
|---|---|---|---|
| Persistent app sidebar (high) | Study session | **Fix** | Design + manifest put the session in the app shell (Sessions active); the app uses `minimal` (no nav). |
| Simultaneous Reading + Quiz cards (high) | Study session | **Descope** | Spec pre-generates and resumes items by index (one at a time); pairing reading+quiz is a larger interaction redesign, not fidelity. |
| Confidence submit-then-rate vs rate-then-submit (high) | Study session | **Reaffirm app** | Spec: "confidence rating is required." Rating before seeing the result is deliberate (avoids hindsight bias). |
| ReadingBlock "Continue" button (medium) | Study session | **Reaffirm** | Needed to advance the speced sequential item model. |
| Confidence topic copy, ReadingBlock domain label | Study session | **Fix (API/DB addition)** | Needs a real per-item `SessionItem.domain` column + migration; `itemPlan.domain` is already resolved server-side per item (including round-robin across target domains, and `focusArea: 'auto'`) but was discarded before reaching the client. See amendment above. |
| Collapsed rail, online dot, avatar, Q-spacing | Study session | Fix | Fidelity, no data dependency (avatar already shipped in `fix-web-settings-agent-parity`). |
| Cert identity pill; humanized defaults; brand mark | Session start | Fix | Fidelity (defaults via the shared label map). |
| Weak-area before/after; question highlight metadata; domains-covered progress bar + correct/total; next-focus reason; miss-count preview (3 high + mediums) | Session summary | **Descope → contract change** | Each traces to a shared DTO that doesn't carry the data (`WeakAreaDelta`, `SessionQuestionRef`, `SessionSummaryDomainStat`, `nextFocus`). Enriching them is `packages/shared` + API + worker work, not web fidelity. |
| Streak metric: sessions-in-a-row vs day-streak (medium) | Session summary | **Reaffirm app** | The day-streak is speced, real data; "sessions in a row" is a different metric. |
| Readiness-bar gradient/arrow; relative timestamp; content width; drill-CTA icon; accuracy value order | Session summary | Fix (presentational) | Fidelity, no data dependency. |
| Double header (high) | Mock exam | **Fix** | `minimal` layout header stacks above `ExamHeader`; the design has one full-screen bar. |
| Per-question flag state + nav "Flagged" square + legend (high/medium) | Mock exam | **Fix (client-side)** | Flag state keyed by index, reflected in the nav grid; in-session (persistence across reload optional, not required by any spec). |
| Header logo mark, flag/timer icons, code-only identity | Mock exam | Fix | Fidelity. |
| Queue hero icon, centered layout, plain headline, SRS caption, "By domain" label, countdown timer | 5-min review | Fix | Fidelity + a live client-side countdown display. |
| "Prefer quiz instead?" mode toggle (medium) | 5-min review | **Reaffirm** | The quiz+confidence loop is a speced `web-progress` requirement; the artboard only depicts the flashcard loop. |

## Net scope

Presentational fixes + two layout corrections (session app-shell, mock single-header) + one behavioral fidelity add (per-question flagging, client-side) + a live review countdown + one small backend addition (`SessionItem.domain`, persisted and surfaced for the ReadingBlock label and confidence-prompt interpolation). The item model, confidence flow, streak metric, and quiz-mode toggle are reaffirmed. The session-summary data-carried fields remain the one genuinely blocked cluster and are handed to a follow-up contract change — unlike the session-item domain, that cluster spans four separate DTOs (`WeakAreaDelta`, `SessionQuestionRef`, `SessionSummaryDomainStat`, `nextFocus`) and is a larger, separately-scoped effort.

## Follow-ups (not this change)

- **`enrich-session-summary-contract`** (separate): add before/after to `WeakAreaDelta`, chosen/correct/time to `SessionQuestionRef`, correct/total to `SessionSummaryDomainStat`, and a reason to `nextFocus`; populate them in the API/worker; then the summary's before/after, question metadata, domain bars, next-focus reason, and miss-count preview become presentational follow-ups.
- If product wants the design's paired reading+quiz interaction or a "sessions in a row" streak, each is its own change.
