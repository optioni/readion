## Context

The session runner (`apps/web/app/pages/sessions/[id]/index.vue`) and its summary (`summary.vue`) are both driven by `GET /api/v1/sessions/:id` and `GET /api/v1/sessions/:id/summary`. The runner assumes an `active` session: it renders the reading/quiz card, an "End session" control, and an elapsed timer derived from `startedAt`. `useElapsedTimer` ticks `now = Date.now()` every second and returns `now − startedAt`, uncapped, with no awareness of `endedAt`. Nothing in the page branches on `session.status`, so a `completed` / `partial` / `abandoned` session renders the same interactive runner with a timer that free-runs from the original start (observed "2910:42").

This change is UI-only. The API already distinguishes lifecycle state (`SessionResponse.status` ∈ `active` | `completed` | `partial` | `abandoned`, plus `startedAt` and nullable `endedAt`) and already reports `questionsAnswered: 0` for a session with no responses. The summary API contract in `openspec/specs/session-summary/spec.md` is out of scope and unchanged.

## Goals / Non-Goals

**Goals:**
- An ended session (`completed` / `partial` / `abandoned`) never renders the active runner: no free-running/uncapped timer, no "End session"/"Continue" control; it routes to the summary or a read-only completed state.
- Displayed session time for an ended session is frozen at `endedAt − startedAt` and never computed as `now − startedAt`.
- Citation chips render human-readable source labels; a raw content-chunk UUID is never shown as a chip label.
- The reading block shows its domain label; the quiz card shows a "Q n of m" position label.
- The summary shows an explicit zero-state when `questionsAnswered === 0`, plus the designed page header, a dedicated readiness before→after strip, and a Streak stat sourced from existing data.

**Non-Goals:**
- No backend/API changes. `GET /sessions/:id` and `GET /sessions/:id/summary` already return everything needed; `openspec/specs/session-summary/spec.md` is untouched.
- No new summary data: per-domain question counts, weak-area absolute before/after values, next-focus rationale, and a miss count are NOT in the summary contract and are NOT introduced or fabricated.
- No redesign of the active session runner behaviour (counting up during an active session is by design).
- No changes to the agent panel, quiz submission, drill, or go-deeper flows beyond the label/lifecycle fixes above.

## Visual Design

Visual source of truth: the local design mockups, imported into this change at `design/Session.html` and `design/Summary.html` (copied from `openspec/design/`). These `.html` files are authoritative for layout, labels, and states.

| Artboard / screen | Maps to |
|---|---|
| Session.html → `SessionHeader` (elapsed timer + `current/total` + "End session") | `apps/web/app/components/SessionHeader.vue` (active-only controls) + `sessions/[id]/index.vue` header slot |
| Session.html → `ReadingBlock` ("Reading" pill + domain label + TL;DR + `CitationChip`s) | `apps/web/app/components/ReadingBlock.vue` + `CitationChip.vue` |
| Session.html → `QuizCard` ("Question" pill + "Q n of m") | `apps/web/app/components/QuizCard.vue` |
| Summary.html → page header ("Session complete" badge, "Study Session · CODE", cert · duration, timestamp) | `sessions/[id]/summary.vue` + `SessionSummaryBody.vue` header |
| Summary.html → `StatsStrip` (4 cells incl. Streak) | `SessionSummaryBody.vue` stat strip |
| Summary.html → `ReadinessChange` (before → after strip) | `SessionSummaryBody.vue` readiness strip |
| Summary.html → `DomainsCard` / `WeakAreasCard` / `QuestionHighlight` / `NextSessionCard` / `CTARow` | `SessionSummaryBody.vue` (existing sections) |
| Summary.html → zero-state (no design artboard) | new `SessionSummaryBody.vue` empty state when `questionsAnswered === 0` |

**Layout to implement:** reuse the existing `SessionLayout` (Session) and the summary page column (`summary.vue` + `SessionSummaryBody.vue`); no new shared layout. The active-only controls (timer tick, End session, Continue) must be gated behind an `isActive` derivation so the ended state reuses the same layout without those controls.

### Design ↔ contract reconciliation

The Summary mockup was drawn ahead of the current `SessionSummaryResponse` contract and shows several fields the API does not provide. The behavioral spec wins; these diverge as follows:

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Streak stat "4 · sessions in a row" | `SessionSummaryResponse` carries no streak; the only existing streak signal is `useActivityStats.currentStreakDays` (a consecutive-**day** streak derived from the session list) | Reuse `currentStreakDays` and label it as a day streak; do NOT fabricate a "sessions in a row" count. Omit the cell when no streak signal is available |
| Per-domain `correct/total` counts + accuracy bars | `domains[]` provides `{ domain, accuracy }` only — no counts | Render per-domain accuracy (the bar) from `accuracy`; do NOT render `correct/total` counts |
| Weak-area `before% → after%` absolute values | `weakAreaDeltas[]` provides `{ domain, delta }` only | Render the delta badge only; do NOT render absolute before/after |
| "Drill my misses · N questions" miss count | contract has no miss count | Keep the "Drill my misses" CTA without a fabricated count |
| Next focus rationale sentence | `nextFocus` is `{ domain }` only | Render the domain; do NOT fabricate a rationale |
| Question highlight "Selected X · Correct was Y · in Ns" | `strongest/weakestQuestion` is `{ responseId, question }` only | Render the question text + "Ask agent about this"; do NOT fabricate chosen/correct/time |
| Zero-state (no answered questions) | design has no zero-state artboard | New explicit empty state when `questionsAnswered === 0` (spec ADDED requirement) |
| Citation chip label | design shows a human title ("AWS Docs: SCPs"); item provenance is `sourceChunkIds` (UUIDs) + `supportingSpans` (text) | Map `sourceChunkIds` to human labels with a generic "Source" fallback; never render the UUID |

## Test Boundaries

The acceptance test is a Playwright e2e driving the running web app; the API is stubbed at the HTTP boundary so the ended-session, citation, and zero-state fixtures are deterministic. Inner tests are Vitest component/unit tests with the query layer mocked.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| `GET /api/v1/sessions/:id?include=items` (session + items, incl. `status`/`startedAt`/`endedAt`) | HTTP-stubbed (Playwright route fulfil) with completed + active + citation fixtures | mocked (`fetchSessionDetail` / vue-query stub) |
| `GET /api/v1/sessions/:id/summary` | HTTP-stubbed with `questionsAnswered: 0` and a populated fixture | mocked (`fetchSessionSummary`) |
| `POST /sessions/:id/end`, `/items/:i/complete`, `/items/:i/go-deeper`, `/quiz/*` | HTTP-stubbed; asserted NOT called for an ended session | mocked |
| Existing streak signal (`useActivityStats` over the session list) | real composable over stubbed session data | real composable / mocked input |
| Postgres / Redis / worker | not involved (UI-only change) | not involved |
| LLM / agent SSE | not exercised by these fixtures | not exercised |
| Browser clock (`Date.now`) for timer freeze | real (assert value stable across samples for ended session) | controllable/faked to assert `endedAt − startedAt` and no interval |

## Decisions

- **Ended-session routing: redirect to summary.** When the loaded session's `status` is any terminal value (`completed`, `partial`, `abandoned`) the runner MUST NOT mount the active runner. The default behaviour is to **redirect to the session summary** (`sessionSummaryPath(id)`), which is the canonical post-session surface and already exists. A read-only "completed" state within the runner is an acceptable alternative, but redirect is preferred because the summary is the designed destination and avoids duplicating the runner in a disabled mode. Either way, an ended session MUST NOT show a running/uncapped timer or an "End session" / "Continue" control. Alternative (render the runner disabled) rejected: it duplicates the runner in a dead mode and risks re-introducing the interactive controls.
- **Frozen time from `endedAt − startedAt`.** For any session that is not `active`, `useElapsedTimer` computes elapsed once as `endedAt − startedAt` (the same computation `summary.vue:48-60` already uses), formats it, and does not start (or immediately clears) the 1-second interval. Only an `active` session with a null `endedAt` ticks live from `startedAt`. This makes a free-running timer structurally impossible on an ended session. Alternative (clamp `now − startedAt` to `endedAt`) rejected: still ticks and depends on wall-clock alignment.
- **Citation labels are human, resolved at the source.** Citation chips render a human-readable source label (title). A raw content-chunk id/UUID MUST never be used as a chip label; when only ids are available and no title can be resolved, the chip falls back to a generic "Source" label rather than exposing the id. `supportingSpans` (already human text) may render as-is; `sourceChunkIds` MUST be mapped to labels, not printed verbatim.
- **Summary zero-state gates the data cards.** When `questionsAnswered === 0` the summary renders an explicit "No questions answered this session" empty state and suppresses the accuracy, readiness-delta, weak-area, and domains cards (which would otherwise render 0%/+0%/↑0% noise). The page header and CTAs (e.g. Back to dashboard) still render.
- **Streak is sourced, never fabricated.** The design's fourth stat cell (Streak) is not in the summary payload. It is read from the enrollment's existing streak signal (`useActivityStats.currentStreakDays`, as the Progress surface already does) and labelled as a day streak. If unavailable, the stat cell is omitted. No per-domain question counts, weak-area absolute before/after values, or miss count are introduced — those are not in the contract and remain out of scope.

## Risks / Trade-offs

- **Redirect vs read-only** → a hard redirect from the runner to the summary means a deep link to `/sessions/:id` for an ended session lands on `/sessions/:id/summary`. Intended; the acceptance test asserts the ended session does not present the active runner rather than pinning the exact mechanism.
- **Streak source coupling** → reading streak from `useActivityStats` couples the summary to the session-list-derived signal. Mitigation: keep it optional (omit when absent) to avoid a hard dependency and honour the non-fabrication rule.
- **Citation label resolution** → if no title source is wired, every chip could collapse to "Source". Mitigation: the fallback is acceptable and strictly better than leaking a UUID; wiring richer titles is additive and non-blocking.

## Open Questions

- Whether an ended session should hard-redirect to the summary or render an in-place read-only completed state — the spec allows either; redirect is the recommended default. To be confirmed at implementation against navigation UX.
- The exact streak label copy on the summary stat cell (day streak) given the design's "sessions in a row" wording — resolved toward the real `currentStreakDays` unit; final copy left to implementation.
