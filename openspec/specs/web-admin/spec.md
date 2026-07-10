## Purpose

Specifies the web admin console for Readion: an authenticated, role-gated admin shell (`AdminSidebar`) exposing five sections — Certifications, Review queue, Sources, Users, and Audit Log — plus a link to the existing Settings page. Covers user role management, audit log browsing, content source lifecycle, the certification setup flow (source discovery, grounded per-field extraction, draft creation), certification re-verification, and a quarantine review queue placeholder.
## Requirements
### Requirement: Admin console shell gated to admins

The admin console SHALL be gated to admins and present each screen with the shared admin chrome from `admin-content.jsx`: a distinct **bordered header bar** (elevated background, bottom border) housing the screen title, separated from the scrollable content region below it, and data tables wrapped in **surface cards** (bordered, rounded, with an elevated uppercase header row) rather than bare `<table>` elements. Loading states SHALL show a spinner, and error states SHALL show an inline **Retry** action, consistently across admin screens.

#### Scenario: Admin screens use the shared header bar and card chrome

- **WHEN** any admin screen renders
- **THEN** its title sits in a bordered header bar and its tables are wrapped in surface cards
- **AND** loading shows a spinner and errors show a Retry action

### Requirement: User management lists users and changes roles

User management SHALL list users and change roles, with the user **search input wired to client-side filtering** of the loaded list, the Admin role badge in an **amber/warning** color (distinct from the primary blue), the email column labeled "Email", and the design's toolbar order (summary left; search + Invite right) and avatar styling. The `name` and `last active` columns, and the Remove and Invite flows, are **descoped** to `admin-user-management-contract` (no name/last-active field; no wired remove/invite endpoints).

#### Scenario: User search filters the loaded list

- **WHEN** the admin types in the user search box
- **THEN** the loaded user list filters client-side
- **AND** the Admin role badge renders in the amber/warning color and the email column is labeled "Email"

### Requirement: Audit log is read-only and append-only

The audit log SHALL render read-only and append-only with the six-column order **Timestamp · Actor · Action · Target · Before · After** (Before/After as separate monospace cells, not a merged "Change" string), a caption row stating "Append-only · read-only · ★ = privileged action", relative monospace timestamps ("Today 14:32"), the shared table + header-bar chrome, and italic/muted styling for `system` actors. Pagination is retained (a real need beyond the single-page artboard). The `privileged` star marker and CSV export are **descoped** to `audit-log-privileged-and-export` (no `privileged` field; no export endpoint).

#### Scenario: Audit log shows separate Before/After columns with the caption

- **WHEN** the audit log renders
- **THEN** Before and After are separate monospace columns in the six-column order with the append-only/★ caption
- **AND** timestamps are relative mono and system actors render italic/muted, with pagination retained

### Requirement: Content source management per certification

Content source management SHALL render the running-ingestion banner from the existing `progress` field — a spinner, the job name, live percentage, and ETA — while a job is in flight (not a static text line). Status pills SHALL use per-state tinted background + border colors, last-ingested SHALL show a relative timestamp ("2h ago", "—" when never), the Type value SHALL render as a bordered badge, and chunk counts SHALL be comma-grouped in mono. The cancel-job action and a human-readable source display name are **descoped** to `source-ingestion-cancel-and-naming`.

#### Scenario: Running-ingestion banner shows live progress

- **WHEN** an ingestion job is in flight
- **THEN** the banner shows a spinner, the job name, live percentage, and ETA from the `progress` field
- **AND** status pills are per-state color-coded and last-ingested is relative

### Requirement: Certification setup — source discovery and confirmation

Certification setup SHALL present a **5-step** wizard whose first step is a standalone **"Identify certification"** screen collecting the certification name, a required monospace **exam code** (with the hint "Shown across the app and used to de-duplicate."), the **certifying body** (wired to `identity.provider`), and an optional **known source URL** supplied upfront. An intro paragraph and a "what happens next" explainer callout SHALL precede/follow the fields. "Search for sources →" SHALL advance to a **separate** source-confirmation step showing the agent-status banner and ranked candidate cards; no certification metadata is created until a source is confirmed there.

#### Scenario: Identify step is distinct and collects the certifying body

- **WHEN** the cert-setup wizard opens
- **THEN** step 1 is a standalone "Identify certification" screen with name, required code, certifying body, and optional known-URL fields
- **AND** "Search for sources →" advances to a separate source-confirmation step (5 steps total)

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

Certification re-verification SHALL be reachable at a **dedicated route** `/admin/certifications/:code/re-verify` rendering a full-height screen for one certification: a stale header (breadcrumb with the code, the cert display name, and a warning "Metadata stale · action required" pill), and a diff table whose **changed rows render the old value strikethrough-red and the new value bold-green** with "Current (outdated)" / "Proposed (new guide)" column headers. The reverify diff SHALL NOT show the field-extraction "(unverified)" annotation (that concept belongs to the extraction step). Per-field Accept, validity-period/exam-version rows, the save-vs-verify two-step, and the stale-reason narrative are **descoped** to a separate contract change (the current schema does not carry them).

#### Scenario: Dedicated re-verify screen with colored diff

- **WHEN** an admin opens a certification's re-verify route
- **THEN** a full-height screen renders with the stale header/pill and a diff coloring changed old values strikethrough-red and new values bold-green

### Requirement: Admin review queue

The admin review queue SHALL render as a full-height split shell (quarantined list + detail). The list panel SHALL carry a "Quarantined items" label with the cert filter chips scoped inside it, and each row SHALL show a 2-line snippet of the **question text** (not the domain tag) with relative dates. The detail pane SHALL render a **source-evidence card** built from the already-fetched `supportingSpans` — a quoted excerpt with the relevant phrase highlighted, a source reference, and a link — instead of raw chunk IDs, and the decision title SHALL carry a warning icon. The verdict taxonomy, flag-type badge + report count, the recommended-fix ("edit key") action, and the per-source-correct distinction are **descoped** to `enrich-review-queue-contract` (the shared types do not carry them).

#### Scenario: Source evidence renders from existing spans

- **WHEN** a quarantined item's detail pane renders
- **THEN** the source-evidence card shows the quoted `supportingSpans` excerpt with the phrase highlighted and a link, not raw chunk IDs
- **AND** the list row shows the question-text snippet with a relative date

### Requirement: Certifications section lists existing certifications

The Certifications section SHALL list existing certifications under an uppercase "EXISTING CERTIFICATIONS" section label with an active-count badge (e.g. "3 active") and a header subtitle ("Manage certifications and keep their metadata verified against source."). Exam codes SHALL render as monospace code chips, the primary action SHALL carry a "+" icon, the error state SHALL show a Retry, and the loading state a spinner. When re-verifying, the diff SHALL render as a **centered modal overlay** (backdrop, blocks the list) — not an inline section appended to the page — and its submit button SHALL show a spinner + "Re-verifying…" label while submitting, with any error scoped inside the modal footer.

#### Scenario: Re-verify opens a modal overlay

- **WHEN** the admin clicks Re-verify on a certification
- **THEN** the proposed-changes diff opens as a centered modal overlay over a dimmed list
- **AND** submitting shows a spinner + "Re-verifying…" label, and a failure is shown in the modal footer

### Requirement: Certification setup wizard chrome

The cert-setup wizard chrome SHALL show a dynamic breadcrumb reflecting the entered cert code ("Certifications › New › {code}"), the step title in the persistent header bar (not an in-body `<h1>`), and pair Cancel + the primary CTA in a shared **bordered footer bar** at the bottom of a ~640px content column.

#### Scenario: Wizard chrome uses a bordered footer and dynamic breadcrumb

- **WHEN** a cert-setup step renders
- **THEN** Cancel and the primary CTA sit together in a bordered footer bar
- **AND** the breadcrumb reflects the entered cert code and the step title is in the header bar

