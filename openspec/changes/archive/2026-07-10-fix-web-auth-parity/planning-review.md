## Reviewed Artifacts

- proposal.md
- design.md
- specs/web-auth/spec.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| — | — | None. The three reaffirmed divergences (SSO, Full-name field, verify-before-access gate) each already carry a guard task (§3.1–3.3), and the two genuine fixes each have RED/GREEN/REFACTOR plus outer-loop acceptance coverage. | — | — |

## No Remaining Implementation-Blocking Gaps

Confirmed. `openspec validate fix-web-auth-parity --strict` passes.

- **Capability coverage** — proposal.md names exactly one Modified Capability (`web-auth`) with a matching delta. Both requirements use exact existing `## MODIFIED Requirements` headers ("Login page authenticates and routes into the app", "Reset-password page validates the token then sets a new password").
- **Scenario coverage** — the two new scenarios (errored-field styling without account-revealing copy; confirm-password mismatch/match) are tasked at 0.1–0.2, 1.1–1.2, 2.1–2.3, and re-verified in outer-loop GREEN (4.1).
- **Design completeness** — design.md carries the full reconciliation table; no data-model/API/migration concern applies (client-only), stated explicitly.
- **Test boundaries** — client-only (login `401` handling, reset match). No integration tests claimed; consistent with "no backend surface touched".
- **Task alignment** — outside-in: §0 acceptance RED, §1–2 RED/GREEN/REFACTOR, §3 guard tests, §4 GREEN, §5 subagent review, §6 polish.
- **Contradictions / stale assumptions** — none. SSO, Full-name, and verify-before-access are recorded consistently as reaffirmed divergences across proposal.md, design.md, the spec delta, and the §3 guards.

## Deferred Non-Blocking Notes

- **Forgot-password expiry copy** is a design (artboard) correction, not an app change — the app's "1 hour" matches the real 3600s TTL. Tracked in design.md follow-ups.
- **SSO, a ToS consent gate, and a verify-before-access flow** are deferred product decisions with their own backend scope, not planning gaps; §3 guards against accidental reintroduction of the first two.
