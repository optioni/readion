## Reviewed Artifacts

- proposal.md
- specs/web-settings/spec.md
- design.md
- tasks.md

Reviewed as one contract against the live backend and the committed Orval client. The contract realities the planning package depends on were verified directly in source:

- **No change-password endpoint.** `apps/api/src/auth/auth.controller.ts` exposes only `forgot-password` / `reset-password`; there is no `PATCH /users/me/password` or any change-password route. The committed client (`apps/web/src/api/auth/auth.ts`) carries only `authControllerForgotPassword`. ✔ Account tab's password-reset-by-email approach is correct.
- **`digestOptOut` is not on the profile contract.** `userProfileResponseSchema` / `updateUserProfileRequestSchema` (`packages/shared/src/users/index.ts`) carry only `displayTimezone` + `sessionDefaults`; `UsersService.toProfile`/`updateProfile` never touch `digestOptOut`. The field lives only on `User` entity + the worker digest scheduler + the public tokenized unsubscribe. The Orval client has no method that reads/writes it on `/users/me`. ✔ Notifications-tab descoping is correct.
- **Account deletion = soft-delete + grace + password re-confirmation.** `UsersService.deleteOwnAccount` parses `{ password }`, verifies it (401 on mismatch), runs the last-active-admin guard, sets `deletedAt`, revokes all refresh tokens; `apps/worker/src/users/user-purge.service.ts` hard-purges after `LIFECYCLE_DELETION_GRACE_DAYS` (default 14) — matching SPEC.md "Account Deletion" and design.md's "14-day soft-delete grace window." ✔
- **`sessionDefaults` = all five fields** (`duration` 15/30/60/90, `contentMix`, `difficulty`, `focusArea`, `learningStyle`) — `sessionDefaultsSchema` and `UsersService.applySessionDefaults` agree exactly with spec + tasks. ✔
- **Reuse targets exist:** `readProfileEnvelope` (`app/composables/useOnboardingGate.ts`), `OnboardingSessionPrefs.vue`, `ColorModeToggle.vue` / `useReadionColorMode.ts`, `useAuthStore`, and the canonical artboard `openspec/design/Settings.html` (the `../../design/Settings.html` path resolves correctly from the change dir). ✔

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | proposal.md (Impact → "APIs consumed") | Listed `emailControllerUnsubscribe` as an API consumed by the page, contradicting design.md (reconciliation), spec.md (Notifications scenarios "issues no request"), and tasks.md (mocks only `GET/PATCH/DELETE /users/me` + `POST /auth/forgot-password`). The tokenized `GET /email/unsubscribe` requires a token only present in the digest email and is never callable from authenticated Settings. | Removed `emailControllerUnsubscribe` from the consumed-API list and added an explicit note that it is **not** consumed (reachable only from the email's one-click link); the tab merely points to it. | proposal.md → Impact |
| WARNING | proposal.md (What Changes → Notifications tab) | Said the tab surfaces "the one-click unsubscribe flow," implying the page builds/calls an unsubscribe action — inconsistent with the descoped, request-free tab the spec/design define. | Reworded to: surface the digest opt-out **informatively**, pointing to the link in the digest email, and stated explicitly the tab issues **no** request (the only `digestOptOut` mutation is the public tokenized endpoint, reachable only from the email). | proposal.md → What Changes |
| WARNING | design.md (Decisions / Test Boundaries) | design.md and tasks.md name `authControllerForgotPassword` as the unit-test mock boundary, but the existing `apps/web/app/pages/forgot-password.vue` precedent calls the endpoint via raw `fetch`. An implementer copying that precedent would never hit the named mock, and the Orval method is body-less (`options?: RequestInit`), leaving "how is the email sent?" under-specified. | Added a **Pin** under the password decision: call the generated `authControllerForgotPassword` method (not raw `fetch`), supplying the email via the request body (`{ body: JSON.stringify({ email }), headers: { 'Content-Type': 'application/json' } }`), validated by `forgotPasswordRequestSchema`; noted the intentional divergence from `forgot-password.vue`. | design.md → Decisions |

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved. Confirmed after fixes:

- **Capability coverage** — proposal names exactly one new capability (`web-settings`) with a matching `specs/web-settings/spec.md`; no modified/removed backend capabilities (frontend-only consumer). No capability exists only in tasks/design.
- **Scenario coverage** — every spec requirement maps to a concrete, mockable acceptance scenario and to outside-in task work: shell/tabs/auth-guard → task 1 + acceptance 0.2; read-only profile + timezone (incl. 422 path) → task 3; password reset → task 4; delete with password re-confirm (204 logout, 401 stays, no-password blocked) → task 5; all five session defaults → task 6; digest-opt-out-only / no unbacked toggles / no `/users/me` digest request → task 7.
- **Endpoints pinned to concrete client methods** — `usersControllerGetMe` / `usersControllerUpdateMe` / `usersControllerDeleteMe` / `authControllerForgotPassword`; profile narrowed via `userProfileResponseSchema`; mutations validated via `updateUserProfileRequestSchema` / `sessionDefaultsSchema`; forgot-password body via `forgotPasswordRequestSchema`. `emailControllerUnsubscribe` is explicitly out of the page's call surface.
- **Test boundaries** — design.md's mocked collaborators (the four generated methods, real Pinia auth store, real `@readion/shared`) exactly match what tasks.md mocks; no task invents an un-named boundary (the forgot-password boundary is now consistent after the pin).
- **Task alignment** — outside-in order holds (acceptance RED → shell → composable → tabs → acceptance GREEN → review → polish), and includes visual-design reconciliation per tab, a smoke/verify step (8.2), subagent review (9), and lint/format/typecheck/coverage (10). No backend/migration/codegen work is required or implied.
- **No contradictions remain** across proposal/spec/design/tasks on scope, endpoints, domain names, persistence behavior, or UI copy/states.

## Deferred Non-Blocking Notes

Two backend follow-ups are intentionally deferred and out of scope for this frontend change, already recorded in proposal.md (Impact → "Backend gaps flagged") and design.md (Open Questions):

1. A dedicated change-password endpoint (so the Account tab can offer in-place password change instead of the email-reset substitute).
2. Exposing `digestOptOut` (and any future notification preferences) on `GET`/`PATCH /api/v1/users/me` so the Notifications tab can offer an authenticated two-way toggle.

Neither blocks implementation: the Account and Notifications tabs are fully specified against the contract as it exists today.
