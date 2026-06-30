## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Extend the Progress Playwright e2e to assert the accuracy chart draws one bar per session (not just axis labels) for a seeded multi-session enrollment.
- [ ] 0.2 Confirm it fails against current behavior.

## 1. Accuracy chart rendering

- [ ] 1.1 RED: component unit test — given an accuracy series, renders N bars with the latest emphasized; given an empty series, renders the explicit empty state.
- [ ] 1.2 GREEN: fix the chart to map the series to bars; wire the highlight + empty state.
- [ ] 1.3 REFACTOR: align scale/axis with `Progress.html`; remove dead chart code.

## 2. Verification gates

- [ ] 2.1 `yarn lint`, `yarn typecheck`, web unit tests, and the e2e all green; coverage ≥ 80%.
