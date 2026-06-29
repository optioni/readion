## Why

Phase 8 shipped the admin backend — `admin` (user list, promote/demote, append-only `AuditLog`), `content-admin` (content-source register/manage, manual re-ingest, ingestion-job status), and `cert-setup-grounding` (web-search source discovery, grounded per-field extraction with citations, unverified flags, re-verification) — but `apps/web` has no admin surface to drive any of it. SPEC → Frontend → Admin enumerates the admin console; this change (the final Phase 10 page, `web-admin`) builds that console against the already-shipped, already-committed Orval contract.

The first registered user is an admin and, when no certs exist, is routed straight into certification setup (SPEC → Onboarding "the first registered user … is routed straight to the admin certification-setup flow"). Without this change that route has no destination.

## What Changes

- New authenticated, **admin-only** area under `apps/web` reached through a dedicated `AdminSidebar` (artboard `app-shell.jsx` → `Shell.AdminSidebar`) with sections **Certifications**, **Review queue**, **Sources**, **Users**, **Audit Log** (and **Settings**, which links to the existing `/settings` page from `web-settings`). Access is gated by a new role-aware admin route middleware.
- **Certification setup** (`AdminCertSetup.html`) — a stepped flow for new/unlisted certs:
  - **Source discovery + confirm** → `POST /admin/certifications/discover-sources` returns candidate URLs (+ suggested content sources); admin confirms one or pastes a manual URL.
  - **Grounded field extraction + citations** → `POST /admin/certifications/extract` (202 + `jobId`), polled via `GET /admin/certifications/extractions/:jobId`, returns the four grounded fields (`domains`, `questionCount`, `passingScore`, `timeLimitMinutes`) each as `{ value, citation }` or `{ unverified: true }`. Admin reviews each field next to its cited passage, confirms or flags-as-uncertain (client-side state), and supplies the non-extractable identity fields (`name`, `provider`, `code`).
  - **Content sources + coverage** → register suggested/manual sources (`POST /admin/content-sources`) and watch per-domain go-live coverage read-only via `GET /certifications/:id/coverage`.
  - **Submit** → `POST /admin/certifications` creates the **draft** cert with a per-field `provenance` map (`{url,passage}` | `{unverified}` | `{manuallyConfirmed}`). There is **no publish button**: draft → live is automatic when the coverage bar is met (SPEC → Certification Setup & Grounding; owned by `cert-go-live`).
  - **Re-verification** of stale certs → list via `GET /admin/certifications/due-for-reverification`; re-run discovery/extraction, diff the proposed values against the current live cert client-side, submit `POST /admin/certifications/:id/reverify`.
- **Content source management** (`AdminContentUsers.html` → Sources) — per-cert source table (`GET /admin/content-sources?certificationId=`), enable/disable (`POST :id/enable` / `:id/disable`), manual re-ingest (`POST :id/reingest` → 202), and a running-jobs banner + status driven by `GET /admin/content-sources/:id/jobs` / `:id/jobs/:jobId`.
- **User management** (`AdminContentUsers.html` → Users) — user table (`GET /admin/users`: email, role, emailVerified, createdAt, enrollmentCount), promote (`POST /admin/users/:id/promote`) and demote (`POST /admin/users/:id/demote`, 409 on last admin).
- **Audit log** (`AdminContentUsers.html` → Audit Log) — append-only, read-only table from `GET /admin/audit-logs` (action, targetType, targetId, before/after JSONB, createdAt; actor as `userId`).
- Extend the frontend `AuthUser` type with `role` (already returned by `GET /users/me`) so the admin middleware and admin shell can gate on it; add an `adminQueryKeys` composable; reuse `statusColor` helpers, the auth store, and the established table/form/query-key patterns.
- **No backend, entity, migration, cron, metric, or `yarn codegen` work.** Every consumed endpoint already exists in the committed Orval client (`apps/web/src/api/{admin,content,cert-setup,certifications,certification-coverage}`).

## Capabilities

### New Capabilities
- `web-admin`: The `apps/web` admin console — certification setup & grounding (source discovery/confirm, grounded per-field extraction with citations + unverified flags, draft creation, stale re-verification), content-source management + ingestion-job status, user management (promote/demote), and the read-only audit log — driven by the existing `admin`, `content-admin`, `cert-setup-grounding`, `certifications`, and `cert-go-live` HTTP contracts.

### Modified Capabilities
<!-- None. Frontend-only consumer of existing backend capabilities; no backend spec requirements change. -->

## Impact

- **Code**: `apps/web/app/pages/admin/` (section pages), `apps/web/app/middleware/admin.ts` (role gate), `apps/web/app/components/admin/*` (AdminSidebar shell, cert-setup steps, citation/field panels, coverage bars, source table, users table, audit table), `apps/web/app/composables/adminQueryKeys.ts` and per-surface query/mutation wrappers. Extends `AuthUser` (`app/stores/auth.ts`) with `role`. Reuses `statusColor.ts`, `useAuthStore`, the profile-envelope read pattern, and existing table/badge primitives. New Playwright e2e under `apps/web/e2e/`.
- **APIs consumed (all already in the committed Orval client — no codegen)**:
  - Users: `adminControllerListUsers`, `adminControllerPromote`, `adminControllerDemote`, `adminControllerListAuditLogs`.
  - Content: `contentControllerList`, `contentControllerRegister`, `contentControllerEnable`, `contentControllerDisable`, `contentControllerReingest`, `contentControllerListJobs`, `contentControllerJobStatus`.
  - Cert setup: `certSetupControllerDiscoverSources`, `certSetupControllerExtract`, `certSetupControllerReadExtraction`, `certSetupControllerListDueForReverification`, `certSetupControllerCreate`, `certSetupControllerReverify`.
  - Certs/coverage: `certificationsControllerDetail`, `certificationCoverageControllerCoverage`.
  - Several admin client methods are weakly typed (`data: void`) because the controllers expose `@ApiResponse` DTOs but the generated success type is narrowed at the page using `@readion/shared` types (`AdminUserListResponse`-shaped data, `DiscoverSourcesResponse`, `ExtractionStatusResponse`, `ContentSourceResponse`, `IngestionJobStatus`, `DueForReverificationItem`) and request schemas (`registerSourceRequestSchema`, `discoverSourcesRequestSchema`, `extractRequestSchema`, `createCertificationRequestSchema`, `reverifyCertificationRequestSchema`).
- **Backend gaps flagged (out of scope, recorded as follow-ups, not implemented here)** — the artboards draw controls with no backend; behavioural spec + the real contract win:
  1. **Quarantine review queue has no backend.** SPEC → Frontend → Admin asks admins to "review and manage quarantined generated items … with provenance," and the `Review queue` artboard (verdict, paired source evidence, Edit key / Discard / Approve-as-is) is fully drawn — but no endpoint lists, reads, or resolves quarantined items. `QuarantineService.quarantine()` only evicts the LLM cache and increments a Prometheus counter; nothing is persisted or queryable, and only the user-facing `POST /quiz/:questionId/report` feeds it. The Review-queue section (and its nav badge count) is **descoped to an explicit "not yet available" placeholder**; a persisted quarantine store + admin list/review/resolve endpoints are required in `grounding-verification`/`content-admin` first.
  2. **No admin listing/detail of draft certs.** `certificationsControllerList`/`Detail` filter to `state: 'live'`, so the cert-setup flow is linear (discover → extract → create → coverage-by-id) with no re-entrant "drafts in progress" list.
  3. **Content sources have no chunk-count, status, or name field, no cancel-job, and no delete.** `ContentSourceResponse` carries only `enabled`/`lastFetchedAt`; the table derives a status pill from the latest job state, omits chunk counts, labels by `url`/`type`, maps "Remove" to **disable**, and drops the per-job "Cancel".
  4. **Source registration is URL-only** (`registerSourceRequestSchema.url` must be a valid URL); the artboard's "upload PDF" is not supported (PDF sources are registered by URL).
  5. **Field extraction yields only four grounded fields**; the artboard's ~11 metadata fields (full name, certifying body, cost, prerequisite, validity, format, …) have no extraction backing and are dropped (identity fields are admin-entered).
  6. **Re-verification has no server-computed diff** and there is no manual publish/sign-off endpoint; the diff is composed client-side and submitted via `reverify`.
  7. **Users**: no `name`/`lastActive` field, no search param, no invite, and no admin force-delete; the audit log exposes `userId` (not actor email — `AuditLog` is "stripped of direct identifiers") and has no CSV export. These artboard controls are dropped.
- **Dependencies**: archived `web-foundation`, `content-admin`, `cert-setup-grounding`, `admin` (all present). No new runtime dependencies.
