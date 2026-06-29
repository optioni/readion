## Why

Enrolled learners have no place to manage their account: the SPEC puts the light/dark toggle "in the user preferences" and says "Users can delete their own account from preferences", and the `users` + `email-lifecycle` backends already expose profile read/update, session-default preferences, account deletion, and the weekly-digest opt-out — but `apps/web` has no Settings page to drive any of it. This change builds that page (Phase 10 `web-settings`), the frontend surface for the already-shipped `GET/PATCH/DELETE /api/v1/users/me` contract.

## What Changes

- New `/settings` page in `apps/web`, reached from the app sidebar (`active="Settings"`), with three tabs: **Account**, **Study defaults**, **Notifications**.
- **Account tab**:
  - Profile: read-only email + role/verification context (email is not editable per the contract), an editable **display timezone** control, derived initials avatar. Save → `PATCH /users/me { displayTimezone }`.
  - Password: a "Change password" action that triggers `POST /auth/forgot-password` for the signed-in user ("we'll email you a secure reset link"), reusing the existing reset-password page. **No dedicated change-password endpoint exists** — see Impact.
  - Danger zone: "Delete account" → confirmation modal collecting the **password re-confirmation** required by `DELETE /users/me`; on 204 clear the auth store and redirect to login (server revokes all refresh tokens).
- **Study defaults tab**: edit all **five** session defaults (`duration`, `contentMix`, `difficulty`, `focusArea`, `learningStyle`) bound to the real `@readion/shared` enums, reusing the `OnboardingSessionPrefs` control. Save → `PATCH /users/me { sessionDefaults }`.
- **Notifications tab**: surface the **weekly-digest opt-out** (the one real notification field, `digestOptOut`) informatively, pointing to the one-click unsubscribe link that lives in the digest email itself. The tab issues **no** request: the only mutation of `digestOptOut` is the public tokenized `GET /email/unsubscribe?token=...`, which is reachable only from the email (it carries the required token), not from authenticated Settings. The artboard's other six toggles have no backing field and are **not** built — see Impact.
- Add a `settingsQueryKeys` composable and reuse the existing profile-envelope read helper, auth store, and color-mode toggle. Theme (light/dark) preference lives here per SPEC.
- No backend, entity, migration, cron, metric, or `yarn codegen` work: every consumed endpoint already exists in the committed Orval client.

## Capabilities

### New Capabilities
- `web-settings`: The `apps/web` Settings page — account profile/timezone/password-reset/account-deletion (Account tab), session-default preferences (Study defaults tab), and weekly-digest opt-out (Notifications tab) — driven by the existing `users`, `auth`, and `email-lifecycle` HTTP contracts.

### Modified Capabilities
<!-- None. This is a frontend-only consumer of existing backend capabilities; no backend spec requirements change. -->

## Impact

- **Code**: `apps/web/app/pages/settings/` (page + tabs), new components (timezone control, delete-account confirm modal, password-reset action, notifications panel), `apps/web/app/composables/settingsQueryKeys.ts`. Reuses `OnboardingSessionPrefs.vue`, `ColorModeToggle.vue`/`useReadionColorMode.ts`, `useAuthStore`, and the `readProfileEnvelope` pattern. New Playwright e2e under `apps/web/e2e/`.
- **APIs consumed (all already in the committed Orval client — no codegen)**: `usersControllerGetMe`, `usersControllerUpdateMe`, `usersControllerDeleteMe`, `authControllerForgotPassword`. The tokenized `emailControllerUnsubscribe` (`GET /api/v1/email/unsubscribe`) is **not** consumed by this page — it is reachable only from the digest email's one-click link, which carries the required token; the Notifications tab merely points to it. Profile client methods are weakly typed (`data: void`) because the backend controller has no swagger DTOs, so the page narrows the envelope using `@readion/shared` schemas/types (`userProfileResponseSchema`, `UserProfileResponse`, `sessionDefaultsSchema`, `UpdateUserProfileRequest`). `authControllerForgotPassword` is likewise body-less in the client (`options?: RequestInit`), so the email is supplied via the request body — see design.md.
- **Backend gaps flagged (out of scope, recorded as follow-ups, not implemented here)**:
  1. No dedicated **change-password** endpoint exists (`auth` exposes only forgot/reset) — the Account tab uses the forgot-password email flow as the contained substitute.
  2. **`digestOptOut` is not exposed on `GET`/`PATCH /users/me`** and appears nowhere in the Orval client; the only mutation is the public token-based `GET /email/unsubscribe?token=...` (one-directional, no opt-back-in, no authenticated read). An authenticated two-way digest toggle requires a backend follow-up in `users`/`email-lifecycle`.
- **Dependencies**: archived `web-foundation`, `web-auth`, `users`, `email-lifecycle` (all present). No new runtime dependencies.
