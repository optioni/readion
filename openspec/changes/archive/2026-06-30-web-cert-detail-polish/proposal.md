## Why

CertDetail Overview is missing two design elements (`openspec/design/CertDetail.html`, observed 2026-06-30): the stat row shows **3 stats** (Readiness, Sessions, Due reviews) where the design shows **4** (it includes Questions answered and an accuracy figure), and there is **no weakest-domain side panel** (the design pairs the domain breakdown with a "weakest domain" callout + recent activity). This is overview-fidelity polish on a shipped page. (The `[object Object]` recent-sessions bug and the domain-bar rendering are handled by `web-cert-detail-recent-sessions-fix` and `web-domain-score-bars`.)

## What Changes

- Add the design's **4th overview stat** (questions answered / accuracy) to the stat row, from the existing cert-detail read model (if unavailable, STOP and flag — no backend scope here).
- Add the **weakest-domain side panel** alongside the domain breakdown, matching the artboard.

## Capabilities

### Modified Capabilities
- `web-cert-detail`: Overview gains the 4th stat and the weakest-domain side panel.

## Impact

- **Code**: `apps/web/app/` CertDetail Overview components; vitest tests; Playwright e2e. Consumes `web-domain-score-bars`. No API change expected — flag if a needed field is absent. No codegen.
- **No new entity/migration.**
- **Dependencies**: `web-app-shell-sidebar`, `web-domain-score-bars`; archived `web-cert-detail`. Land `web-cert-detail-recent-sessions-fix` first.
