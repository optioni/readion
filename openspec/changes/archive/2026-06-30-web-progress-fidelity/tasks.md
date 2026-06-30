## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Playwright e2e: Progress shows 4 stat cards (Sessions, Questions answered, Study time, Current streak), a readiness line chart with points/axis/value, and the fuller pace copy.
- [x] 0.2 Confirm it fails against the current 2-card / bare-line / terse-copy state.

## 1. Stat row (4 cards)

- [x] 1.1 RED: component test for the stat row — renders Sessions, Questions answered, Study time, Current streak from the progress read model.
- [x] 1.2 GREEN: add the two cards (Study time, Current streak). If the API doesn't expose them, STOP and flag (no backend scope here).
- [x] 1.3 REFACTOR: shared stat-card; align labels with `Progress.html`.

## 2. Readiness line chart

- [x] 2.1 RED: component test — renders the series with points, axis ticks, and the current value %.
- [x] 2.2 GREEN: implement the chart per the artboard.
- [x] 2.3 REFACTOR: reuse chart primitives; handle the not-yet-calibrated state.

## 3. Pace callout

- [x] 3.1 RED: test — calibrated state shows pace rate + estimated weeks + trend icon; uncalibrated shows the "complete at least N sessions" branch.
- [x] 3.2 GREEN: restore the fuller copy from the read-model pace fields.
- [x] 3.3 REFACTOR: single formatter for the pace string.

## 4. Verification gates

- [x] 4.1 `yarn lint`, `yarn typecheck`, web unit tests + e2e green; coverage ≥ 80%.
