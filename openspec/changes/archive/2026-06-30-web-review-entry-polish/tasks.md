## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Update `apps/web/e2e/quick-review.e2e.ts`: entry renders domain chips and a single Start that reaches the review flow (self-grade rating in-flow), matching the design's single-entry model.
- [x] 0.2 Confirm it fails against the current plain-list + separate self-grade button.

## 1. Domain chips

- [x] 1.1 RED: component test — by-domain breakdown renders chips (domain + count).
- [x] 1.2 GREEN: replace the plain list with chips per `QuickReview.html`.
- [x] 1.3 REFACTOR: reuse any existing chip component.

## 2. Unified entry

- [x] 2.1 RED: test — a single Start enters the flow; self-grade is the in-flow rating (no separate entry button, or a mode toggle if both loops stay selectable).
- [x] 2.2 GREEN: rework the entry affordance to match the design; keep the existing self-grade card UI.
- [x] 2.3 REFACTOR: remove dead entry copy/handlers.

## 3. Verification gates

- [x] 3.1 `yarn lint`, `yarn typecheck`, web unit tests + e2e green; coverage ≥ 80%.
