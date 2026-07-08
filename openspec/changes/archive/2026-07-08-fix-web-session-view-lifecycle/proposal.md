## Why

A UI walkthrough of the session view against `openspec/design/Session.html` and `Summary.html` surfaced one high-severity lifecycle defect and several fidelity gaps, all UI-only (the underlying APIs return correct data):

- **Completed session renders the live runner (HIGH).** `apps/web/app/pages/sessions/[id]/index.vue` has no ended-session branch, and `apps/web/app/composables/useElapsedTimer.ts` computes `now − startedAt` on a 1-second interval, uncapped, and never reads `endedAt`. Opening a `completed` / `partial` / `abandoned` session shows the reading/quiz card, a "Continue" affordance and an "End session" button, with the timer free-running to values like **"2910:42"** (~49h). The active session counting up is by design; the defect is the uncapped free-run on an already-ended session plus the still-interactive controls.
- **Citation chip leaks a raw content-chunk UUID (MEDIUM).** `ReadingBlock.vue` builds citation labels as `[...sourceChunkIds, ...supportingSpans]`, so the first chip renders a bare UUID (`bb9dd4b7-…`) where a human source label ("AWS Docs: SCPs") belongs.
- **Reading block omits the domain label.** `index.vue` renders `<ReadingBlock>` without the `:domain` prop, so the design's "Reading · IAM & Security" domain label is missing even though the component supports it.
- **Quiz card omits the "Q n of m" label** the design shows beside the "Question" pill.
- **Summary zero-state reads as broken.** For a completed session with no answered questions (`questionsAnswered === 0`), the summary renders "ACCURACY 0% · 0/0", "READINESS +0% 19%→19%", every weak area "↑0%", and an empty "Domains covered" box with no messaging. There is no explicit empty state.
- **Summary structural fidelity gaps.** The summary is missing the design's page header (Session-complete badge, "Study Session · CODE" title, cert · duration, timestamp) and the dedicated Readiness-change before→after strip, and its stat strip has three cells where the design has four (adds Streak).

The API contracts are correct: `GET /sessions/:id` returns the real `status`/`endedAt`, and `GET /sessions/:id/summary` correctly reports `questionsAnswered: 0`. This change is UI-only and does not touch the summary API contract (`openspec/specs/session-summary/spec.md`).

## What Changes

- The session view MUST detect an **ended session** (`status` of `completed` / `partial` / `abandoned`) and stop rendering the active runner — routing to the summary or presenting a read-only completed state — rather than the reading/quiz card with live controls.
- `useElapsedTimer` MUST freeze displayed time at `endedAt − startedAt` for an ended session and stop the 1-second interval, so no ended session shows a free-running or uncapped timer.
- Citation chips MUST render **human source labels**, never raw content-chunk UUIDs/ids.
- The reading block MUST render its **domain label** beside the "Reading" pill.
- The quiz card MUST render a **"Q n of m"** position label beside the "Question" pill.
- The summary MUST render a **"no questions answered this session" zero-state** when `questionsAnswered === 0`, suppressing the misleading accuracy/readiness/domains cards.
- The summary MUST render the design's **page header** and a dedicated **readiness-change before→after strip**, and its stat strip MUST include a **Streak** stat sourced from existing streak data (omitted, never fabricated, when unavailable).

## Capabilities

### Modified Capabilities
- `web-session-view`: adds the ended-session lifecycle branch + frozen time, human citation labels, reading-block domain label, quiz "Q n of m" label, and the summary zero-state / readiness strip / streak stat structural elements.

## Impact

- **`apps/web`:** `app/pages/sessions/[id]/index.vue` (ended-session branch + pass `:domain`), `app/composables/useElapsedTimer.ts` (freeze at `endedAt − startedAt`, stop interval when ended), `app/components/ReadingBlock.vue` + `CitationChip.vue` (human labels, not chunk ids), `app/components/QuizCard.vue` ("Q n of m"), `app/pages/sessions/[id]/summary.vue` + `app/components/SessionSummaryBody.vue` (zero-state, page header, readiness strip, streak cell).
- **No backend changes.** `GET /sessions/:id` already returns `status`/`endedAt`; `GET /sessions/:id/summary` already returns `questionsAnswered`/`readiness`. The summary API contract (`openspec/specs/session-summary/spec.md`) is unchanged.
- **Data note (Streak):** the streak value is not in the summary payload; the summary view sources it from the enrollment's existing streak signal (the same data the Progress surface's "Current streak" uses). When no streak signal is available the stat is omitted, never fabricated. No per-domain question counts, weak-area absolute before/after values, or miss count are introduced (not in the contract).
- **Tests:** new Playwright e2e reproducing the completed-session free-running-timer bug; component/unit tests for the timer freeze, citation labelling, quiz label, and summary zero-state.

## Deferred / follow-up

- **Reading-block domain label (tasks 4.1–4.2) is deferred.** This proposal assumed the reading item already carried a domain that only needed wiring into `ReadingBlock`, but `GET /api/v1/sessions/:id?include=items` exposes no per-item domain: the `SessionItem` entity (`packages/db/src/entities/session-item.entity.ts`) has no `domain` column, and `mapItemToDto` in `apps/api/src/sessions/sessions.service.ts` returns only `index/type/content/completed/sourceChunkIds/supportingSpans`. The worker generates each item from `itemPlan.domain` but discards it. Rendering the "Reading · <domain>" label therefore requires a backend change (persist `SessionItem.domain` + migration, expose it in the DTO/shared type, regenerate the Orval client) — out of scope for this web-only fidelity fix. `ReadingBlock.vue` keeps its already-present optional `:domain` prop (currently unused) so a later dedicated change can wire it once the API carries the field. The corresponding acceptance assertion was removed from `session-view-lifecycle.e2e.ts` rather than left passing against a fabricated fixture field.
