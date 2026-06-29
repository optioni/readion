## Reviewed Artifacts

- proposal.md
- specs/authentication/spec.md
- specs/web-settings/spec.md
- design.md
- tasks.md

Reviewed against the actual codebase reuse points named in the plan: `apps/api/src/auth/auth.controller.ts`, `auth.service.ts`, `refresh-token.store.ts`, `password-hashing.service.ts`, `packages/shared/src/auth/index.ts`, and `apps/web/app/pages/settings/index.vue` (+ `AccountTab.vue`).

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | design.md (Approach), tasks.md (3.1/3.2) | Plan specified a `ChangePasswordDto` using **class-validator** + swagger DTO. The actual `AuthController` validates every route with Zod `parseBody(schema, body)` against `@readion/shared` schemas (`@Body() body: unknown`); there are no class-validator DTOs or swagger decorators anywhere in `auth`. Following the plan literally would have introduced an inconsistent validation style. | Reconciled design + tasks to the established pattern: add a `changePasswordRequestSchema` in `@readion/shared` validated via the existing `parseBody` helper; removed the class-validator/swagger-DTO wording. | design.md → Approach; tasks.md → 3.1, 3.2 |
| WARNING | design.md (Open questions), tasks.md (3.1/3.3) | Response shape left open (`204` vs envelope). The precedent endpoint `auth/refresh` returns `200` + `{ accessToken }` envelope and sets the rotated refresh + CSRF cookies via `setSessionCookies`. Leaving it open risked the implementer choosing `204` and diverging from the sibling endpoint. | Resolved to mirror `auth/refresh`: `200` + `{ accessToken }` + rotated refresh/CSRF cookies. Moved "Open questions" to "Resolved questions". | design.md → Approach + Resolved questions; tasks.md → 3.1, 3.3 |
| SUGGESTION | tasks.md (1.2/1.3) | Tasks reference reusing an "existing password-strength constant", but the rule today is an inline `z.string().min(8)` on `registerRequestSchema` — there is no named constant yet. | No artifact change needed; tasks 1.2/1.3 already direct creating a single shared rule and pointing registration at it, which correctly establishes the single source of truth. Noted here so the implementer extracts/shares the rule rather than hunting for a non-existent constant. | none (clarification only) |

## No Remaining Implementation-Blocking Gaps

All four spec scenarios (success + hash rotation + other-token revocation, wrong-current → `401`/`403` with no mutation, weak-new → `422`, unauthenticated → `401`) and both web-settings scenarios map to concrete acceptance/integration/unit/e2e tasks in tasks.md. Every reuse point the plan depends on exists and was verified: `PasswordHashingService.hash/verify`, `RefreshTokenStore.revokeAllForUser/issue/rotate`, the controller `parseBody`/`setSessionCookies`/`@AuthThrottle()` helpers, the `auth/refresh` `200 { accessToken }` precedent, and the shared `registerRequestSchema` min-8 rule. No new entity/migration is required. The capability coverage matches the proposal (`authentication` MODIFIED via ADDED requirement, `web-settings` MODIFIED). No contradictions remain after the two reconciliations above.

## Deferred Non-Blocking Notes

None.
