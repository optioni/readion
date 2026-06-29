## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the Playwright e2e harness in `apps/web/e2e/settings.e2e.ts` with `/api/v1/*` route mocks per design.md Test Boundaries: `GET /users/me` (profile fixture), `PATCH /users/me`, `DELETE /users/me`, `POST /auth/forgot-password`; authenticated session seeded via the existing auth e2e support helpers
- [x] 0.2 Write failing acceptance test covering the spec scenarios: open `/settings` (sidebar `Settings` active, three tabs, Account default) → switch tabs → edit display timezone + Save (`PATCH /users/me { displayTimezone }`) → edit study defaults + Save defaults (`PATCH /users/me { sessionDefaults }`) → trigger "email me a reset link" (`POST /auth/forgot-password`) → delete account with password confirmation modal → on 204 auth cleared + redirect to login → Notifications tab shows digest opt-out only (no unbacked toggles)
- [x] 0.3 Confirm the acceptance test fails for the right reason (no `/settings` route yet), not a harness/setup error

## 1. Settings layout shell + route (outermost)

- [x] 1.1 RED: Write unit test for the `/settings` page/`SettingsLayout` — renders app shell with sidebar `Settings` active, a three-tab bar (`Account`, `Study defaults`, `Notifications`) in order, `Account` selected by default, and tab switching; assert auth route middleware applies (unauthenticated → login). Build to the `Settings.html` → `SettingsLayout`/`SettingsTabs` artboard (shared layout, max-width content column), reusing the existing app shell / `AppNavBar` + `ColorModeToggle`
- [x] 1.2 GREEN: Implement `apps/web/app/pages/settings/` page + `SettingsLayout` and tab routing to pass the unit test
- [x] 1.3 REFACTOR: Extract the tab-bar primitive if warranted; ensure layout is shared by all three panels

## 2. settingsQueryKeys + profile query

- [x] 2.1 RED: Write unit test for `apps/web/app/composables/settingsQueryKeys.ts` (stable keys, e.g. `profile()`) and the profile query wrapper that reads `usersControllerGetMe` and narrows the envelope via `@readion/shared` `userProfileResponseSchema` (reuse the `readProfileEnvelope` pattern)
- [x] 2.2 GREEN: Implement `settingsQueryKeys` and the profile query composable
- [x] 2.3 REFACTOR: Deduplicate against the onboarding profile read helper where sensible

## 3. Account tab — profile identity + timezone

- [x] 3.1 RED: Write unit test for the Account tab profile section — email rendered read-only, derived initials avatar, NO "Full name" field (per reconciliation); editable IANA timezone control seeded from `displayTimezone`; Save calls `PATCH /users/me { displayTimezone }` and invalidates the profile query; 422 surfaces an error and keeps the control editable. Build to `Settings.html` → `AccountTab` Profile section (dropping Full name, email read-only, adding timezone)
- [x] 3.2 GREEN: Implement the Account profile + timezone section with the `usersControllerUpdateMe` mutation
- [x] 3.3 REFACTOR: Clean up form state / error handling

## 4. Account tab — password reset action

- [x] 4.1 RED: Write unit test for the password section — "Change password / email me a reset link" action calls `authControllerForgotPassword` with the signed-in user's email and shows a confirmation; NO current/new/confirm fields wired to any change-password endpoint (per reconciliation). Build to `Settings.html` → `AccountTab` Password section (replaced)
- [x] 4.2 GREEN: Implement the password-reset action
- [x] 4.3 REFACTOR: Clean up copy/state

## 5. Account tab — delete account (danger zone) + confirm modal

- [x] 5.1 RED: Write unit test for the delete-account flow — danger-zone button opens a confirm modal requiring the current password; confirm calls `DELETE /users/me { password }`; on 204 clears `useAuthStore` and redirects to login; 401 keeps the modal open with an "invalid password" error and leaves the store unchanged; confirm disabled/blocked with no password (no request sent). Build to `Settings.html` → `AccountTab` Danger zone (adding the required password modal)
- [x] 5.2 GREEN: Implement the delete-account confirm modal + `usersControllerDeleteMe` mutation + post-success logout/redirect
- [x] 5.3 REFACTOR: Extract a reusable confirm-modal piece if warranted

## 6. Study defaults tab

- [x] 6.1 RED: Write unit test for the Study defaults tab — renders all five `sessionDefaults` (`duration` 15/30/60/90, `contentMix`, `difficulty`, `focusArea`, `learningStyle`) seeded from the profile using the real `@readion/shared` enums (reusing `OnboardingSessionPrefs`); Save defaults calls `PATCH /users/me { sessionDefaults }` (validated by `sessionDefaultsSchema`) and invalidates the profile query. Build to `Settings.html` → `StudyDefaultsTab`, applying reconciliation (discrete durations not a slider, real enum labels, add focusArea)
- [x] 6.2 GREEN: Implement the Study defaults tab wrapping `OnboardingSessionPrefs` with the update mutation
- [x] 6.3 REFACTOR: Ensure the shared control is reused cleanly (no duplicated option lists)

## 7. Notifications tab

- [x] 7.1 RED: Write unit test for the Notifications tab — surfaces the weekly-digest opt-out informatively (one-click unsubscribe lives in the digest email), renders NO toggles for review reminders / streak alerts / exam countdown / in-app notifications, and issues no request reading or writing `digestOptOut` through `/users/me` (per reconciliation). Build to `Settings.html` → `NotificationsTab` (descoped)
- [x] 7.2 GREEN: Implement the descoped Notifications tab
- [x] 7.3 REFACTOR: Clean up copy referencing the email unsubscribe path

## 8. Acceptance Test — Outer Loop GREEN

- [x] 8.1 Confirm the acceptance test passes end-to-end
- [x] 8.2 Verify `apps/web` starts in the local environment (smoke test) — boot the app and confirm `/settings` renders with no startup/config errors (no backend/codegen changes were made)
- [x] 8.3 REFACTOR: Clean up e2e mocks/fixtures and shared test setup if needed

## 9. Change Review — Subagent Verification

- [x] 9.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 9.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 10. Polish

- [x] 10.1 Run linter and fix all errors (`yarn lint`)
- [x] 10.2 Run formatter and apply fixes (`yarn format`)
- [x] 10.3 Run type checker with zero errors (`yarn workspace apps/web typecheck` / `yarn typecheck`)
- [x] 10.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace apps/web test:coverage`)
