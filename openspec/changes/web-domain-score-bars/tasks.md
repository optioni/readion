## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Playwright e2e: Progress and CertDetail render domain rows as colored bars (width ∝ score, status colour by band, trend delta), not plain text.
- [ ] 0.2 Confirm it fails against the current text-only rows.

## 1. Shared domain-score-bar component

- [ ] 1.1 RED: component test — bar width from value; status colour by band thresholds; renders value + signed trend; a11y label.
- [ ] 1.2 GREEN: build the component per `Progress.html`/`CertDetail.html` (design-system status tokens).
- [ ] 1.3 REFACTOR: single source for the band thresholds.

## 2. Adopt in Progress + CertDetail

- [ ] 2.1 RED: update Progress + CertDetail domain-list tests to expect the shared bar.
- [ ] 2.2 GREEN: replace the text-only rows with the component in both pages.
- [ ] 2.3 REFACTOR: remove the duplicated per-page row markup.

## 3. Verification gates

- [ ] 3.1 `yarn lint`, `yarn typecheck`, web unit tests + e2e green; coverage ≥ 80%.
