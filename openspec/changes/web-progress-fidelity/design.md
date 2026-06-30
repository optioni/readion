# Design — web-progress-fidelity

Frontend-only fidelity pass reconciling the live Progress page with the `openspec/design/Progress.html` artboard. No API change, no codegen. Workspace: `@readion/web`.

## Blocker check — study time + current streak availability

The proposal mandates stopping if Study time or Current streak are absent from the read model. Inspection result: **not blocked — both are derivable client-side from fields the Progress page already loads.**

Read models inspected:

- `apps/api/src/readiness/readiness.controller.ts` + `packages/shared/src/readiness/index.ts` — `ReadinessResponse = { calibrated, score, trajectory: { weeksToReady } | null }`. No study-time or streak field; only `weeksToReady` for the callout.
- `apps/api/src/sessions/sessions.controller.ts` — `SessionResponse` exposes `durationMinutes`, `startedAt`, `endedAt`, `kind`, `status` (lines 84, 96–98). The list is paginated (`page`/`limit`).
- `packages/shared/src/session-summary/index.ts` — `SessionSummaryResponse.questionsAnswered`, `.accuracy`, `.readiness.{before,after,delta}`.
- Orval client mirrors: `apps/web/src/api/model/readinessResponseDto.ts`, `readinessTrajectoryDto.ts`, `sessionReadinessChangeDto.ts` (+ session/summary DTOs). No streak/study-time fields generated.

Verdict per field:

- **Study time** — no dedicated field, **derivable** by summing `SessionResponse.durationMinutes` across sessions. Already surfaced as `MergedHistoryRow.durationMinutes` (`apps/web/app/composables/useSessionHistoryMerge.ts`). Mock attempts carry `durationMinutes: null`, so study time covers study/review sessions only.
- **Current streak** — no dedicated field, **derivable** from `SessionResponse.startedAt` (consecutive calendar days with ≥1 session). Already surfaced as `MergedHistoryRow.startedAt`.
- **Pace rate** for the callout — no dedicated field; `weeksToReady` is exposed. The "X% readiness/session avg." rate is **derivable** from the readiness series (`useReadinessTrend`) as the average per-session readiness gain.

Caveat (design note, not a blocker): `useProgressData` fetches sessions at `page 1, limit 50` (`apps/web/app/composables/useProgressData.ts` lines 65–71), so Study time / Current streak / Sessions totals are bounded to the most recent 50 sessions — the same bounded fan-out the spec already accepts for accuracy and history. If exact lifetime aggregates are later required, that is a separate backend change.

## Stat row — field mapping (4 cards)

Replaces the current 2-card block in `apps/web/app/pages/user-certifications/[id]/progress.vue` (lines 70–79), where `sessionCount` and `questionsAnswered` are computed inline and the Questions card is conditionally hidden.

| Card | Source | Derivation |
| --- | --- | --- |
| Sessions | session list | count of sessions (study/review) for the enrollment |
| Questions answered | `SessionSummaryResponse.questionsAnswered` | sum across completed-session summaries (`summariesMap`) |
| Study time | `SessionResponse.durationMinutes` | sum of session durations, formatted `h`/`m` |
| Current streak | `SessionResponse.startedAt` | consecutive days ending on the latest active day, "days" unit |

Approach: extract the derivations into a small co-located, unit-tested composable (e.g. `useActivityStats`) fed by the same `sessions` + `summariesMap` already exposed by `useProgressData`, and render through a shared stat-card so all four cards share markup/labels with the artboard. Cards always render (zero/empty values instead of conditional hiding).

## Readiness line chart

Component: `apps/web/app/components/ReadinessTrend.vue` (currently a bare `<polyline>` with only a current-value label, no points/axis ticks). Series: `apps/web/app/composables/useReadinessTrend.ts` → `{ points: number[], hasData: boolean }`, where `points = [...completed-session readiness.after, currentReadiness.score]`.

Changes to match the artboard's `ReadinessChart`:

- Render a `<circle>` point marker per value in `points`, with the last point emphasized (larger radius).
- Render y-axis percentage tick labels (e.g. 25/50/75/100) and keep the current value % label.
- Preserve the existing `hasData === false` → "not yet calibrated" early state (`data-testid="progress-not-calibrated"`); no points/axis/value in that branch.

No backend series exists; this stays a client-side SVG over the derived `points`. Reuse existing chart scaling math already in the component.

## Pace / trajectory callout

Component: `apps/web/app/components/TrajectoryCallout.vue` (currently terse: "Exam-ready in ~{weeksToReady} weeks", driven solely by `weeksToReady` from `useProgressData`). `weeksToReady` originates from `ReadinessResponse.trajectory.weeksToReady`.

Changes to match the artboard's `TrajectoryCallout` / `TrajectoryInsufficient`:

- Calibrated branch: add the trend icon and fuller copy — "At your recent pace ({rate}% readiness/session avg.), you'll be exam-ready in approximately {weeksToReady} weeks." The `rate` is derived client-side from the readiness series (average per-session readiness gain over `useReadinessTrend` points); pass it into the component alongside `weeksToReady`.
- Uncalibrated/insufficient branch: keep the existing "complete at least N sessions" hint (artboard's `TrajectoryInsufficient`), shown when `weeksToReady` is null — no projected weeks, no pace rate.
- Single formatter for the pace string (per tasks.md 3.3).

## Components / files to change

- `apps/web/app/pages/user-certifications/[id]/progress.vue` — swap the 2-card block for the 4-card stat row; wire pace rate into `TrajectoryCallout`.
- `apps/web/app/components/ReadinessTrend.vue` — add points + axis ticks (+ keep value).
- `apps/web/app/components/TrajectoryCallout.vue` — fuller copy + trend icon + pace rate prop.
- New: a stat-card component + `useActivityStats` composable (study-time / streak derivations), co-located unit tests.
- Tests: `apps/web/tests/components/ReadinessTrend.spec.ts`, `tests/components/TrajectoryCallout.spec.ts`, new stat-row/composable specs; e2e `apps/web/e2e/progress.e2e.ts`.

## Out of scope

Accuracy chart (`AccuracyBars`) and per-domain bars (`ProgressDomainRow`) — already handled by `web-progress-accuracy-chart-fix` and `web-domain-score-bars`; the readiness/accuracy requirement is reproduced whole in the delta but only its readiness-line aspects change.
