## Why

The parity diff compared the onboarding cert-select step against `openspec/design/Onboarding.html`. All 5 findings are genuine presentational fidelity gaps — the flow's behavior matches the `web-onboarding` spec, but the cert list is rendered flat rather than the design's vendor-grouped catalog, and several search/footer affordances are missing. No product divergences; every fix is client-side over the already-loaded catalog (no API change).

- **Vendor-grouped cert list (high).** The app renders a flat `<ul>` repeating the provider inline per row; the design buckets certs under uppercase vendor headers (Amazon Web Services, Google Cloud, Microsoft Azure, Linux Foundation / CompTIA), each row showing name + a code badge with the vendor implied by its group. Adopt the grouped presentation.
- **Search count suffix (medium).** Add the right-aligned "N available" pill the design shows in the search box (total loaded count).
- **Footer divider (medium).** Separate the Continue action from the list with a top border + the design's spacing, right-aligned — instead of it being just another item in the same flex stack.
- **Search icon (low)** and **Continue arrow "→" (low).** Add the leading magnifying-glass icon and the trailing arrow glyph.

Reconciliation note: the current spec says each option shows "name and provider." Grouping moves the provider up to the group header and shows name + code on the row; this change updates that requirement wording accordingly. The behavior (client-side filter by name/provider/code, single-select, Continue-disabled-until-chosen) is unchanged.

## What Changes

- **web-onboarding** — render the cert-select list grouped by vendor/provider with uppercase group headers (name + code badge per row); add the "N available" search-count suffix and a leading search icon; separate the footer Continue action with a top-border divider + design spacing and a trailing "→" glyph. Presentational only, client-side over the loaded catalog.

## Capabilities

### Modified Capabilities

- `web-onboarding`: vendor-grouped cert-select presentation (group header = provider; row = name + code), a search-count suffix + leading icon, and a divided, arrow-glyph footer action.

## Impact

- **apps/web** — presentational only: `apps/web/app/components/OnboardingCertSelect.vue` (grouping, search suffix/icon, footer divider, arrow). No change to selection/filter behavior or the enrollment flow.
- **No API, DB, `packages/shared`, or generated-client changes** — grouping is client-side over the already-loaded `GET /certifications` catalog using each cert's `provider`.
- **Tests** — Playwright e2e asserting the grouped headers + search suffix + footer divider; component unit tests for the grouping and count. No integration tests.
