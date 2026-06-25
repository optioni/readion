## Reviewed Artifacts

- proposal.md
- specs/cert-go-live/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | specs/cert-go-live/spec.md | The coverage query aggregates over chunks, so a configured domain with **zero** chunks emits no row and could be skipped — silently passing the go-live bar with an empty domain. The behavior spec never pinned this down. | Stated that the evaluation SHALL cover every configured domain, zero-counting empty ones; added a "A domain with zero chunks fails the bar" scenario. | spec.md → Requirement: Coverage evaluation against the go-live bar |
| WARNING | design.md | Implementation-critical detail (zero-fill from the cert's domain list) was not recorded, so a coder could feed only query rows to the evaluator. | Added a decision bullet: evaluator is seeded from the certification's configured domain list, zero-filling domains absent from the aggregation. | design.md → Decisions (split pure/aggregation) |
| WARNING | tasks.md | Evaluator signature/tests didn't carry the domain list or the zero-chunk case, leaving the zero-fill behavior untested. | Added `domainList` to the `evaluateCoverage` signature, a zero-filled-domain test case (4.1), and the zero-fill behavior to the GREEN task (4.2). | tasks.md → group 4 |

## No Remaining Implementation-Blocking Gaps

All four artifacts agree on scope (worker promotion + admin read model, no entity/migration), the capability name `cert-go-live`, the three PRD §4 thresholds, the endpoint contract (`GET /api/v1/certifications/:id/coverage`, admin-gated, `{ data }` envelope, 403/404 behavior), and the chunk-counting rule (active chunks via `domainTags`, superseded excluded, enabled qualifying source per domain). Every spec scenario maps to acceptance work (groups 0–2) or a unit group (3–5), and tasks follow outside-in order with the Orval client regeneration, change-review, and polish steps present. No implementation-blocking gaps remain.

## Deferred Non-Blocking Notes

- A `cert_promoted_to_live` metric / `AuditLog` signal on promotion is intentionally deferred (design.md → Open Questions): SPEC's metrics list names none and `admin`/`observability` are not dependencies of this change. A structured log line on promotion is included instead (tasks 2.2).
- `live → draft` demotion after a coverage-dropping takedown is a deliberate non-goal (design.md → Goals / Non-Goals); revisit alongside `chunk-lifecycle`/takedown if it becomes a real product need.
- The admin coverage **UI** is owned by `web-admin`; the Playwright e2e layer is therefore deferred to that change (design.md → Test Boundaries).
