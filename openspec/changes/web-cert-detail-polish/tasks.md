## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Extend the CertDetail e2e: Overview shows 4 stats (incl. questions/accuracy) and a weakest-domain side panel.
- [x] 0.2 Confirm it fails against the current 3-stat / no-side-panel state.

## 1. 4th overview stat

- [x] 1.1 RED: component test — stat row renders the questions/accuracy stat from the read model.
- [x] 1.2 GREEN: add the stat (STOP + flag if the field isn't exposed).
- [x] 1.3 REFACTOR: reuse the shared stat-card.

## 2. Weakest-domain side panel

- [ ] 2.1 RED: component test — renders the weakest domain callout next to the domain breakdown.
- [ ] 2.2 GREEN: add the side panel per `CertDetail.html`.
- [ ] 2.3 REFACTOR: align layout/columns with the artboard.

## 3. Verification gates

- [ ] 3.1 `yarn lint`, `yarn typecheck`, web unit tests + e2e green; coverage ≥ 80%.
