## Reviewed Artifacts

- proposal.md
- specs/authentication/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| SUGGESTION | tasks.md | The e2e acceptance test (0.2) exercises the disabled + existing-user path but the bootstrap "first user can register even when disabled" scenario had no explicit end-to-end/integration task callout. | Integration coverage for the bootstrap bypass was already listed in task 2.2 (disabled + empty table → 201 admin + email); confirmed it maps to the spec scenario, no artifact change needed. | tasks.md § 2.2 (verified, unchanged) |
| SUGGESTION | design.md | Test Boundaries named Playwright for the web path but the web unit task (3.1) uses a component/page test for the 403 handling. | This is an in-app unit test, not a new external mock boundary, so it does not contradict the boundaries table; left as-is. | design.md § Test Boundaries (verified, unchanged) |

## No Remaining Implementation-Blocking Gaps

Confirmed. The single modified capability (`authentication`) has a matching delta spec with both affected requirements in `## MODIFIED Requirements`, each carrying full updated content. Every new spec scenario — registration refused when disabled, default-enabled when unset, first-user bypass when disabled — has corresponding acceptance/integration work in tasks.md (0.2, 1.1, 2.2). Design resolves all implementation-critical choices (env-var storage, fail-open default, service-level enforcement, bootstrap-bypass ordering, `403 signups-disabled` Problem Details) with no open questions. Proposal, specs, design, and tasks agree on scope (`/auth/register` only), endpoint, error `type`, and the no-migration/no-Orval impact. `openspec validate` passes.

## Deferred Non-Blocking Notes

- An admin-panel runtime toggle backed by an `AppSetting` entity is intentionally out of scope; proposal.md and design.md both record env-var as the deliberate choice and name the `AppSetting` path as the future upgrade if runtime toggling is ever required.
- The pre-existing "weak password is rejected" scenario in the MODIFIED requirement retains its existing test coverage and is not re-implemented by this change.
