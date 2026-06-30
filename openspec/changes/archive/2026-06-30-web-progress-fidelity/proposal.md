## Why

The Progress page is materially thinner than the design (`openspec/design/Progress.html`, observed 2026-06-30): the stat row shows **2 cards** (Sessions, Questions) where the design shows **4** (Sessions, Questions answered, Study time, Current streak); the readiness chart is a bare line (no points/axis/value) vs the design's labelled line chart; and the pace callout is a terse "Exam-ready in ~3 weeks" vs the design's "At your recent pace (X%/session avg.) … ~N weeks" with a trend icon. (The empty accuracy chart and text-only domain rows are handled by the separate `web-progress-accuracy-chart-fix` and `web-domain-score-bars` changes.)

## What Changes

- Stat row: add **Study time** and **Current streak** cards to reach the design's 4 (use existing progress read-model fields; if Study time / streak aren't exposed by the API, STOP and flag — do not add backend scope here).
- Readiness chart: render the **line chart with points, axis, and the current value %** per the artboard.
- Pace callout: restore the **fuller pace copy** (recent pace rate + estimated time-to-ready) with the trend icon; keep the uncalibrated/insufficient-data branch ("Complete at least N sessions…").

## Capabilities

### Modified Capabilities
- `web-progress`: 4-card stat row (adds Study time + Current streak), a points/axis readiness line chart, and the fuller pace-estimate copy.

## Impact

- **Code**: `apps/web/app/` Progress page + stat-card / readiness-chart / pace-callout components; vitest tests; Playwright e2e. Consumes `web-domain-score-bars`. No API change expected — flag if a needed field (study time, streak) is absent. No codegen.
- **No new entity/migration.**
- **Dependencies**: `web-app-shell-sidebar` (renders inside the shell), `web-domain-score-bars`. Land `web-progress-accuracy-chart-fix` first to avoid overlap on the accuracy chart.
