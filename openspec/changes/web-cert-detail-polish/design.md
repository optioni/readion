# Design — web-cert-detail-polish

Frontend-only fidelity polish on the shipped CertDetail Overview. No API change, no codegen. Reconciles the artboard (`openspec/design/CertDetail.html`) against the real Vue implementation under `apps/web/app/`.

## Blocker check — questions answered + accuracy are available

Not blocked. Both fields already exist on the session-summary read model and are already fetched by the Overview.

- `SessionSummaryResponseDto` exposes `questionsAnswered: number` and `accuracy: number` (`apps/web/src/api/model/sessionSummaryResponseDto.ts`).
- The Overview already joins each cert's completed-session summaries into a `Map<sessionId, SessionSummaryResponseDto>` via `fetchRecentSessionSummaries` (`apps/web/app/composables/recentSessionSummaries.ts`), consumed by `useOverviewSessions` (`apps/web/app/composables/useOverviewSessions.ts`).
- The aggregation pattern is already proven by progress-fidelity's `useActivityStats` (`apps/web/app/composables/useActivityStats.ts`, lines 60–63): `questionsAnswered` is summed across the summaries map. The accuracy figure is the mean of the summaries' per-session `accuracy`.

So the 4th stat is derivable client-side from already-loaded fields — no backend scope.

## Artboard vs. real code reconciliation

- The artboard stat row shows four cards: Readiness, Sessions, Questions, Avg accuracy (it omits Due reviews). The proposal (source of truth) frames this as "3 → 4" keeping the existing three real stats (Readiness, Sessions, Due reviews) and adding a single questions/accuracy 4th stat. We follow the proposal: keep Due reviews, add the questions-answered/accuracy stat as the 4th. The artboard's separate "Questions" and "Avg accuracy" cards are collapsed into one stat card carrying the questions total plus an accuracy figure.
- The artboard's "Suggested next" callout already is the weakest-domain panel: it shows the lowest domain ("IAM & Security") with its score (45%). The real code already has a Suggested Next Focus panel; this change positions it as the weakest-domain side panel paired beside the domain breakdown and surfaces the score on the weak-area fallback.

## Stat row (4th stat) — derivation

- Source map: the completed-session summaries already produced inside `useOverviewSessions` (`fetchRecentSessionSummaries`). Surface the summary objects (or a pre-aggregated `{ questionsAnswered, accuracy }`) from the composable alongside `sessions` / `totalSessions` / `nextFocusDomain`.
- `questionsAnswered` = sum of `summary.questionsAnswered` over the available summaries (mirrors `useActivityStats`).
- accuracy figure = mean of `summary.accuracy` over the available summaries; colour via the status scale (`scoreColor` / `statusColor`).
- Empty state: no summaries → `0` questions, no accuracy figure.
- Note: `useOverviewSessions` currently lists with `limit: RECENT_SESSIONS_LIMIT` (3). The aggregated figure reflects whatever summaries the Overview has loaded; if a true all-time per-cert total is wanted later, widen the list query — out of scope here, the read model already exposes the fields.

## Weakest-domain side panel — selection logic

- The lowest-scoring domain is already computed by `selectSuggestedNextFocus` (`apps/web/app/composables/suggestedNextFocus.ts`): it returns the session `nextFocus.domain` when present, else the weak area with the minimum `score`.
- For the panel to surface the weakest domain's score on the weak-area fallback, expose the selected weak area's `score` (the `WeakAreaResponseDto.score`, `apps/web/src/api/model/weakAreaResponseDto.ts`) from the selection helper, not just its `domain` name.
- Weak areas come from `useCertWeakAreas` (`apps/web/app/composables/useCertWeakAreas.ts`) — the same source the domain breakdown already uses, so the side panel adds no new request.

## Components to change

- `apps/web/app/components/OverviewTab.vue` — stat row currently `grid-cols-3` with three fixed cards (lines ~43–66); add the 4th questions/accuracy card and switch to a 4-up grid. Position the Suggested Next Focus panel as the weakest-domain side panel alongside the Domain Breakdown card (the artboard pairs them in a two-column row).
- `apps/web/app/composables/certStatRow.ts` — extend `CertStatRow` / `formatCertStatRow` to carry `questionsAnswered` and the accuracy figure.
- `apps/web/app/composables/useOverviewSessions.ts` — expose the aggregated questions/accuracy (or the summaries map) so the stat row can read them.
- `apps/web/app/composables/suggestedNextFocus.ts` — return the weakest domain's score for the side-panel display.

## Side-panel layout

Two-column Overview body (matching the artboard): the Domain Breakdown card on the left (flex/main column), the weakest-domain side panel on the right as a fixed-width column. The side panel shows the weakest domain name and, on the weak-area fallback, its score; it stays informational (no dates/reminders).
