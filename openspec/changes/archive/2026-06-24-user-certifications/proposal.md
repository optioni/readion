## Why

Certifications exist (`certifications` change) and users exist (`users` change), but there is no way for a user to enroll in a certification. Enrollment is the join that every downstream study feature scopes to: readiness, weak areas, sessions, reviews, and mock exams all hang off a `UserCertification`, not off `Certification` directly. Without it, the dashboard has nothing to list and the study loop cannot start. This change introduces the enrollment entity and its module so the rest of Phase 6+ has a per-user, per-cert anchor to build on.

## What Changes

- Introduce the `UserCertification` join entity (owned here) with its table + migration: links a `User` to a `Certification`, carries `status` (`active` | `archived`), `enrolledAt`, and per-cert session preference overrides.
- Add `UserCertificationsModule` (`apps/api`) exposing authenticated, ownership-scoped endpoints:
  - **Enroll** — `POST /api/v1/user-certifications` creates a `UserCertification` for the current user against a chosen certification. Only `live` certifications are enrollable (coverage gate, PRD FR11). Re-enrolling a cert the user previously archived **restores** that record rather than creating a duplicate — each (user, cert) maps to at most one enrollment.
  - **List** — `GET /api/v1/user-certifications` returns the current user's enrollments, filterable by status (active/archived), using the collection envelope.
  - **Detail** — `GET /api/v1/user-certifications/:id` returns a single enrollment using the single-resource envelope.
  - **Update overrides** — `PATCH /api/v1/user-certifications/:id` updates per-cert session preference overrides (partial; mirrors the user-profile session-defaults shape, each field independently overridable; clearing an override falls back to the user's profile default).
  - **Archive / restore** — `POST /api/v1/user-certifications/:id/archive` and `POST /api/v1/user-certifications/:id/restore` flip status without deleting, preserving history.
- Enforce ownership at the repository layer: every query is scoped on `userId`; cross-user access returns `404` (not `403`) to avoid leaking existence of others' records.
- Add `enrollment` Zod schemas, DTOs, and response types to `packages/shared`.
- Regenerate and commit the Orval client for the new endpoints.

This change does **not** add readiness, weak-area, or session columns/relations to `UserCertification` — those are introduced by their owning downstream changes (`readiness`, `weak-areas`, `sessions`). It also does not build the onboarding/dashboard enrollment UI (`web-onboarding`, `web-dashboard`).

## Capabilities

### New Capabilities
- `enrollment`: A user enrolling in a certification — create (live-cert only, restore-on-re-enroll), list (by status), detail, per-cert session preference overrides, and archive/restore lifecycle, all ownership-scoped to the authenticated user.

### Modified Capabilities
<!-- None. This change introduces a new capability only; it does not change requirements of existing specs. -->

## Impact

- **New entity + migration:** `UserCertification` in `packages/db` (ManyToOne → `User`, ManyToOne → `Certification`; unique on `(user, certification)`).
- **New API module:** `apps/api/src/user-certifications/` (controller, service, mapper, module) wired into `AppModule`, behind the global `JwtAuthGuard`.
- **Shared package:** new `enrollment` DTOs, request/response Zod schemas, and status constants in `packages/shared`.
- **Generated client:** `apps/web/src/api/` regenerated via `yarn codegen`.
- **Depends on:** `certifications` (Certification entity + live state), `users` (User entity + session-default shape). Both archived.
- **No worker cron or new feature-emitted metric** is introduced by this change. The account hard-purge cron (owned by `users`) already cascades to `UserCertification` rows on account deletion.
