## Why

A full UI walkthrough of the admin console against the design mockups (`openspec/design/AdminContentUsers.html`, `AdminCertSetup.html`, `App Shell.html`) surfaced one HIGH readability defect and a cluster of shell-chrome, scalability, and cert-setup fidelity gaps:

- **HIGH — Audit Log is unreadable.** Every row renders raw identifiers instead of the human values the design shows. The actor is a raw user UUID (design: `jamie@org.io`), the target is `content_chunk · <uuid>` / `certification · <uuid>` (design: `alex@org.io`, `AWS whitepapers (SAA-C03)`), and Before/After render raw JSON `{"state":"draft"}→{"state":"live"}` (design: `draft → live`, `user → admin`). An admin cannot tell who did what to whom. The current `audit-log` capability response only carries `userId`/`targetType`/`targetId`/`before`/`after`, so the API cannot be rendered human-readably without exposing resolvable identity — hence a matching `audit-log` contract delta.
- **Shell chrome not adopted.** The admin area nests a plain text nav inside the normal STUDY app shell (`AdminConsole.vue`), producing two stacked navs and no admin branding — even though the `web-admin` spec already specifies the dedicated `AdminSidebar` chrome. The app does not match its own spec.
- **Tables do not scale.** Users and Audit Log render every row in one unpaginated scroll (a real problem at hundreds of rows). Sources shows floating column headers over a blank body with no empty state when no certification is selected.
- **Cert-setup wizard fidelity.** The new-certification flow is two bare fields + a "Discover sources" button with no `SetupHeader` breadcrumb, `Step N of 4` indicator, progress bar, or Cancel — versus the design's 4-step wizard.
- **Certifications index is empty.** `/admin/certifications` shows only a "Due for re-verification" section and never lists existing certifications; `/admin` is an empty stub rather than the certifications landing.

## What Changes

- **`audit-log` contract:** `GET /api/v1/admin/audit-logs` entries additionally expose `actorEmail` (the resolved actor email, `null` when the actor was hard-purged or the action is system-originated) and `targetLabel` (a human-readable label for the target, e.g. the affected user's email or a source/certification title), so the console can render identity without the web layer resolving UUIDs. `userId` is retained for the purge invariant.
- **Audit Log rendering (`web-admin`):** render `actorEmail` (falling back to a `System`/`—` label when null), `targetLabel`, and human-readable Before/After values (scalar diffs like `draft → live`, not raw JSON), and paginate the table.
- **Admin shell (`web-admin`):** adopt the dedicated `AdminSidebar` chrome as the sole admin nav — orange `ADMIN` eyebrow, per-item icons, a Review-queue badge showing the pending-item count, and an "Admin session" identity card with the signed-in admin's email — not nested inside the study app shell. `/admin` redirects to (or renders) the `/admin/certifications` landing.
- **Users (`web-admin`):** paginate the list; render a header-utility row (search field, Invite user, and a `N users · M admins` summary); rename the `Enrollments` column to `Certs`; render a `Name` column and a `Last active` column; capitalize and color the role badge (`Admin` / `User`); and replace the always-both `Promote`+`Demote` pair with a single contextual role-toggle plus a red `Remove`. `Name`, `Last active`, `Invite`, and `Remove` depend on additive admin-users contract fields/endpoints (`name`, `lastActiveAt`, invite, remove) — see Impact.
- **Sources (`web-admin`):** select the certification via cert pills (not a dropdown); move source registration behind a dashed "Add source" affordance (not an always-visible inline form); add `Enabled` toggle, `Last ingested`, and `Chunks` columns; and render a "Select a certification to view its sources" empty state when none is selected. The `Chunks` column depends on the content-source contract exposing a chunk count — see Impact.
- **Review queue (`web-admin`):** add an `N items awaiting review` count in the header, certification filter chips, and richer list-row metadata (mono item id, certification badge, flag/verdict badges).
- **Certifications (`web-admin`):** the certifications section lists existing certifications (not only the due-for-re-verification section), each linking to its detail/setup.
- **Cert setup wizard (`web-admin`):** wrap the new-certification flow in the design's `SetupHeader` chrome — a breadcrumb, a `Step N of 4 · <step name>` indicator with a progress bar, and a Cancel affordance — spanning the existing source-discovery → extraction → coverage steps.

## Capabilities

### Modified Capabilities

- `web-admin`: adopt the `AdminSidebar` shell chrome (eyebrow, icons, review-queue badge, admin-session card) and `/admin` redirect; render the Audit Log with human-readable actor/target/before-after; paginate Users and Audit; add Users header-utility row + Name/Last active/Certs columns + contextual role actions + role-badge styling; Sources cert-pills + add-source affordance + Enabled/Last-ingested/Chunks columns + empty state; Review-queue count + filter chips + rich list metadata; list existing certifications; add the cert-setup wizard chrome.
- `audit-log`: `GET /api/v1/admin/audit-logs` entries expose `actorEmail` (nullable) and `targetLabel` alongside the existing fields so the console can render human-readable identity.

## Impact

- **Affected specs:** `openspec/specs/web-admin/spec.md` (shell, users, audit, sources, review queue, certifications, cert-setup), `openspec/specs/audit-log/spec.md` (audit response fields).
- **Affected web components (implementation, out of scope for this proposal):** `apps/web/app/components/admin/AdminConsole.vue`, `AdminAuditLog.vue`, `AdminUsers.vue`, `AdminSources.vue`, `AdminReviewQueue.vue`/`AdminReviewQueueList.vue`, `AdminCertifications.vue`, `CertSetupWizard.vue`, and the `useAdmin*` composables + `~~/src/api` generated client.
- **Affected API (implementation):** the admin audit-logs read model must join/resolve `actorEmail` and compute `targetLabel`; shared `AuditLogEntry` type in `packages/shared` gains `actorEmail`/`targetLabel`.
- **Contract dependencies flagged for follow-up (not delivered by the rendering alone):** the admin-users list exposing `name` and `lastActiveAt`, and `Invite user` / admin `Remove` endpoints; the content-source read model exposing a per-source chunk count and last-ingested timestamp. Where these are absent, the corresponding column/action renders a graceful placeholder rather than fabricating data.
- **Downstream:** regenerate the Orval client (`yarn codegen`) after the audit-logs response and any admin-users field additions land.
