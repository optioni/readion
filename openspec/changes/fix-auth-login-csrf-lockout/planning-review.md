## Reviewed Artifacts

- proposal.md
- specs/authentication/spec.md
- design.md
- tasks.md

Reviewed as one contract. This is a **spec-catch-up** change: the behavior is already implemented (commit `16e6111`) and already covered by passing tests (`auth.acceptance.spec.ts`, `csrf.guard.spec.ts`). The "gaps" this review looks for are therefore spec-vs-code alignment gaps and internal artifact consistency, not missing implementation.

Gap checklist results:

- **Capability coverage** — PASS. proposal.md names one capability (`authentication`); `specs/authentication/spec.md` exists. The changed requirement sits under `## MODIFIED Requirements` with its exact existing header, and the new requirement under `## ADDED Requirements`. Adding a requirement to the pre-existing `authentication` capability is correctly recorded as `### Modified Capabilities` (the capability is modified, not new). No capability appears only in tasks.md or design.md.
- **Scenario coverage** — one gap found and fixed (see table). Every spec scenario now maps to concrete existing coverage cited in tasks.md.
- **Design completeness** — PASS. No source, module, migration, API, or UI surface changes; design.md scopes those out under Non-Goals and records the one real decision (codify-existing vs RED bug fix). Nothing implementation-critical is left open.
- **Test boundaries** — PASS. design.md Test Boundaries names each collaborator (Postgres/Redis real via Testcontainers, CsrfGuard/Reflector, capturing MailService) and maps them to the existing proving tests. tasks.md invents no mock boundary that design.md does not name.
- **Task alignment** — PASS. tasks.md keeps outside-in headers, cites the already-GREEN tests as coverage (no fabricated RED), and includes a spec-alignment confirmation plus a validation/scope-check step. No migration, generated-client, or visual-design work is required for a spec-only change.
- **Contradictions and stale assumptions** — PASS. proposal, spec delta, design, and tasks all agree: spec-only, no source changes, existing behavior from commit `16e6111`, existing tests as coverage. The intentional deviation from strict RED→GREEN (tests already green) is explicitly banner-documented in tasks.md and explained in design.md Decisions, so it is not a hidden contradiction.

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md §0.2 | The two retained scenarios of the MODIFIED CSRF requirement — "Missing CSRF token is rejected" (refresh ⇒ 403) and "Matching CSRF token is accepted" — had no explicit coverage citation, so not every spec scenario mapped to a proving test. | Expanded §0.2 to cite the existing `csrf.guard.spec.ts` reject-without-token and matching-token cases as the coverage for those two scenarios, alongside the exempt-path case. | tasks.md § "0. Acceptance Test — Already GREEN", task 0.2 |

## No Remaining Implementation-Blocking Gaps

Confirmed. For this spec-catch-up there is nothing to implement — the behavior ships in `apps/api/src/auth/csrf.guard.ts` + `auth.controller.ts` and is covered by `auth.acceptance.spec.ts` (login/register with a stale refresh cookie ⇒ 200/201) and `csrf.guard.spec.ts` (exempt path + retained double-submit reject/accept). Every spec scenario now maps to concrete existing coverage cited in tasks.md, and the four artifacts are mutually consistent. `openspec validate fix-auth-login-csrf-lockout --strict` passes.

## Deferred Non-Blocking Notes

- The outside-in RED→GREEN discipline is intentionally not applied here because the change introduces no new behavior and no new tests; the existing tests are already green. This deviation is banner-documented in tasks.md and justified in design.md Decisions, so it is a conscious framing, not an unresolved gap.
