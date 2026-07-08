## Purpose

Specifies the web admin console for Readion: an authenticated, role-gated admin shell (`AdminSidebar`) exposing five sections — Certifications, Review queue, Sources, Users, and Audit Log — plus a link to the existing Settings page. Covers user role management, audit log browsing, content source lifecycle, the certification setup flow (source discovery, grounded per-field extraction, draft creation), certification re-verification, and a quarantine review queue placeholder.
## Requirements
### Requirement: Admin console shell gated to admins

The web app SHALL provide an authenticated admin console rendered inside a dedicated admin shell (the `AdminSidebar` chrome) that is the sole navigation for the admin area — it SHALL NOT be nested inside the standard learner (study) app shell, so no second/duplicate nav is rendered. The shell SHALL present the five admin sections `Certifications`, `Review queue`, `Sources`, `Users`, and `Audit Log`, plus a `Settings` nav item that links out to the existing `/settings` page (from `web-settings`). The chrome SHALL include an `ADMIN` eyebrow, a per-item leading icon on each nav item, a numeric badge on the `Review queue` item showing the count of pending quarantined items, and an "Admin session" identity card showing the signed-in admin's email. Every admin route SHALL require authentication AND the `admin` role; a signed-in non-admin SHALL be redirected away by a role-aware admin route middleware, and an unauthenticated visitor SHALL be redirected to login. The bare `/admin` index SHALL redirect to (or render) the `/admin/certifications` landing rather than an empty stub. Role is read from the profile (`GET /api/v1/users/me` returns `role`), exposed on the auth store's `AuthUser`.

#### Scenario: Admin opens the console

- **WHEN** a signed-in user whose `role` is `admin` navigates to an admin route (e.g. `/admin/users`)
- **THEN** the admin shell renders with the `AdminSidebar` and the active section highlighted
- **AND** the sidebar shows the `ADMIN` eyebrow, per-item icons, and an Admin-session card with the admin's email
- **AND** no second learner/study navigation is rendered around the admin content

#### Scenario: Review-queue badge reflects the pending count

- **WHEN** the admin console loads and the quarantine queue has pending items
- **THEN** the `Review queue` nav item shows a numeric badge equal to the pending-item count

#### Scenario: Admin index redirects to the certifications landing

- **WHEN** an admin navigates to `/admin`
- **THEN** they are redirected to (or shown) the `/admin/certifications` landing, not an empty stub

#### Scenario: Non-admin is blocked

- **WHEN** a signed-in user whose `role` is `user` requests an admin route
- **THEN** the admin route middleware redirects them away from the admin area (they do not see admin content)

#### Scenario: Unauthenticated visitor is redirected

- **WHEN** an unauthenticated visitor requests an admin route
- **THEN** they are redirected to the login route

### Requirement: User management lists users and changes roles

The Users section SHALL list users via `GET /api/v1/admin/users` (paginated `{ data[], meta }`) and SHALL render the list paginated, showing a pagination control and advancing pages when `meta` reports more than one page. Each row SHALL render the user's `Name`, email, a capitalized and color-coded role badge (`Admin` / `User`), `Last active` timestamp, join date (`createdAt`), and a `Certs` (enrollment) count; the `Name` and `Last active` columns render the corresponding contract fields when present and a graceful placeholder (e.g. `—`) otherwise. The section SHALL render a header-utility row containing a search field, an `Invite user` action, and a `N users · M admins` summary. The Actions cell SHALL render a single contextual role-toggle — `Promote` for a `user`-role row (`POST /api/v1/admin/users/:id/promote`) or `Demote` for an `admin`-role row (`POST /api/v1/admin/users/:id/demote`) — plus a red `Remove` action, refreshing the list on success. A demote that the API rejects with `409` (last active admin) SHALL surface an error and leave roles unchanged. The `Invite user`, `Remove`, `Name`, and `Last active` affordances depend on additive admin-users contract fields/endpoints (`name`, `lastActiveAt`, invite, remove); until those exist the affordance renders in a disabled/placeholder state rather than fabricating data or calling a non-existent endpoint.

#### Scenario: User list renders paginated with the design columns

- **WHEN** `GET /api/v1/admin/users` returns users and `meta` reports more than one page
- **THEN** the table shows each user's Name, email, a capitalized role badge, Last active, join date, and a `Certs` count
- **AND** a pagination control is rendered and advancing it requests the next page

#### Scenario: Header-utility row renders search, invite, and counts

- **WHEN** the Users section renders
- **THEN** a header row shows a search field, an `Invite user` action, and a `N users · M admins` summary

#### Scenario: Contextual role action per row

- **WHEN** a row's role is `user`
- **THEN** a single `Promote` action is shown (not both Promote and Demote), alongside a red `Remove`
- **WHEN** a row's role is `admin`
- **THEN** a single `Demote` action is shown, alongside a red `Remove`

#### Scenario: Promote a user

- **WHEN** the admin clicks Promote on a `user`-role row
- **THEN** `POST /api/v1/admin/users/:id/promote` is called and on success the user's role badge becomes `Admin`

#### Scenario: Demoting the last admin is blocked

- **WHEN** the admin demotes a user and the API returns `409`
- **THEN** an error is surfaced and the user's role badge remains `Admin`

### Requirement: Audit log is read-only and append-only

The Audit Log section SHALL render entries from `GET /api/v1/admin/audit-logs` (paginated) as a read-only table, showing a pagination control and advancing pages when `meta` reports more than one page. Each row SHALL render the entry's action, a human-readable target (`targetLabel`, e.g. an email or a source/certification title — not `targetType · <uuid>`), human-readable Before/After values (scalar diffs such as `draft → live` or `user → admin`, not raw `JSON.stringify` output), the timestamp (`createdAt`), and the actor as `actorEmail`. When `actorEmail` is `null` (a hard-purged or system actor) the actor cell SHALL render a `System`/`—` fallback rather than a raw UUID. The section SHALL NOT offer create/edit/delete or CSV export.

#### Scenario: Audit entries render human-readable and read-only

- **WHEN** `GET /api/v1/admin/audit-logs` returns entries with `{ action, targetType, targetId, targetLabel, before, after, createdAt, userId, actorEmail }`
- **THEN** each row renders the action, the `targetLabel`, a scalar `before → after` diff, the timestamp, and `actorEmail`
- **AND** no row renders a raw UUID actor, a `type · <uuid>` target, or raw JSON braces in Before/After
- **AND** no row offers an edit or delete control

#### Scenario: Purged/system actor renders a fallback label

- **WHEN** an entry's `actorEmail` is `null`
- **THEN** the actor cell renders a `System`/`—` fallback (not a raw `userId`)

#### Scenario: Audit table paginates

- **WHEN** the audit-logs `meta` reports more than one page
- **THEN** a pagination control is rendered and advancing it requests the next page

### Requirement: Content source management per certification

The Sources section SHALL let the admin select a certification via certification **pills** (not a `<select>` dropdown) and list that certification's content sources via `GET /api/v1/admin/content-sources?certificationId=`. Source registration SHALL sit behind a dashed `Add source` affordance (revealing the registration form on demand) rather than an always-visible inline form; registration posts `POST /api/v1/admin/content-sources` with `{ certificationId, type, url }` (validated by `registerSourceRequestSchema`). The admin SHALL enable/disable a source (`POST :id/enable` / `POST :id/disable`) and trigger a manual re-ingest (`POST :id/reingest`, returns `202` + `jobId`). The table SHALL render an `Enabled` toggle (reflecting `enabled`), a `Last ingested` column, and a `Chunks` column, plus a status pill and a running-jobs banner derived from `GET /api/v1/admin/content-sources/:id/jobs` (and `:id/jobs/:jobId`). `Last ingested` and `Chunks` render the corresponding read-model fields when present and a graceful placeholder otherwise (the `Chunks` count depends on the content-source contract exposing it). When **no** certification is selected the section SHALL render an empty state ("Select a certification to view its sources") rather than floating column headers over a blank body. Sources are registered by URL (no file upload) and labelled by url/type; "Remove" maps to disable (no delete endpoint).

#### Scenario: Certification is selected via pills with an empty state fallback

- **WHEN** the admin opens the Sources section with no certification selected
- **THEN** an empty state ("Select a certification to view its sources") is shown instead of floating headers over a blank body
- **WHEN** the admin selects a certification pill
- **THEN** `GET /api/v1/admin/content-sources?certificationId=<id>` is called and the sources table renders

#### Scenario: Sources list shows enabled / last-ingested / chunks

- **WHEN** a certification's sources are returned
- **THEN** the table renders each source's url/type, an `Enabled` toggle reflecting `enabled`, a `Last ingested` value, a `Chunks` value, a status pill, and Re-ingest / Remove actions

#### Scenario: Register a source via the Add source affordance

- **WHEN** the admin activates the dashed `Add source` affordance and submits a valid `type` and `url`
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

### Requirement: Admin review queue

The `web-admin` console's Review queue section SHALL render the real quarantined-item list from `GET /api/v1/admin/quarantine` (paginated, filterable by certification/status) as a **two-pane master-detail reviewer**: a selectable item list on the left and a detail panel on the right for the selected item. The section header SHALL show a `N items awaiting review` count of pending items, and SHALL render certification **filter chips** that filter the list by certification. Each list row SHALL show a mono item id, a certification badge, the item's domain, and a formatted flag/verdict badge (not raw JSON). When an item is selected, the detail panel SHALL load that item via `GET /api/v1/admin/quarantine/:id` and render the item's **question, options, and answer key** (the option matching the answer key marked as the stored correct answer) together with a **human-formatted verdict** — a pass/fail label, the verdict score as a percentage, and the reason — instead of the raw verdict string. When the detail's mapped `content` is absent (`null`, for older or non-quiz rows), the panel SHALL render a graceful "no structured content" state while still showing the verdict, reason, and provenance. The panel SHALL offer **Approve** and **Reject** actions (the preserved audit-log vocabulary, not the artboard's "Edit key/Discard") wired to `POST /admin/quarantine/:id/approve` and `.../reject`; on success the item SHALL be removed from the pending list and the panel SHALL return to its empty state. Until an item is selected, the panel SHALL show an empty prompt; while the detail loads it SHALL show a loading state.

#### Scenario: Header shows the pending count and certification filter chips

- **WHEN** the admin opens the Review queue with pending items across certifications
- **THEN** the header shows a `N items awaiting review` count
- **AND** certification filter chips are rendered and selecting one filters the list to that certification

#### Scenario: List rows show rich metadata

- **WHEN** the pending list renders
- **THEN** each row shows a mono item id, a certification badge, the domain, and a formatted flag/verdict badge (no raw JSON)

#### Scenario: Selecting a queue item opens the detail reviewer

- **WHEN** an admin opens the Review queue and selects a pending quarantined item
- **THEN** the item list highlights the selection and the detail panel loads the item via `GET /api/v1/admin/quarantine/:id`
- **AND** the panel renders the question, its options with the answer-key option marked, and a formatted verdict (pass/fail label + score % + reason) with no raw JSON

#### Scenario: Approve/Reject resolves the selected item

- **WHEN** the admin activates Approve or Reject in the detail panel
- **THEN** the corresponding `POST /admin/quarantine/:id/approve` or `.../reject` endpoint is called
- **AND** on success the item is removed from the pending list and the detail panel returns to its empty state

#### Scenario: Item without structured content degrades gracefully

- **WHEN** the selected item's detail returns `content: null` (an older row or a non-quiz domain)
- **THEN** the detail panel shows a "no structured content" state and still renders the formatted verdict, reason, and provenance without error

#### Scenario: No item selected

- **WHEN** the admin has not selected any queue item
- **THEN** the detail panel shows an empty prompt to select an item and no detail request is made

### Requirement: Certifications section lists existing certifications

The Certifications section SHALL list the existing certifications (via the certifications list endpoint used elsewhere in the admin console), each row linking to its detail/setup, in addition to the existing "Due for re-verification" section — so the certifications landing is not an empty "Due for re-verification" stub. When no certifications exist yet, the section SHALL render an empty state.

#### Scenario: Existing certifications are listed

- **WHEN** an admin opens `/admin/certifications` and certifications exist
- **THEN** each existing certification is listed with its name and code, linking to its detail/setup
- **AND** the "Due for re-verification" section is still shown

#### Scenario: No certifications yet

- **WHEN** an admin opens `/admin/certifications` and no certifications exist
- **THEN** an empty state is shown instead of an empty stub

### Requirement: Certification setup wizard chrome

The new-certification setup flow SHALL be wrapped in the design's `SetupHeader` chrome: a breadcrumb, a `Step N of 4 · <step name>` indicator with a progress bar reflecting the current step, and a Cancel affordance that exits the wizard. The step index, label, and progress SHALL be derived from the existing wizard state (source discovery → grounded extraction/review → coverage), not hard-coded separately. The chrome is presentational and SHALL NOT alter the underlying discovery/extraction/draft-creation contracts.

#### Scenario: Wizard shows breadcrumb, step indicator, and progress

- **WHEN** an admin is on the source-discovery step of the new-certification flow
- **THEN** a `SetupHeader` renders a breadcrumb, a `Step 1 of 4 · <step name>` indicator, and a progress bar at the first step

#### Scenario: Progress advances with the step

- **WHEN** the admin advances from source discovery to extraction review
- **THEN** the step indicator and progress bar advance to reflect the new step

#### Scenario: Cancel exits the wizard

- **WHEN** the admin activates Cancel in the setup header
- **THEN** the wizard flow is exited (returning to the certifications landing) without creating a draft

