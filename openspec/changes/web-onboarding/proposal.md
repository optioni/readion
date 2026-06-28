## Why

After registration (`web-auth`) and the post-login dashboard (`web-dashboard`), a brand-new user with zero enrollments lands on the dashboard's empty state with no guided path into the product. SPEC → Frontend → Onboarding and SPEC → Certification Enrollment require a first-run **onboarding flow** that walks the new user through picking a target certification, setting default session preferences, and optionally taking a diagnostic exam to calibrate their first session — with correct routing for the day-one edge cases (no certifications exist yet; first user is an admin who should configure certs instead). Without it, a new account is a dead end until the user discovers the dashboard's add-cert modal.

## What Changes

- Add a first-run **onboarding flow** in `apps/web` (Nuxt page(s) under `app/pages/onboarding/`) that runs after registration/verification for a user with no active enrollments:
  - **Step 1 — Cert select:** choose a target certification from the live catalog (`GET /certifications`, which already returns only `state: 'live'` certs).
  - **Step 2 — Default session preferences:** configure user-level session defaults (duration, content mix, difficulty, focus area, learning style) saved to the user profile via `PATCH /users/me`, pre-filled from current `GET /users/me` defaults.
  - **Enroll:** create the `UserCertification` via `POST /user-certifications` with the selected `certificationId` (carrying the chosen defaults as per-cert `sessionDefaults`).
  - **Step 3 — Diagnostic offer:** read `GET /user-certifications/:id/diagnostic-offer`; when `offer === 'onboarding'`, present the "Take a 2-minute diagnostic to personalize your first session" card with a clear **Skip**. Take → `POST /user-certifications/:id/diagnostic` then route into the mock-exam runner; Skip → `POST /user-certifications/:id/diagnostic-offer/dismiss` and land on the dashboard.
- Add the **diagnostic re-prompt** surface: when the dashboard/cert context reports `offer === 're-prompt'` (uncalibrated after the first session), show a dismissible re-prompt nudge that reuses the same Take/Skip actions. (The nudge is a small reusable component; placement on the dashboard is wired here without modifying `web-dashboard`'s owned components beyond mounting it.)
- Add **first-run routing / empty-state** logic (route middleware + page guards):
  - Onboarding is only reachable when at least one live certification exists.
  - **No certifications exist:** first user (role `admin`) is routed to the admin certification-setup flow (route owned by `web-admin`, not yet built — placeholder target reconciled later); a non-admin with zero available certs sees a **"No certifications available yet"** empty state instead of a dead-end cert picker.
  - A user who already has an active enrollment is redirected to the dashboard rather than re-onboarded.
- Reuse established `apps/web` patterns: vue-query composables, `dashboardQueryKeys`-style keyed queries, the `statusColor`/design-token helpers, the `AddCertificationModal` enroll flow, and the wired Readion design-system tokens.

This change is a **frontend assembly layer** over already-shipped backend endpoints. No new API, entity, migration, cron, metric, or `yarn codegen` — every endpoint it consumes is already in the committed Orval client (`apps/web/src/api`).

## Capabilities

### New Capabilities
- `web-onboarding`: First-run onboarding flow (cert select → default session prefs → optional diagnostic offer), the diagnostic re-prompt nudge, and the day-one routing rules (no-certs admin → cert-setup, no-certs non-admin → empty state, already-enrolled → dashboard).

### Modified Capabilities
<!-- None. No backend spec requirements change; web-dashboard / enrollment / diagnostic-exam capabilities are consumed as-is. -->

## Impact

- **apps/web (only):** new `app/pages/onboarding/` flow, supporting components (cert picker, session-defaults form, diagnostic offer card, re-prompt nudge, no-certs empty state), composables (onboarding query keys, role+enrollment gate, enroll+diagnostic actions), and route middleware for first-run/empty-state routing. Playwright e2e specs in `apps/web/e2e/` plus Vitest component/composable unit tests.
- **Consumed backend contract (unchanged):** `GET /certifications`, `GET /users/me` + `PATCH /users/me`, `POST /user-certifications`, `GET /user-certifications/:id/diagnostic-offer`, `POST /user-certifications/:id/diagnostic`, `POST /user-certifications/:id/diagnostic-offer/dismiss`. All present in the committed Orval client.
- **Cross-change route stubs:** the admin cert-setup target (`web-admin`) and the mock-exam runner target (`web-mock-exam`) are not yet built; this change navigates to placeholder routes and flags them for reconciliation when those changes land.
- **No** new entities, migrations, worker crons, emitted metrics, or Orval regeneration.
- **Design:** the canonical `Onboarding.html` artboard could not be pulled — the `DesignSync` connector is absent from this environment. The visual section of `design.md` is driven from SPEC → Frontend (Onboarding) + DESIGN.md token values + the archived `web-dashboard`/`web-cert-detail` component patterns, and flags a re-pull + re-diff against `Onboarding.html` when DesignSync is available.
