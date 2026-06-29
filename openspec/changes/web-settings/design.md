## Context

`web-settings` is the Phase 10 frontend page that lets an enrolled learner manage their account. The backend it consumes already shipped: `users` (profile read/update, session defaults, account deletion), `auth` (forgot/reset password), and `email-lifecycle` (weekly-digest opt-out via tokenized unsubscribe). The SPEC has no standalone "Settings" page section; the page is the home for "Light/dark toggle available in the user preferences" (Frontend visual style) and "Users can delete their own account from preferences" (Account Deletion), plus the UsersModule profile/session-default surface.

This is a frontend-only change in `apps/web`. No backend module, entity, migration, cron, metric, or `yarn codegen` work is involved — every endpoint is already a committed Orval method. The work is building the page, its tabs, a delete-confirmation modal, a `settingsQueryKeys` composable, and reusing established `apps/web` patterns.

## Goals / Non-Goals

**Goals:**
- A `/settings` page in the app shell (sidebar `Settings` active) with Account, Study defaults, and Notifications tabs.
- Account: read-only email + display-timezone edit (`PATCH /users/me`), password reset via email (`POST /auth/forgot-password`), delete account with password re-confirmation (`DELETE /users/me`) → logout + redirect.
- Study defaults: edit all five `sessionDefaults` bound to the real `@readion/shared` enums, reusing `OnboardingSessionPrefs`.
- Notifications: surface the weekly-digest opt-out honestly against what the contract supports.
- Reuse the auth store, profile-envelope read helper, color-mode toggle, and query-key composable patterns.

**Non-Goals:**
- No backend changes. The missing change-password endpoint and the unexposed `digestOptOut` field are flagged as follow-ups, not built here.
- No email editing (the profile contract has no email-update field).
- No "Full name" or avatar upload (no `User.name` field; avatar is derived initials).
- No invented notification toggles for fields that do not exist.
- No `yarn codegen` (no new/changed endpoints).

## Visual Design

Visual source of truth: the committed canonical artboard at `../../design/Settings.html` (loads the sibling `app-shell.jsx` and the `_ds/` Readion token bundle). It is the shared design mirror — not copied per-change and not modified by this change.

| Artboard / screen | Maps to |
|---|---|
| `Settings.html` → `SettingsLayout` (AppSidebar active=Settings + `SettingsTabs` + max-width 580 content column) | `/settings` page shell + tab bar |
| `Settings.html` → `AccountTab` (Profile, Password, Danger zone sections) | Account tab + delete-account confirm modal |
| `Settings.html` → `StudyDefaultsTab` (session preference controls) | Study defaults tab (reuses `OnboardingSessionPrefs`) |
| `Settings.html` → `NotificationsTab` (Email + In-app toggle groups) | Notifications tab (descoped — see reconciliation) |

**Layout to implement:** one `SettingsLayout` (app shell + sidebar `Settings` active + three-tab bar + constrained content column), built once and shared by all three tab panels. Reuse the existing app shell / `AppNavBar` and `ColorModeToggle` rather than rebuilding the sidebar.

### Design ↔ contract reconciliation

The artboard was drawn ahead of the API and diverges from the implemented contract in several places. Behavioral spec + real contract win.

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Account → "Full name" text input | `User` has no `name` attribute (`authUserSchema` = id/email/role/emailVerified) | Drop the field entirely. |
| Account → editable "Email" input | `PATCH /users/me` accepts only `displayTimezone` + `sessionDefaults`; email is not updatable | Render email read-only. |
| Account → (no timezone control shown) | Real profile carries `displayTimezone` (default `Europe/Helsinki`), the one editable identity field | Add an IANA timezone control seeded from the profile; Save → `PATCH /users/me { displayTimezone }`. |
| Account → Password "current / new / confirm" + "Update password" | No change-password endpoint exists anywhere in `auth` | Replace with a "Change password → email me a reset link" action calling `POST /auth/forgot-password`; reuse the existing reset-password page. Flag the missing endpoint as a backend follow-up. |
| Danger zone → bare "Delete account" button | `DELETE /users/me` requires password re-confirmation in the body | Add a confirm modal that collects the password; on `204` clear auth store + redirect to login (tokens are revoked server-side). |
| Study defaults → duration slider (5/15/30/45/60m, "20 min") | Real `duration` is four discrete literals `15/30/60/90` | Use a discrete control over the real durations, not a continuous slider. |
| Study defaults → pill labels Content mix (Questions/Mixed/Concepts first), Difficulty (Adaptive/Easy/Medium/Hard), Learning style (Spaced rep./Intensive) | Implemented enums differ (e.g. contentMix `balanced/reading-heavy/quiz-heavy`, difficulty `beginner/intermediate/advanced/adaptive`, learningStyle `weak-area-focus/spaced-repetition/scenario-based`) | Bind controls to the exact `@readion/shared` constants; reuse `OnboardingSessionPrefs`. |
| Study defaults → no `focusArea` control | `focusArea` (`auto/weak-areas/new-material/review`) is a real fifth session default | Add it; render all five via `OnboardingSessionPrefs`. |
| Notifications → 7 toggles (Weekly summary, Review reminders, Streak alerts, Exam countdown; In-app: Session summary, Readiness milestones, Agent suggestions) | Only `digestOptOut` exists, and it is not exposed on `GET`/`PATCH /users/me`; the other six have no field at all | Drop the six unbacked toggles. Surface the weekly-digest opt-out informatively (one-click unsubscribe lives in the digest email). Flag that an authenticated two-way digest toggle needs `digestOptOut` exposed on `users`/`email-lifecycle`. |

## Test Boundaries

Frontend-only change. Acceptance tests are Playwright e2e in `apps/web/e2e/` driving the real Nuxt app against mocked HTTP (the established `web-*` pattern — intercept `/api/v1/*` routes). Component/page unit specs are Vitest with vue-query and the API client stubbed at the generated-method boundary.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| `apps/web` Nuxt app (page, tabs, modal) | real (rendered) | real (mounted component) |
| `GET/PATCH/DELETE /api/v1/users/me` | HTTP mock (route interception) | mock generated Orval methods (`usersControllerGetMe/UpdateMe/DeleteMe`) |
| `POST /api/v1/auth/forgot-password` | HTTP mock | mock `authControllerForgotPassword` |
| Auth store (`useAuthStore`) | real (Pinia) | real (Pinia) |
| `@readion/shared` schemas/constants | real | real |
| NestJS API / Postgres / Redis | not involved (no backend changes) | not involved |

## Decisions

- **Password "change" = forgot-password email flow.** No change-password endpoint exists; rather than invent one (out of scope for a frontend change), reuse `POST /auth/forgot-password` + the existing reset page. Alternative considered: add a backend `PATCH /users/me/password` — rejected as out of scope and owned by `users`/`auth`. Recorded as a backend follow-up.
  - **Pin:** the Account tab calls the generated `authControllerForgotPassword` client method (the boundary the unit tests mock), **not** a raw `fetch`. That method is body-less (`authControllerForgotPassword(options?: RequestInit)`), so the signed-in user's email is supplied through the request body, e.g. `authControllerForgotPassword({ body: JSON.stringify({ email }), headers: { 'Content-Type': 'application/json' } })`, validated against `@readion/shared` `forgotPasswordRequestSchema`. This intentionally diverges from the older `apps/web/app/pages/forgot-password.vue`, which uses a raw `fetch` and therefore could not satisfy the named mock boundary.
- **Notifications tab descoped to digest opt-out only.** `digestOptOut` is the sole backing field and is not exposed on the authenticated profile contract; the only mutation is the public tokenized unsubscribe. Building seven toggles would wire UI to nonexistent fields. Decision: surface the digest opt-out honestly and flag the backend gap. Alternative: stub all toggles in local state — rejected (misleads the user; persists nothing).
- **Profile typing via `@readion/shared`, not the generated client.** The `users` controller has no swagger DTOs, so Orval types the profile as `data: void`. Reuse the existing `readProfileEnvelope` pattern to narrow the envelope with `userProfileResponseSchema`. Alternative: `yarn codegen` — would not add types without backend DTOs, so it is unnecessary.
- **Reuse `OnboardingSessionPrefs` for Study defaults.** It already renders all five defaults from the shared constants and emits a validated `SessionDefaults`. Avoids duplicating the control. The Settings page wraps it with a save → `PATCH /users/me { sessionDefaults }` mutation.
- **Delete = confirm modal + post-success logout.** Because the server revokes refresh tokens on soft-delete, the client must clear `useAuthStore` and redirect to login to avoid a broken authenticated state.

## Risks / Trade-offs

- [Digest opt-out cannot be toggled from Settings without a backend change] → Surface it informatively and point to the email unsubscribe link; record the `digestOptOut`-on-`/users/me` exposure as a follow-up so the tab can later gain a real toggle.
- [Password reset-by-email is a weaker UX than in-place change] → Acceptable and fully backed; clearly worded ("we'll email you a secure link"); flagged for a future dedicated endpoint.
- [Weakly-typed profile client (`data: void`)] → Mitigated by narrowing through `@readion/shared` schemas, matching the established onboarding pattern; type-safe at the page boundary.
- [Account deletion is destructive] → Password re-confirmation modal + explicit copy; relies on the server-side 14-day soft-delete grace window for recovery.

## Open Questions

- None blocking. Two backend follow-ups are recorded (out of scope here): (1) a dedicated change-password endpoint; (2) exposing `digestOptOut` (and any future notification preferences) on `GET`/`PATCH /api/v1/users/me` so the Notifications tab can offer an authenticated two-way toggle.
