## Why

The design renders per-domain scores as **colored horizontal progress bars** on a status-colour scale (red→amber→green) with the percentage and trend (`openspec/design/Progress.html`, `CertDetail.html`). The implementation shows domain scores as **text-only** rows (name + %), on both Progress and CertDetail (observed 2026-06-30). The two pages duplicate the same domain-score concept, so the fix is a single shared component adopted in both.

## What Changes

- Add a shared **domain-score bar** component: label, value-driven bar width, **status colour** by score band, and optional trend delta (↑/↓ with sign) — matching the artboards.
- Adopt it in the Progress "Domain scores" list and the CertDetail "Domain breakdown" list, replacing the text-only rows.
- Define the colour-band thresholds once (reuse the design system's status tokens / any existing `scoreColor` helper from the design bundle as reference).

## Capabilities

### Added Capabilities
- `web-domain-scores`: a reusable per-domain score bar (status-coloured, with value + trend) shared by progress/cert-detail surfaces.

### Modified Capabilities
- `web-progress`: domain scores render via the shared bar component.
- `web-cert-detail`: domain breakdown renders via the shared bar component.

## Impact

- **Code**: new `apps/web/app/components/` domain-score-bar component + vitest tests; adopt in Progress + CertDetail. No API change, no codegen.
- **No new entity/migration.**
- **Dependencies**: archived `web-progress`, `web-cert-detail`. Pairs with `web-progress-fidelity` and `web-cert-detail-polish`, which consume it.
