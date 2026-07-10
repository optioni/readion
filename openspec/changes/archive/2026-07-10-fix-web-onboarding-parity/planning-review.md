## Reviewed Artifacts

- proposal.md
- specs/web-onboarding/spec.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| — | — | None. All five findings are genuine presentational fixes; each is tasked with RED/GREEN/REFACTOR and outer-loop coverage. | — | — |

## No Remaining Implementation-Blocking Gaps

Confirmed. `openspec validate fix-web-onboarding-parity --strict` passes.

- **Capability coverage** — one Modified Capability (`web-onboarding`) with a matching delta; the MODIFIED requirement uses the exact existing header ("Certification selection step").
- **Scenario coverage** — vendor grouping, cross-group client-side search, and the count/icon scenarios are tasked at 0.1, 1.1–1.2, 2.1; the divided footer + "Continue →" at 3.1.
- **Design completeness** — the one reconciliation (the spec's "name and provider" wording moves the provider to the group header and shows name + code on the row) is stated in proposal.md and encoded in the delta. Grouping is client-side over the already-loaded catalog; no API change.
- **Test boundaries** — client-only over the loaded `GET /certifications` list; no integration tests, consistent with the impact.
- **Task alignment** — outside-in: §0 acceptance RED, §1–3 RED/GREEN/REFACTOR, §4 GREEN, §5 review, §6 polish.
- **Contradictions / stale assumptions** — none; selection/filter/disabled-until-chosen behavior is preserved and re-asserted (1.2–1.3).

## Deferred Non-Blocking Notes

- None. The change is self-contained presentational work with no descopes or cross-change coupling.
