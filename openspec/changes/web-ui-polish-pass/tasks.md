## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Playwright assertions: Settings actions right-aligned; Login/Settings forms in the contained-card layout; Onboarding step 1 has a cert search and no global app chrome.
- [ ] 0.2 Confirm they fail against current behavior.

## 1. Settings alignment + whitespace

- [ ] 1.1 RED: component/page test for right-aligned actions + tightened layout.
- [ ] 1.2 GREEN: align to `Settings.html`.
- [ ] 1.3 REFACTOR: shared form-actions layout.

## 2. Login form placement

- [ ] 2.1 RED: test the Login form uses the design's contained-card placement.
- [ ] 2.2 GREEN: adjust layout per `Login.html` (keep SSO omitted — deliberate).
- [ ] 2.3 REFACTOR: tidy shared auth-layout styles.

## 3. Onboarding search + standalone chrome

- [ ] 3.1 RED: test step 1 renders a cert search that filters the catalog; the onboarding route hides the global app chrome.
- [ ] 3.2 GREEN: add the search filter; present onboarding standalone per `Onboarding.html`.
- [ ] 3.3 REFACTOR: reuse the catalog list; tidy the route layout choice.

## 4. Verification gates

- [ ] 4.1 `yarn lint`, `yarn typecheck`, web unit tests + targeted e2e green; coverage ≥ 80%.
