## Why

On the Progress page the "Quiz accuracy" / "Accuracy per session" chart renders only axis labels (e.g. 60 / 70 / 75) with **no bars** (observed in the comparison, 2026-06-30). The design (`openspec/design/Progress.html`) shows a per-session accuracy bar chart with the latest session highlighted. The data appears available (axis ticks render) but the series isn't drawn — a rendering bug on a shipped page.

## What Changes

- Render the per-session accuracy **bars** in the Progress accuracy chart, with the most recent session emphasized, matching `Progress.html`.
- Handle the empty/insufficient-data state explicitly (so "no bars" only shows when there genuinely is no data).
- Add a test that fails on the empty-render and passes once bars are drawn for a non-empty series.

## Capabilities

### Modified Capabilities
- `web-progress`: the accuracy chart renders per-session bars from the accuracy series.

## Impact

- **Code**: `apps/web/app/` Progress accuracy-chart component; vitest component test. No API change, no codegen.
- **No new entity/migration.**
- **Dependencies**: archived `web-progress`. (Overlaps `web-progress-fidelity`; this is the isolated bug fix and should land first.)
