## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Add/extend the CertDetail Playwright e2e (or page test) asserting the Recent-sessions rows show a real label (type + date + score), never `[object Object]`.
- [x] 0.2 Confirm it fails against current behavior.

## 1. Recent-sessions row rendering

- [x] 1.1 RED: component/page unit test for the recent-sessions row — given a session object, renders type, formatted date, and score; no `[object Object]`.
- [x] 1.2 GREEN: fix the template/formatter to render the labelled fields; map the real score.
- [x] 1.3 REFACTOR: extract a small session-row label/formatter if it clarifies; align with `CertDetail.html`.

## 2. Verification gates

- [x] 2.1 `yarn lint`, `yarn typecheck`, web unit tests, and the e2e all green; coverage ≥ 80%.
