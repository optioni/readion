## Purpose

Specifies the web admin console for Readion: an authenticated, role-gated admin shell (`AdminSidebar`) exposing five sections — Certifications, Review queue, Sources, Users, and Audit Log — plus a link to the existing Settings page. Covers user role management, audit log browsing, content source lifecycle, the certification setup flow (source discovery, grounded per-field extraction, draft creation), certification re-verification, and a quarantine review queue placeholder.

## Requirements

### Requirement: Admin console shell gated to admins

The web app SHALL provide an authenticated admin console rendered inside an admin shell (the `AdminSidebar` chrome) with the five admin sections `Certifications`, `Review queue`, `Sources`, `Users`, and `Audit Log`, plus a `Settings` nav item that links out to the existing `/settings` page (from `web-settings`). Every admin route SHALL require authentication AND the `admin` role; a signed-in non-admin SHALL be redirected away by a role-aware admin route middleware, and an unauthenticated visitor SHALL be redirected to login. Role is read from the profile (`GET /api/v1/users/me` returns `role`), exposed on the auth store's `AuthUser`.

#### Scenario: Admin opens the console

- **WHEN** a signed-in user whose `role` is `admin` navigates to an admin route (e.g. `/admin/users`)
- **THEN** the admin shell renders with the `AdminSidebar` and the active section highlighted

#### Scenario: Non-admin is blocked

- **WHEN** a signed-in user whose `role` is `user` requests an admin route
- **THEN** the admin route middleware redirects them away from the admin area (they do not see admin content)

#### Scenario: Unauthenticated visitor is redirected

- **WHEN** an unauthenticated visitor requests an admin route
- **THEN** they are redirected to the login route

### Requirement: User management lists users and changes roles

The Users section SHALL list users via `GET /api/v1/admin/users` (paginated `{ data[], meta }`), rendering each user's email, role, email-verified state, join date (`createdAt`), and enrollment count. It SHALL promote a non-admin via `POST /api/v1/admin/users/:id/promote` and demote an admin via `POST /api/v1/admin/users/:id/demote`, refreshing the list on success. A demote that the API rejects with `409` (last active admin) SHALL surface an error and leave roles unchanged. Because the contract exposes no user `name`, last-active timestamp, search, invite, or admin delete, the section SHALL NOT render those controls (the avatar is derived initials from the email).

#### Scenario: User list renders from the contract

- **WHEN** `GET /api/v1/admin/users` returns users with `{ email, role, emailVerified, createdAt, enrollmentCount }`
- **THEN** the table shows each user's email, a role badge, the join date, and the enrollment count
- **THEN** no "Last active", search, "Invite user", or delete-user control is rendered

#### Scenario: Promote a user

- **WHEN** the admin clicks Promote on a `user`-role row
- **THEN** `POST /api/v1/admin/users/:id/promote` is called and on success the user's role badge becomes `Admin`

#### Scenario: Demoting the last admin is blocked

- **WHEN** the admin demotes a user and the API returns `409`
- **THEN** an error is surfaced and the user's role badge remains `Admin`

### Requirement: Audit log is read-only and append-only

The Audit Log section SHALL render entries from `GET /api/v1/admin/audit-logs` (paginated) as a read-only table showing each entry's action, target (`targetType`/`targetId`), before/after snapshot, timestamp (`createdAt`), and actor as the recorded `userId`. The section SHALL NOT offer create/edit/delete or CSV export, and SHALL NOT claim to resolve `userId` to an email (the `AuditLog` is stored stripped of direct identifiers).

#### Scenario: Audit entries render read-only

- **WHEN** `GET /api/v1/admin/audit-logs` returns entries with `{ action, targetType, targetId, before, after, createdAt, userId }`
- **THEN** the table renders each entry's action, target, before/after, timestamp, and the `userId` actor
- **THEN** no row offers an edit or delete control

### Requirement: Content source management per certification

The Sources section SHALL list a certification's content sources via `GET /api/v1/admin/content-sources?certificationId=` and let the admin register a new source (`POST /api/v1/admin/content-sources` with `{ certificationId, type, url }`, validated by `registerSourceRequestSchema`), enable/disable a source (`POST :id/enable` / `POST :id/disable`), and trigger a manual re-ingest (`POST :id/reingest`, returns `202` + `jobId`). A status indicator and a running-jobs banner SHALL be derived from `GET /api/v1/admin/content-sources/:id/jobs` (and `:id/jobs/:jobId`). Because the contract registers sources by URL only and exposes no chunk count, no source name, no per-source status field, no job-cancel, and no delete, the section SHALL register by URL (not file upload), derive the status pill from the latest job state, omit chunk counts, label sources by url/type, and map "Remove" to disable.

#### Scenario: Sources list for a certification

- **WHEN** the admin selects a certification and `GET /api/v1/admin/content-sources?certificationId=<id>` returns its sources
- **THEN** the table renders each source's url/type, an enabled toggle reflecting `enabled`, and Re-ingest / disable actions

#### Scenario: Register a source by URL

- **WHEN** the admin adds a source with a valid `type` and `url`
- **THEN** `POST /api/v1/admin/content-sources` is called with `{ certificationId, type, url }` and on success the new source appears in the list
- **THEN** no file-upload control is offered (sources are registered by URL)

#### Scenario: Trigger a re-ingest and watch job status

- **WHEN** the admin triggers Re-ingest on an enabled source
- **THEN** `POST /api/v1/admin/content-sources/:id/reingest` is called and on `202` the returned job is reflected via the source's job status (`GET :id/jobs`)

#### Scenario: Disable maps to "Remove"

- **WHEN** the admin activates "Remove" on a source
- **THEN** `POST /api/v1/admin/content-sources/:id/disable` is called (no delete endpoint is invoked)

### Requirement: Certification setup — source discovery and confirmation

The Certifications setup flow SHALL let an admin enter a new cert name (and optional code) and discover candidate official-guide sources via `POST /api/v1/admin/certifications/discover-sources` (`{ name, code? }`), rendering the returned `candidates[]` (`url`, `title`, `snippet?`) for selection, plus a manual-URL entry. The admin SHALL confirm exactly one source URL before extraction. Because the response carries no per-candidate confidence score, the UI SHALL NOT display a confidence badge.

#### Scenario: Candidates are listed for confirmation

- **WHEN** `POST /api/v1/admin/certifications/discover-sources` returns `candidates` with `{ url, title, snippet? }`
- **THEN** each candidate is rendered selectable with its title and url, alongside a manual-URL input
- **THEN** the admin can confirm one source url to proceed to extraction

### Requirement: Certification setup — grounded per-field extraction with citations

After source confirmation the flow SHALL request extraction via `POST /api/v1/admin/certifications/extract` (`{ name, code?, confirmedSourceUrl }`, returns `202` + `jobId`) and poll `GET /api/v1/admin/certifications/extractions/:jobId` until `fields` is present. It SHALL present each of the four grounded fields — `domains`, `questionCount`, `passingScore`, `timeLimitMinutes` — next to its cited source passage when the field is `{ value, citation }`, and SHALL mark a field "unverified — confirm manually" when it is `{ unverified: true }`. Per-field "Confirm" / "Flag as uncertain" SHALL be client-side review state. The admin SHALL also supply the non-extractable identity fields `name`, `provider`, and `code`. The UI SHALL NOT invent metadata fields that the contract does not extract (e.g. cost, prerequisite, validity, certifying body).

#### Scenario: Grounded field shows its citation

- **WHEN** polling returns `fields.passingScore = { value: 67, citation: { url, passage } }`
- **THEN** the passing-score field renders the value next to its cited source passage and url

#### Scenario: Ungrounded field is flagged unverified

- **WHEN** polling returns `fields.questionCount = { unverified: true }`
- **THEN** the question-count field is shown with an "unverified — confirm manually" state

### Requirement: Certification setup — draft creation without manual publish

The setup flow SHALL submit the reviewed certification via `POST /api/v1/admin/certifications` with `{ name, provider, code, domains, questionCount, passingScore, timeLimitMinutes, provenance, sourceUrl }`, building the `provenance` map so each field is `{ url, passage }` (grounded), `{ unverified: true }` (still ungrounded), or `{ manuallyConfirmed: true }` (admin-edited). The cert is created in `draft` state. The flow SHALL show per-domain go-live coverage read-only via `GET /api/v1/certifications/:id/coverage` and SHALL NOT render a "Publish" button or an "admin sign-off" gate — draft → live is automatic once the coverage bar is met.

#### Scenario: Submitting creates a draft with provenance

- **WHEN** the admin confirms the reviewed fields and submits
- **THEN** `POST /api/v1/admin/certifications` is called with the four format fields plus a `provenance` map and `sourceUrl`, and the cert is created in `draft` state
- **THEN** no "Publish certification" button is presented (go-live is automatic at the coverage bar)

#### Scenario: Coverage is shown read-only

- **WHEN** the setup flow displays go-live progress for the cert
- **THEN** it reads `GET /api/v1/certifications/:id/coverage` and renders per-domain coverage against the go-live threshold without a manual publish action

#### Scenario: Submission surfaces contract validation errors

- **WHEN** `POST /api/v1/admin/certifications` returns `409` (certification code already exists) or `422` (domain weights must sum to 100)
- **THEN** the submit step surfaces the corresponding error and keeps the reviewed fields editable so the admin can correct the code or domain weights and resubmit

### Requirement: Certification re-verification of stale metadata

The Certifications area SHALL list certs flagged "due for re-verification" via `GET /api/v1/admin/certifications/due-for-reverification` and let the admin re-verify one. Re-verification SHALL re-run source discovery/extraction, present the proposed values diffed client-side against the current live cert (`GET /api/v1/certifications/:id`), and submit `POST /api/v1/admin/certifications/:id/reverify` with `{ confirmedSourceUrl, domains, questionCount, passingScore, timeLimitMinutes, provenance }`. Because no server-computed diff endpoint exists, the diff SHALL be composed on the client.

#### Scenario: Due-for-reverification list

- **WHEN** `GET /api/v1/admin/certifications/due-for-reverification` returns certs with `{ id, name, code, verifiedAt, dueForReverification }`
- **THEN** each stale cert is listed with a re-verify entry point

#### Scenario: Submitting re-verification

- **WHEN** the admin reviews the proposed metadata for a stale cert and confirms
- **THEN** `POST /api/v1/admin/certifications/:id/reverify` is called with the confirmed source url, the format fields, and a `provenance` map

### Requirement: Quarantine review queue placeholder

The Review queue section SHALL be presented honestly against the contract: because no endpoint lists, reads, or resolves quarantined items (the quarantine path only evicts the LLM cache and increments a metric; only `POST /api/v1/quiz/:questionId/report` feeds it), the section SHALL render a clearly worded "not yet available" placeholder and SHALL NOT call any non-existent quarantine endpoint or display a fabricated review queue, verdict, or item count.

#### Scenario: Review queue shows a placeholder, not fabricated data

- **WHEN** the admin opens the Review queue section
- **THEN** a placeholder explains that quarantined-item review is not yet available
- **THEN** the page issues no request to any quarantine list/review/resolve endpoint and renders no fabricated items, verdicts, or badge count
