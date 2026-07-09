## Why

The parity diff compared the seven admin surfaces — Certifications list, Cert-setup wizard, Cert re-verification, Review queue, Sources, Users, Audit log — against `AdminCertifications.html`, `AdminCertSetup.html`, and `admin-content.jsx` (71 findings, all under the single `web-admin` capability). This is the largest domain, and — like Session summary — **a large share of the findings are blocked on data/endpoints the app doesn't have.** This change delivers the presentational fidelity fixes plus the cert-setup wizard restructure; the backend/contract-dependent clusters are enumerated and descoped to named follow-up changes. See `design.md` for the full table.

**Fidelity fixes (this change), common across screens:** wrap tables in the design's **surface cards** (bordered, rounded, elevated header row); add the shared **bordered header bar** the admin screens are missing; add **loading spinners**, **error Retry** buttons, and **submitting spinners/labels**; render **relative timestamps** ("2h ago", "Today 14:32") in mono where the design does; add **status/type/code chips** with per-state color coding; and use the design's section labels/captions and icons. Per screen:

- **Certifications list** — render the re-verify diff as a **centered modal overlay** (not an inline appended section); add the error Retry, the submitting spinner + "Re-verifying…" label, the "EXISTING CERTIFICATIONS · N active" section label + subtitle, table-shell cards, the code chip, the loading spinner, and the "+" icon.
- **Cert-setup wizard** — restructure to the design's **5-step flow** with a standalone **"Identify certification"** step (name / code / **certifying body** / optional known URL) that searches into a separate confirmation step; add the intro + "what happens next" explainer callouts; make the exam code a required mono field with its hint; move Cancel + primary CTA into a shared bordered footer; dynamic breadcrumb + header title; the ~640px content column. (This is the one **flow change**, not just CSS.)
- **Cert re-verification** — give it its **dedicated full-height route/screen** with the stale header (breadcrumb + cert title + "Metadata stale" pill); the changed-value color coding (strikethrough-red old / bold-green new) and colored column headers; remove the stray "(unverified)" annotation.
- **Review queue** — render the **source evidence card** from the already-fetched `supportingSpans` (quoted excerpt + highlight + link), show the **question snippet** (not the domain tag), full-height split shell, the "Quarantined items" label + in-panel filter chips, the decision warning icon, and relative dates.
- **Sources** — render the **running-ingestion banner from the existing `progress` field** (spinner + job name + % + ETA); per-state status-pill colors; relative "last ingested"; type badge; comma-grouped mono chunk counts.
- **Users** — wire the decorative **search** to client-side filtering of the loaded list; the amber **Admin role badge**; the "Email" column label; toolbar order; avatar styling.
- **Audit log** — split the merged "Change" cell into separate **Before / After columns** (six-column order); add the "Append-only · read-only · ★ = privileged action" caption; relative mono timestamps; table + header-bar chrome; italic/muted system-actor styling.

**Descoped to backend/contract follow-up changes (enumerated in `design.md`):** review-queue verdict taxonomy + flag-type/report-count + recommended-fix ("edit key") action + per-source-correct distinction; user `name` + `lastActive` fields + Remove + Invite flows; audit `privileged` flag + CSV export endpoint; source cancel-job action + display `name`; cert-reverify per-field Accept + validity-period/exam-version fields + save-vs-verify two-step + stale-reason narrative.

**Reaffirmed:** the audit-log **pagination** the app adds (a real need; the artboard just shows a single page).

## What Changes

- **web-admin** — table-shell cards + shared header bars + spinners/retry + relative timestamps + chips across all admin screens; the re-verify **modal** overlay; the cert-setup **5-step restructure** with a standalone identify step + certifying-body field + upfront known-URL; the cert-reverify **dedicated route** + stale header + diff color coding; render review-queue **source evidence** from `supportingSpans` + question snippet; sources **running-job progress** from the existing field; client-side **user search**; audit **Before/After columns** + caption. Backend-dependent enrichments are descoped.

## Capabilities

### Modified Capabilities

- `web-admin`: admin-wide table/card/header/loading/error/timestamp/chip fidelity; the re-verify modal; the cert-setup 5-step identify flow; the cert-reverify dedicated screen + diff color coding; review-queue evidence + snippet; sources live-progress banner; client-side user search; audit before/after columns + caption. (Data-carried taxonomies, extra fields, and new actions/exports are reaffirmed as descoped.)

## Impact

- **apps/web** — presentational + the cert-setup flow restructure + a new cert-reverify route:
  - `AdminCertifications.vue`, `AdminConsole.vue` (header bar / width), `AdminSources.vue`, `AdminUsers.vue`, `AdminAuditLog.vue`, `AdminReviewQueue*.vue`, the cert-setup step components + `useCertSetupWizard.ts` + `certSetupSteps.ts`, `SetupHeader.vue`, plus a new `pages/admin/certifications/[code]/re-verify.vue`, and shared admin primitives (table shell, header bar, status pill, chips, async message).
- **Reuses** the shared value→label map and relative-time helpers.
- **No API/DB changes in this change.** All data-carried and new-action items are descoped to the follow-up changes below.
- **Tests** — Playwright e2e per surface + component unit tests; no integration tests here.
- **Descoped (separate changes):** `enrich-review-queue-contract`, `admin-user-management-contract`, `audit-log-privileged-and-export`, `source-ingestion-cancel-and-naming`, `cert-reverify-per-field-and-schema`. **Reaffirmed:** audit-log pagination.
