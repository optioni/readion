## Why

A set of small, low-risk fidelity gaps surfaced across screens in the 2026-06-30 comparison that don't each warrant their own change: button alignment, form placement/whitespace, and onboarding chrome. Grouping them keeps the per-screen polish contained after the structural Phase-13 changes land.

## What Changes

- **Settings**: right-align the Save / Change-password / Delete-account actions to match `Settings.html` (currently left-aligned).
- **Login / Settings**: tighten form placement/whitespace toward the design's contained-card layout (the implementation currently floats forms in large empty space).
- **Onboarding**: add the cert **search box** on step 1 (`Onboarding.html`) and present the onboarding card as a standalone flow (hide the global app chrome on the onboarding route).
- Preserve the reconciled divergences (no Full-name field/avatar upload, no SSO) — these are NOT in scope to "fix".

## Capabilities

### Modified Capabilities
- `web-settings`: action buttons right-aligned; form whitespace tightened to the design.
- `web-auth`: Login form placement aligned to the design's contained card.
- `web-onboarding`: cert-search on step 1; onboarding route presents standalone (no global chrome).

## Impact

- **Code**: `apps/web/app/` Settings, Login, and Onboarding page/components; vitest tests; targeted Playwright assertions. No API change, no codegen.
- **No new entity/migration.**
- **Dependencies**: `web-app-shell-sidebar` (so the "hide global chrome on onboarding" decision is made against the new shell); archived `web-settings`, `web-auth`, `web-onboarding`.
