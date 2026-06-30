# Design — web-progress-accuracy-chart-fix

## Context

The Progress page renders a "Quiz accuracy" / per-session bar chart. In the shipped page the chart shows only the per-bar percentage labels (e.g. 60 / 70 / 75) with no visible bars. The artboard `openspec/design/Progress.html` (`AccuracyBars` component, lines ~234-252) shows a per-session accuracy bar chart with the latest session emphasized in the accent colour and the rest in the muted border colour.

This is a frontend-only fidelity/bug fix. No API, DTO, or codegen change is involved — the data the chart needs already exists in the read model.

## Implemented surfaces (source of truth in code)

- Chart component: `apps/web/app/components/AccuracyBars.vue`
- Series composable: `apps/web/app/composables/useAccuracySeries.ts` (returns `AccuracyPoint[]`, where `AccuracyPoint = { sessionId: string; accuracy: number }`)
- Wiring: `apps/web/app/composables/useProgressData.ts` builds `accuracySeries` and `apps/web/app/pages/user-certifications/[id]/progress.vue` renders `<AccuracyBars :series="accuracySeries" />`
- Chronology/completion helpers: `apps/web/app/composables/sessionSummaryHelpers.ts` (`isCompletedSession`, `chronologicalByStartedAt`)
- Existing tests: `apps/web/tests/components/AccuracyBars.spec.ts`, `apps/web/tests/composables/accuracy-series.spec.ts`, `apps/web/tests/pages/user-certifications/progress.spec.ts`
- E2E: `apps/web/e2e/progress.e2e.ts`

## Artboard vs. implementation reconciliation

The artboard `AccuracyBars` (React) computes an explicit pixel height per bar:

```jsx
const maxH = 56;
const barH = (s.accuracy / 100) * maxH; // pixels, against a fixed-height row
// bar: style={{ height: barH, ... minHeight: 2 }}
```

The container is `display:flex; align-items:flex-end; height: maxH + 20` and each bar's height is an absolute pixel value, so it always draws.

The real Vue component (`AccuracyBars.vue`) instead uses a **percentage** height on the bar:

```html
<div v-if="series.length > 0" class="flex h-20 items-end gap-1">
  <div ... class="relative flex flex-1 flex-col items-center justify-end">
    <span ...>{{ point.accuracy }}</span>
    <div class="w-full rounded-t bg-readion-primary/60"
         :style="{ height: `${point.accuracy}%` }" />
  </div>
</div>
```

The field names already match the series (`point.sessionId`, `point.accuracy`), and the `v-for` produces one `[data-testid="accuracy-bar"]` column per session — so the count is correct and the labels render. That is why the labels (e.g. 60/70/75) are visible.

## Root cause of the empty chart

The bar's height is `height: ${point.accuracy}%` — a **percentage** height. A percentage height resolves against the parent's *definite* height. The bar's parent is the per-session column (`flex flex-1 flex-col items-center justify-end`), which has **no defined height**. The outer row is `flex h-20 items-end`: the `items-end` (`align-items: flex-end`) overrides the flex default of `stretch`, so the columns are **not** stretched to the row's `h-20` height — each column sizes to its content (the label span + the bar). With an auto/content-sized parent, a percentage height on the bar has no definite basis to resolve against and collapses to ~0. Result: the per-bar labels render, the bars do not.

This matches the proposal's observation ("axis ticks / labels render, the series isn't drawn") and is purely a CSS layout bug in `AccuracyBars.vue`; the series data (`accuracySeries`) is correct.

## Fix approach (frontend-only)

In `apps/web/app/components/AccuracyBars.vue`, give the bar's height a **definite basis** so the percentage resolves, mirroring the artboard's fixed-height intent:

- Make each per-session column take the full chart height so the bar percentage resolves against it — e.g. stretch the columns (use the default `items-stretch` on the row, keeping `justify-end` on the column to anchor the bar to the bottom), or add `h-full` to the column, or
- Compute an explicit pixel/`vh`-independent height per bar from a fixed `maxH` as the artboard does (`barH = accuracy/100 * maxH`, with a small `min-height` so very low scores still show a sliver).

Either approach must keep:
- One `[data-testid="accuracy-bar"]` per series entry.
- The most-recent session emphasized (accent colour vs. muted for the rest), per the artboard.
- The existing explicit empty state (`v-else` "No accuracy data yet") shown **only** when `series.length === 0`.

## Testing

Following outside-in TDD:
1. Extend `apps/web/e2e/progress.e2e.ts` to assert one drawn bar per session (a measured non-zero height), not just labels, for a seeded multi-session enrollment.
2. Extend `apps/web/tests/components/AccuracyBars.spec.ts`: a non-empty series renders N bars each with a non-zero drawn height and the latest emphasized; an empty series renders the explicit empty state and zero bars.
3. Apply the CSS fix to make them pass.

## No backend impact / no blocker

The accuracy value is already present in the API read model via `sessionSummaryControllerSummary.accuracy` (`SessionSummaryResponseDto.accuracy`), consumed in `useAccuracySeries.ts`. No accuracy-series field is missing, so there is no blocker and no backend scope is added.
