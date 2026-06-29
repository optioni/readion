## Context

`web-admin` is the final Phase 10 frontend page: the `apps/web` admin console. Its backend shipped in Phase 8 — `admin` (users + audit log), `content-admin` (content sources + ingestion jobs), `cert-setup-grounding` (discovery/extraction/re-verification) — plus the `cert-go-live` coverage read model. SPEC → Frontend → Admin enumerates the surfaces; this change consumes the already-committed Orval client to build them.

This is a frontend-only change in `apps/web`. No backend module, entity, migration, cron, metric, or `yarn codegen` work is involved — every consumed endpoint is already a committed Orval method (verified in `apps/web/src/api/{admin,content,cert-setup,certifications,certification-coverage}`). The work is building the admin shell + role gate, the section pages, the cert-setup wizard, query-key composables, and reusing established `apps/web` patterns.

## Goals / Non-Goals

**Goals:**
- An admin-only area gated by a role-aware route middleware, using the `AdminSidebar` chrome (Certifications, Review queue, Sources, Users, Audit Log, Settings).
- Users: list + promote/demote (`admin` contract).
- Audit log: read-only append-only table (`admin` contract).
- Sources: per-cert list, register-by-URL, enable/disable, re-ingest, job status (`content-admin` contract).
- Cert setup: source discovery → grounded per-field extraction with citations + unverified flags → draft creation with provenance → read-only go-live coverage; plus stale-cert re-verification (`cert-setup-grounding` + `cert-go-live` contracts).
- Reuse the auth store (extended with `role`), `statusColor` helpers, profile-envelope read pattern, and query-key composable pattern.

**Non-Goals:**
- No backend changes. The quarantine-review backend, draft-cert listing, source chunk-count/status/cancel/delete, change-of-publish gate, and server-computed re-verify diff are flagged as follow-ups, not built here.
- No `yarn codegen` (no new/changed endpoints).
- No quarantine review queue beyond an honest placeholder (no backend exists).
- No invented fields/toggles for data the contract does not expose.

## Visual Design

Visual source of truth: the two committed canonical artboards `../../design/AdminCertSetup.html` and `../../design/AdminContentUsers.html` (both load the sibling `app-shell.jsx`, which exports `Shell.AdminSidebar`, and the `_ds/` Readion token bundle). They are the shared design mirror — not copied per-change and not modified by this change.

| Artboard / screen | Maps to |
|---|---|
| `app-shell.jsx` → `Shell.AdminSidebar` (Certifications, Review queue, Sources, Users, Audit Log, Settings) | The admin shell chrome + section routing |
| `AdminCertSetup.html` → `SourceConfirmationScreen` (Step 1) | Cert setup: discovery + confirm |
| `AdminCertSetup.html` → `FieldExtractionScreen` (Step 2, field list + citation panel) | Cert setup: grounded extraction + citations |
| `AdminCertSetup.html` → `ContentSourcesScreen` (Step 3, sources + coverage bars + go-live readiness) | Cert setup: sources + read-only coverage |
| `AdminCertSetup.html` → `ReviewPublishScreen` (Step 4) | Cert setup: review + draft submission (no publish button) |
| `AdminCertSetup.html` → `StaleRecertScreen` (diff view) | Re-verification: client-side diff + `reverify` |
| `AdminContentUsers.html` → `ContentQualityScreen` (Review queue) | Review queue placeholder (no backend) |
| `AdminContentUsers.html` → `ContentSourcesScreen` (sources table + jobs banner) | Sources section |
| `AdminContentUsers.html` → `UsersScreen` | Users section |
| `AdminContentUsers.html` → `AuditLogScreen` | Audit Log section |

**Layout to implement:** one admin shell component (the `AdminSidebar` chrome + active-section highlight + admin-session footer), built once and shared by all sections, plus the multi-step cert-setup wizard. Reuse `statusColor.ts` for coverage bars / status pills and the existing table/badge primitives where they exist; do not rebuild the learner `AppNavBar`.

### Design ↔ contract reconciliation — AdminCertSetup.html

Behavioural spec + real contract win.

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Step 1 source rows → "High / Medium confidence" badge | `DiscoverSourcesResponse.candidates[]` = `{ url, title, snippet? }` only — no confidence field | Drop the confidence badge; render title + url (+ snippet). |
| Step 1 "Verify" button on manual URL | No URL-validation endpoint exists | The manual URL is simply used as `confirmedSourceUrl` for extraction; client-side validates it is a URL (matching `extractRequestSchema.confirmedSourceUrl`). |
| Step 2 field list of ~11 fields (exam code, full name, certifying body, duration, format, passing score, prerequisite, validity, question count, cost, domains) | Extraction returns only four fields: `domains`, `questionCount`, `passingScore`, `timeLimitMinutes` (`CertExtractionFields`) | Render only the four grounded fields with citations; collect `name`/`provider`/`code` as admin-entered identity inputs; drop cost/prerequisite/validity/format/certifying-body (no extraction backing). `duration` ⇒ `timeLimitMinutes`. |
| Step 2 per-field "Confirm" / "Flag as uncertain" implying server writes | No per-field confirm endpoint; only the final `POST /admin/certifications` persists | Per-field confirm/flag is client-side review state; it is materialised into the `provenance` map at submit (`{url,passage}` | `{unverified}` | `{manuallyConfirmed}`). |
| Step 3 "Approve / Reject" agent-proposed source (pending-review status) | No "pending source" entity; `ContentSource` is `enabled`/`disabled` only. Discovery returns `suggestedContentSources[]` (ephemeral) | "Approve" = `POST /admin/content-sources` (register) from a suggested source; "Reject" = discard client-side. No "pending review" status pill. |
| Step 3 "Add source URL or upload PDF" | `registerSourceRequestSchema` = `{ certificationId, type, url(URL) }` — no file upload | Register by URL only (PDF sources are URLs); no upload control. |
| Step 3 go-live readiness checklist incl. "Admin review sign-off" | Coverage comes from `GET /certifications/:id/coverage` (per-domain bars); there is no manual sign-off gate | Render coverage read-only from the coverage endpoint; drop "Admin review sign-off" (draft→live is automatic). |
| Step 4 "Publish certification" button + sign-off checkbox | SPEC → Certification Setup & Grounding: "Draft → live is automatic … there is no manual 'publish' button"; `cert-go-live` flips state at the coverage bar | **No publish button.** The final action is `POST /admin/certifications` → creates a `draft`; "Save as draft" is the only submit. Show coverage progress + unresolved-field resolution. |
| Stale-recert "agent identified changes" auto-diff (current vs proposed) | No server endpoint returns a diff/proposed delta | Re-run `discover-sources` + `extract` for the stale cert, read current values via `certificationsControllerDetail`, diff client-side, submit `POST /admin/certifications/:id/reverify`. "Accept all changes" is client-side. |
| "Certifications" nav implying a browsable list of in-setup/draft certs | `certificationsControllerList`/`Detail` filter to `state: 'live'` — drafts are not listable/readable | The setup flow is linear (discover → extract → create → coverage-by-id from the create response); the stale list comes from `due-for-reverification`. No draft browser (flagged follow-up). |

### Design ↔ contract reconciliation — AdminContentUsers.html

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Review queue (entire `ContentQualityScreen`: quarantined-item list, verdict badges, paired source evidence, Edit key / Discard / Approve-as-is, nav badge count `4`) | **No backend.** No list/read/resolve endpoint for quarantined items; `QuarantineService.quarantine()` only evicts cache + increments a counter; only `POST /quiz/:questionId/report` feeds it | Render a clear "not yet available" placeholder; no requests, no fabricated items/verdicts, no nav badge count. Flag the persisted-quarantine-store + admin endpoints as a `grounding-verification`/`content-admin` follow-up. |
| Sources table "Chunks" column (e.g. 1,247) | `ContentSourceResponse` has no chunk count | Omit the chunk-count column. |
| Sources "Status" pill (active / ingesting / disabled / error) | `ContentSourceResponse` has only `enabled` + `lastFetchedAt`; status lives on jobs | Derive the pill from `enabled` (disabled) + latest `IngestionJobStatus.state` (`active`→ingesting, `failed`→error, else active). |
| Sources friendly names ("Official exam guide (PDF)") | `ContentSource` has no name | Label by `url` + `type`. |
| Running-job banner "72% · ~4 min remaining" + "Cancel" | `IngestionJobStatus` gives `progress`/`state` but there is no cancel-job endpoint | Show progress from `GET :id/jobs`; drop the "Cancel" control and the time estimate (no field). |
| Source row "Remove" (delete) | No delete endpoint; only `POST :id/disable` | Map "Remove" to disable. |
| Users "Name" + avatar | `AdminUserListItem` = `{ id, email, role, emailVerified, createdAt, enrollmentCount }` — no name | Show email as identity; avatar = derived initials from email. |
| Users "Last active" column | No such field | Drop the column (show join date from `createdAt`). |
| Users "Search users" + "Invite user" + "Remove" (delete user) | `listUsers` has no search param; no invite or admin delete endpoint | Drop search, invite, and delete-user controls. |
| Users "12 users · 2 admins" summary | `meta.total` gives total; admin count is not provided | Show total from `meta.total`; omit the admin count (or compute from the current page only, labelled as such). |
| Audit "Actor" as email | `AuditLogEntry.userId` is a uuid; `AuditLog` is "stripped of direct identifiers" | Render the `userId` actor; do not fabricate an email. |
| Audit "Export CSV" | No export endpoint | Drop the export control. |
| Audit before/after as plain strings | `before`/`after` are JSONB objects (nullable) | Render the JSONB snapshots (stringified/keyed), tolerating `null`. |

## Test Boundaries

Frontend-only change. Acceptance tests are Playwright e2e in `apps/web/e2e/` driving the real Nuxt app against mocked HTTP (the established `web-*` pattern — intercept `/api/v1/*`). Component/page unit specs are Vitest with vue-query and the Orval client stubbed at the generated-method boundary; an `admin`-role profile is seeded for the route gate.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| `apps/web` Nuxt app (admin shell, sections, wizard) | real (rendered) | real (mounted component) |
| `GET /admin/users`, `POST /admin/users/:id/promote|demote`, `GET /admin/audit-logs` | HTTP mock | mock `adminControllerListUsers/Promote/Demote/ListAuditLogs` |
| `GET/POST /admin/content-sources` (+ `:id/enable|disable|reingest|jobs`) | HTTP mock | mock `contentControllerList/Register/Enable/Disable/Reingest/ListJobs/JobStatus` |
| `POST /admin/certifications/discover-sources|extract`, `GET .../extractions/:jobId`, `GET .../due-for-reverification`, `POST /admin/certifications`, `POST .../:id/reverify` | HTTP mock | mock `certSetupControllerDiscoverSources/Extract/ReadExtraction/ListDueForReverification/Create/Reverify` |
| `GET /certifications/:id`, `GET /certifications/:id/coverage` | HTTP mock | mock `certificationsControllerDetail`, `certificationCoverageControllerCoverage` |
| Auth store (`useAuthStore`, with `role`) + admin route middleware | real (Pinia) | real (Pinia) |
| `@readion/shared` schemas/types | real | real |
| NestJS API / Postgres / Redis | not involved (no backend changes) | not involved |

## Decisions

- **Role on the frontend `AuthUser`.** `GET /users/me` already returns `role` (`UsersService.toProfile`), and `@readion/shared` `authUserSchema` includes it, but the hand-written `AuthUser` in `app/stores/auth.ts` omits it. Add `role: RoleValue` to `AuthUser` and populate it from the existing bootstrap (`runAuthBootstrap` reads `/users/me`). Alternative: a separate role fetch — rejected (the data is already on the profile). The admin middleware reads `auth.user?.role === 'admin'`.
  - **Pin:** the admin guard is a **non-global** route middleware applied to `/admin/**` pages (the existing `auth.global.ts` stays as-is for authentication); it awaits `auth.ready` then redirects non-admins (to `/`) and unauthenticated users (to login), mirroring `auth.global.ts`.
- **Quarantine review = honest placeholder.** No endpoint lists/reads/resolves quarantined items; building the artboard's queue would wire UI to nonexistent endpoints. Decision: render a "not yet available" placeholder, no requests, no nav badge count; flag the backend follow-up. Alternative: stub items in local state — rejected (fabricates data; misleads admins).
- **Cert setup persists once, at the end.** Discovery/extraction are read/poll; per-field confirm/flag is client review state; the single write is `POST /admin/certifications` with the assembled `provenance` map. No publish button — `cert-go-live` flips `draft`→`live` automatically at the coverage bar; coverage is shown read-only via `certificationCoverageControllerCoverage`.
  - **Pin:** extraction is `202` + `jobId`; poll `certSetupControllerReadExtraction` until `data.fields` is non-null, then render the four fields. The poll keys off `data.state` (the BullMQ job state string): keep polling while non-terminal, surface a retryable error on a failed/terminal-without-fields state, and stop on success. Build the `provenance` map with `@readion/shared` `buildProvenanceMap` (grounded ⇒ `{url,passage}` from the citation, admin-edited ⇒ `manuallyConfirmed`, untouched-ungrounded ⇒ `unverified`).
  - **Pin:** the submit (`certSetupControllerCreate`) handles the contract's error states — `409` (certification code already exists) and `422` (domain weights must sum to 100, validated server-side by `validateDomainWeights`) — by surfacing the error and keeping the reviewed fields editable. Because grounded `domains` may be partial/unverified, the UI validates the weight sum before enabling submit to avoid a guaranteed `422`.
- **Re-verification diff is client-composed.** No server diff endpoint; read the current cert (`certificationsControllerDetail`), re-extract, diff in the component, submit `certSetupControllerReverify`. `certificationsControllerDetail` filters to `state: 'live'`, which is fine here: certs surfaced by `due-for-reverification` are already live (their aged `verifiedAt` is what makes them due), so Detail resolves them. Alternative: a backend diff endpoint — rejected as out of scope (owned by `cert-setup-grounding`); recorded as a follow-up.
- **Source status derived from jobs.** `ContentSourceResponse` has no status/chunk fields; the pill is computed from `enabled` + the latest `IngestionJobStatus.state`; "Remove" = disable; registration is URL-only. Alternative: show only `enabled` — acceptable, but the jobs endpoint already gives a richer ingesting/error signal worth surfacing.
- **Typing via `@readion/shared`.** Admin controllers attach `@ApiResponse` DTOs, but several generated success types are weak; narrow at the page with `@readion/shared` types/schemas (`registerSourceRequestSchema`, `discoverSourcesRequestSchema`, `extractRequestSchema`, `createCertificationRequestSchema`, `reverifyCertificationRequestSchema`, `DiscoverSourcesResponse`, `ExtractionStatusResponse`, `ContentSourceResponse`, `IngestionJobStatus`, `DueForReverificationItem`). Alternative: `yarn codegen` — would not improve types without backend changes and is unnecessary.

## Risks / Trade-offs

- [Quarantine review is a SPEC-listed admin surface with no backend] → Ship an honest placeholder + a clearly-recorded backend follow-up (persisted quarantine store + admin list/review/resolve endpoints), rather than fabricate a queue.
- [No draft-cert listing] → The setup wizard is linear and keeps the created cert id in flow state for the coverage view; re-entry to an in-progress draft is a flagged follow-up.
- [Re-verify diff is client-side] → Correctly composed from the current live cert + a fresh extraction; flagged for a future server-computed diff. The write itself (`reverify`) is fully backed.
- [Weakly-typed admin client methods] → Mitigated by narrowing through `@readion/shared`, matching the established `web-settings`/onboarding pattern.

## Open Questions

- None blocking. Backend follow-ups recorded (out of scope here): (1) a persisted quarantine store + admin list/review/resolve endpoints so the Review queue can be built; (2) admin listing/detail of `draft` certs; (3) content-source chunk-count/status fields, job-cancel, and delete; (4) a dedicated source file-upload path; (5) a server-computed re-verification diff; (6) user search/last-active and an admin delete, plus actor resolution + CSV export on the audit log.
