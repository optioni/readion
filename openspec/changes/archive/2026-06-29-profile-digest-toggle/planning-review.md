## Reviewed Artifacts

- proposal.md
- specs/lifecycle-email/spec.md
- specs/user-profile/spec.md
- specs/web-settings/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| — | — | No implementation-blocking gaps found. The planning package is internally consistent and matches the codebase. | None required. | None |

### Review notes (verified against the codebase, no fixes needed)

- **Capability coverage**: All three modified capabilities named in `proposal.md` (`user-profile`, `lifecycle-email`, `web-settings`) have matching spec files, each with a `MODIFIED Requirements` section. No capability lives only in tasks/design.
- **Scenario coverage**: Each spec scenario is concrete enough to become an acceptance test (profile read includes field; PATCH opt-out; PATCH opt-back-in; non-boolean 422; both writers converge; Settings toggle). All map to acceptance/integration/e2e work in tasks.md sections 0, 2, 3, 6.
- **Design completeness**: `design.md` resolves the implementation-critical choices: no new entity/migration (`digestOptOut` already a `User` column — confirmed in `packages/db/src/entities/user.entity.ts:44`), partial-update reuse, two-writers-one-field decision, adding swagger DTOs to the profile controller, and the web switch contract.
- **Test boundaries**: design.md names integration (Testcontainers, real Postgres/Redis), unit (DTO/schema validation), and e2e (Playwright mocked PATCH). No task invents a mock boundary not named in design.
- **Codebase assumptions confirmed**: `digestOptOut` exists on the `User` entity and is honored by `lifecycle-email.service.ts` (lines 60, 169) for send-eligibility; the tokenized unsubscribe writer is at line 173. Shared profile schemas live in `packages/shared/src/users/index.ts`. The profile controller `apps/api/src/users/users.controller.ts` exists. The web Settings page is `apps/web/app/pages/settings/index.vue`.
- **Task alignment**: tasks.md follows outside-in order (acceptance RED → shared → API → eligibility regression → codegen → web → e2e/close loop → verification) with codegen and verification gates included.
- **Contradictions**: None. Proposal, specs, design, and tasks agree on endpoints (`GET`/`PATCH /api/v1/users/me`, `GET /api/v1/email/unsubscribe`), the two-writers-one-field model, no-migration scope, and verification expectations.

## No Remaining Implementation-Blocking Gaps

Confirmed. All planning artifacts are consistent with each other and with the current codebase. Implementation can proceed.

## Deferred Non-Blocking Notes

- design.md "Open questions" defers the decision on whether to collapse `web-settings`' manual `@readion/shared` envelope-narrowing back to typed client methods once the profile swagger DTO exists. This is explicitly assigned to task 5 (5.2/5.3), so it is accounted for and non-blocking.
