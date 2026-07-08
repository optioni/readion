## Context

The admin console exists and is role-gated, but a full UI walkthrough against the design mockups exposed one HIGH readability defect plus a cluster of shell-chrome, scalability, and cert-setup fidelity gaps:

- **HIGH — Audit Log is unreadable.** `AdminAuditLog.vue` renders `entry.userId` (a raw UUID) as the actor, `targetType · targetId` (`content_chunk · <uuid>`) as the target, and `JSON.stringify(before/after)` (`{"state":"draft"}→{"state":"live"}`) as the change. The design shows the actor's email, a friendly target label, and scalar `draft → live` / `user → admin` values. The `audit-log` capability response only carries `userId`/`targetType`/`targetId`/`before`/`after`, so the web layer cannot resolve identity — the contract must expose it.
- **Shell chrome gap.** `AdminConsole.vue` renders a bare text nav (no `ADMIN` eyebrow, no per-item icons, no Review-queue badge, no Admin-session card) and is mounted inside the standard learner app shell, producing two stacked navs — even though the `web-admin` spec already specifies the dedicated `AdminSidebar` chrome. This is the app not matching its own spec.
- **Scale.** Users and Audit Log render every row unpaginated (`data ?? []`, no `meta` paging), a real problem at hundreds of rows. Sources shows floating column headers over a blank body with no empty state when no certification is selected.
- **Cert-setup fidelity.** `CertSetupWizard.vue` steps through discover → extraction → coverage but wraps them in no `SetupHeader` chrome (no breadcrumb, no `Step N of 4` indicator, no progress bar, no Cancel).
- **Certifications index.** `AdminCertifications.vue` renders only the "Due for re-verification" section and never lists existing certifications; `/admin` is an empty stub.

## Goals / Non-Goals

**Goals:**
- Make the Audit Log human-readable: resolve `actorEmail` + `targetLabel` at the API and render scalar `before → after`.
- Adopt the `AdminSidebar` chrome (eyebrow, icons, review-queue badge, admin-session card) as the sole admin nav; `/admin` → `/admin/certifications`.
- Paginate Users and Audit Log.
- Bring Users, Sources, Review queue, the Certifications index, and the cert-setup wizard up to design fidelity.

**Non-Goals:**
- Fabricating data the contract does not carry. Fields/actions that need NEW contract support (Users `Name`/`Last active`/`Invite`/`Remove`; Sources `Chunks` count) render a graceful placeholder or disabled affordance — never invented values.
- Backend delivery of those new contract fields/endpoints — flagged as dependencies here, owned by the API/admin capability, not built in this change.
- Changing the discovery/extraction/draft-creation contracts behind the cert-setup wizard (the wizard chrome is presentational).
- The Review-queue detail-pane decision model (already specified and shipped) — this change only adds the header count, filter chips, and richer list-row metadata.

## Visual Design

Visual source of truth: the local design mockups at `openspec/design/AdminContentUsers.html`, `openspec/design/AdminCertSetup.html`, and `openspec/design/App Shell.html` (with `.playwright-mcp/shots/15-admin.png … 21-admin-cert-new.png` as reference screenshots).

| Artboard / screen | Maps to |
|---|---|
| `App Shell.html` — Admin sidebar / `active = Progress · admin role` (ChromeDemo `admin`) | `AdminConsole.vue` — `AdminSidebar` chrome: `ADMIN` eyebrow, per-item icons, Review-queue badge, Admin-session card |
| `AdminContentUsers.html` — "Users — table with promote/demote actions" | `AdminUsers.vue` — Name/email/role badge/Last active/Certs columns, header-utility row, contextual role action + Remove, pagination |
| `AdminContentUsers.html` — "Audit Log — append-only, read-only" | `AdminAuditLog.vue` — actor email, target label, scalar before → after, pagination |
| `AdminContentUsers.html` — "Sources — source table + ingestion jobs" | `AdminSources.vue` — cert pills, "Add source" affordance, Enabled/Last-ingested/Chunks columns, jobs banner, empty state |
| `AdminContentUsers.html` — "Review queue — provenance panel for selected item" | `AdminReviewQueue.vue` + `AdminReviewQueueList.vue` / `AdminReviewQueueDetail.vue` — awaiting-review count, cert filter chips, rich list-row metadata |
| `AdminCertSetup.html` — Setup header (breadcrumb + `Step N of 4` + progress bar) | new `SetupHeader` chrome in `CertSetupWizard.vue` |
| `AdminCertSetup.html` — "Step 1 — Source search & confirmation" | `CertSetupSourceStep.vue` |
| `AdminCertSetup.html` — "Step 2 — Field extraction with citation panel" | `CertSetupExtractionStep.vue` + `CertFieldRow.vue` / `CitationPanel.vue` |
| `AdminCertSetup.html` — "Step 3 — Content sources + coverage progress" | `CertSetupCoverage.vue` + `CertSetupSourcesStep.vue` |
| `AdminCertSetup.html` — "Step 4 — Review & publish" | `CertSetupReviewStep.vue` |
| `AdminCertSetup.html` — "Stale cert — re-verification diff view" | `AdminCertifications.vue` (existing re-verify diff) + existing-certifications list |

**Layout to implement:** one `AdminSidebar` shell (the `AdminConsole.vue` wrapper) reused by every admin section, and one `SetupHeader` chrome reused across the cert-setup wizard steps.

### Design ↔ contract reconciliation

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Audit actor as `jamie@org.io`, target as `alex@org.io` / `AWS whitepapers (SAA-C03)`, `user → admin` | Response carries only `userId`/`targetType`/`targetId`/`before`/`after` | Extend the `audit-log` read model to project `actorEmail` (nullable) + `targetLabel`; render scalar before → after client-side |
| Users `Name` column + avatar initials from name | Admin-users contract exposes no `name` | Render `Name` from a new `name` field when present; placeholder (`—`) otherwise; avatar initials fall back to email |
| Users `Last active` column | Contract exposes no `lastActiveAt` | Render when present; placeholder otherwise |
| Users `Invite user` + red `Remove` | No invite / admin-remove endpoints | Render the affordance disabled/placeholder until endpoints exist; never call a non-existent endpoint |
| Sources `Chunks` column | Content-source read model exposes no chunk count | Render when present; placeholder otherwise |
| Sources `Last ingested` | No explicit field, but derivable | Derive from the latest completed job (`GET :id/jobs`); placeholder if none |
| Cert-setup `Step 4 — Review & publish` gate | `web-admin` spec: no manual "Publish" (draft → live is automatic at the coverage bar) | Keep the wizard chrome/step indicator, but the review step remains review-only — no Publish button (per existing requirement) |

## Test Boundaries

For the acceptance e2e (Playwright) + the API integration test that assert the Audit Log renders human-readable identity, the admin shell chrome, the `/admin` redirect, and Users/Audit pagination.

| Dependency | In acceptance test | In unit / component tests |
|---|---|---|
| Postgres (users, audit_logs, quarantine) | real (Testcontainers) — seed an actor + target + audit rows so `actorEmail`/`targetLabel` resolve | real (Testcontainers) for the audit read-model mapper unit test; n/a for pure UI logic |
| `GET /api/v1/admin/audit-logs` (audit read model) | real API against the seeded DB; assert `actorEmail`/`targetLabel` in the payload and rendered rows | mocked query response for `AdminAuditLog.vue` component tests |
| `GET /api/v1/admin/users` (paginated) | real API with >1 page seeded; assert pagination advances | mocked paginated response for `AdminUsers.vue` component tests |
| `GET /api/v1/admin/quarantine` (review-queue badge count + list filter chips) | real API; assert the sidebar badge reflects pending count | mocked count/list for `AdminConsole.vue` / `AdminReviewQueue.vue` component tests |
| `GET /api/v1/admin/content-sources` (+ `:id/jobs`) — Sources list, enabled/last-ingested, jobs banner | real API (scrapper sidecar per the ingestion-test gotcha) when a Sources acceptance path is exercised | mocked sources + jobs responses for `AdminSources.vue` component tests |
| Certifications list query (shared with Sources cert pills + the certifications index) | real API | mocked list for `AdminSources.vue` / `AdminCertifications.vue` component tests |
| Cert-setup wizard state (`useCertSetupWizard`) — step index/label/progress | driven client-side; no API boundary for the chrome itself | real composable state in `CertSetupWizard.vue` component tests (discovery/extraction contracts already mocked elsewhere) |
| Auth / admin role gate | real (sign in as a seeded `admin`) | mocked auth store `AuthUser` with `role: 'admin'` |
| Web seeds / fixtures | seed users, an audit trail, and quarantine items via the API or a test seed helper | component tests stub the `useAdmin*` composable return values |
| Orval-generated client | real generated client against the running API | mocked at the composable boundary |
| New contract fields not yet delivered (`name`, `lastActiveAt`, chunk count, invite/remove) | assert the graceful placeholder / disabled affordance renders | assert placeholder rendering for absent fields |

## Decisions

- **Audit identity resolution lives in the API, carried as an `audit-log` capability contract change.** `GET /api/v1/admin/audit-logs` projects `actorEmail` (resolved from `userId`, `null` when the actor is hard-purged or the action is system-originated) and `targetLabel` (a human-readable target identifier). Alternative — resolve UUIDs in the web layer with extra lookups — rejected: it would need N+1 identity fetches the web has no endpoints for, and the design shows identity the API is the natural owner of. `actorEmail` is a read-model projection, never persisted on the `AuditLog` row, so the append-only + purge invariants are untouched (`userId` stays the stored, nullable field).
- **Before/After render as a scalar diff on the client.** A small formatter turns single-key snapshots into `old → new`; multi-key snapshots degrade to a compact readable form rather than raw `JSON.stringify`.
- **Graceful-placeholder policy for missing contract fields.** For Users `Name`/`Last active`/`Invite`/`Remove` and Sources `Chunks`, the UI renders `—` / a disabled affordance until the contract exposes them. We never fabricate a value or call a non-existent endpoint. This lets the design-fidelity structure land now while the additive contract work follows.
- **AdminSidebar chrome is the sole admin nav.** The admin area renders inside the `AdminSidebar` shell only — not nested in the learner app shell — eliminating the stacked-nav defect. The Review-queue badge reads the pending count from the existing quarantine query; the Admin-session card reads the signed-in email from the auth store.
- **`/admin` redirects to `/admin/certifications`.** The bare index becomes a redirect rather than an empty stub, matching the certifications landing that already exists.
- **Cert-setup wizard chrome derives from existing wizard state.** The `SetupHeader` breadcrumb + `Step N of 4` indicator + progress bar + Cancel are computed from the current wizard step (`useCertSetupWizard`), not a duplicated step model, and are purely presentational — no contract change.
- **Certifications index reuses the existing certifications list query** (already used by `AdminSources.vue`) to list existing certs alongside the Due-for-re-verification section.

## Risks / Trade-offs

- **Additive-contract dependency is the main risk** → the design's Users `Name`/`Last active`/`Invite`/`Remove` and Sources `Chunks` need new API fields/endpoints this change does not deliver. Mitigation: render graceful placeholders/disabled affordances, ship the structure now, and track the contract work as an explicit follow-up so no fabricated data reaches the UI.
- **Audit read-model resolution could regress performance** (per-row actor/target lookups) → resolve via a batched join/lookup in the read model, not per-row N+1; cover with the integration test.
- **Pagination changes the composable return shape** → introduce paging through `useAdminUsers`/`useAdminAuditLogs` behind a shared control so both tables stay consistent and existing callers keep working.
- **Scalar before → after formatting is lossy for complex snapshots** → the formatter handles the common single-key role/state changes cleanly and falls back to a compact readable form (not raw JSON) for anything richer.
- **Review-queue detail model is already shipped** → scope the review-queue work to the header count, filter chips, and list metadata only, to avoid re-litigating the approved detail-pane behavior.

## Open Questions

- Which fields will the admin-users contract add — `name`, `lastActiveAt`, and invite/remove endpoints — and in what shape? Until then those columns/actions render placeholders.
- Will the content-source read model expose a per-source chunk count (and an explicit last-ingested timestamp), or should `Last ingested` stay derived from job history?
- `targetLabel` resolution rules per `action`/`targetType` (user email vs. source/cert title) — confirm the mapping the API team will implement, especially for targets whose row was later deleted (fall back to the stored `targetId`).
- Exact `System`/`—` copy for a null-actor audit row.
