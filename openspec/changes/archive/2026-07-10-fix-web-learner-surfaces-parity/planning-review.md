## Reviewed Artifacts

- proposal.md
- design.md
- specs/web-dashboard/spec.md
- specs/web-cert-detail/spec.md
- specs/web-progress/spec.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | design.md reaffirms the dashboard **diagnostic re-prompt nudge** as a conditional feature (the two-certs artboard doesn't depict it), but — unlike the other reaffirmations (reviews-row §1.6, trajectory §4.5, Unretire §6.2) — no task guarded it, so the dashboard-widening/flattening work could silently drop it. | Added guard task **1.7** asserting the nudge remains mounted (shown/hidden by its own query). | tasks.md § "1. Dashboard — ReadinessBar + card polish" |

## No Remaining Implementation-Blocking Gaps

Confirmed. `openspec validate fix-web-learner-surfaces-parity --strict` passes.

- **Capability coverage** — three Modified Capabilities (`web-dashboard`, `web-cert-detail`, `web-progress`), each with a delta; every MODIFIED header matches an existing spec requirement title.
- **Scenario coverage** — new scenarios (ReadinessBar, standard width, code pill, flat sections; wired delta badges, bordered stat cards, "Domain scores", no extra link; trajectory-callout placement, chart enrichments, "This month" cards, persistent mastering) are tasked across §1–6 and re-verified at §7.1.
- **Design completeness** — reconciliation table records each decision; the two data dependencies (cert `code`, per-session delta) are flagged verify-first in §1.2/§3.1; mastering persistence is a behavioral fix wired to `enrollmentReviewControllerSuppressDomain`.
- **Test boundaries** — mostly component/e2e; an integration test only where the suppress-domain wiring or a DTO field is exercised, stated in the impact.
- **Task alignment** — outside-in across §0–9, with reaffirmation guards (§1.6, §1.7, §4.5, §6.2).
- **Contradictions / stale assumptions** — none; reviews-row hide-when-zero, trajectory sub-label, and the one-way mastered contract are consistent with the existing specs.

## Deferred Non-Blocking Notes

- **`web-progress` is also modified by `fix-web-study-parity`** — but a disjoint requirement (study touches "Five-minute review — queue entry"; this touches "Activity stat summary row", "Readiness-over-time and accuracy trend", "Passive readiness trajectory call-out", "Session history table", "Mark a concept or domain as mastered"). No overlapping requirement, so no conflict; coordinate the two deltas when syncing/archiving into the main spec.
- The cert **code pill** and **per-row session delta** may need a minor DTO/include if the field is absent — handled inside the tasks (verify-first), not a separate change.
