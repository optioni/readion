## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Write a failing Playwright e2e (`apps/web/e2e`): on `/onboarding` step 1, assert certs render under uppercase vendor group headers (not a flat list), that the search box shows an "N available" count and a leading search icon, and that the footer Continue action is separated by a top-border divider and reads "Continue →"
- [ ] 0.2 Confirm it fails for the right reason (flat list / missing affordances), not a selector error

## 1. Vendor-grouped cert list (`web-onboarding`)

- [ ] 1.1 RED: component test asserting `OnboardingCertSelect` groups the loaded catalog by `provider` under uppercase vendor headers, each row showing the cert name + a code badge (provider not repeated inline)
- [ ] 1.2 RED: component test asserting client-side search still filters by name/provider/code and that groups with no matching rows are hidden; clearing the query restores all groups
- [ ] 1.3 RED: component test asserting single-select + Continue-disabled-until-chosen behavior is preserved across groups
- [ ] 1.4 GREEN: derive a grouped view of `filteredOptions` by `provider`; render group headers + name/code rows
- [ ] 1.5 REFACTOR: keep selection state keyed by `certificationId`; ensure group ordering is stable

## 2. Search box count suffix + leading icon (`web-onboarding`)

- [ ] 2.1 RED: component test asserting the search box renders a right-aligned "N available" suffix reflecting the total loaded cert count, and a leading magnifying-glass icon
- [ ] 2.2 GREEN: add the count suffix + leading icon to the search input
- [ ] 2.3 REFACTOR: confirm the count reflects total catalog size, not the filtered subset (per design)

## 3. Footer divider + arrow glyph (`web-onboarding`)

- [ ] 3.1 RED: component test asserting the footer Continue action is separated from the list by a top-border divider with the design's spacing, right-aligned, labeled "Continue →"
- [ ] 3.2 GREEN: move Continue into a divided footer row (border-top + spacing, justify-end) and add the trailing arrow
- [ ] 3.3 REFACTOR: reconcile spacing against `openspec/design/Onboarding.html`

## 4. Acceptance Test — Outer Loop GREEN

- [ ] 4.1 Confirm the section-0 e2e passes end-to-end
- [ ] 4.2 Visually diff step 1 against `Onboarding.html`; reconcile residual drift

## 5. Change Review — Subagent Verification

- [ ] 5.1 Dispatch a reviewer subagent against `proposal.md`, the `web-onboarding` spec delta, and the diff (reports findings only)
- [ ] 5.2 Triage findings; re-run affected tests

## 6. Polish

- [ ] 6.1 Run linter and fix all errors (`yarn lint`)
- [ ] 6.2 Run formatter and apply fixes (`yarn format`)
- [ ] 6.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [ ] 6.4 Run coverage and confirm ≥80% lines/branches for the touched components (`yarn workspace apps/web test:coverage`)
