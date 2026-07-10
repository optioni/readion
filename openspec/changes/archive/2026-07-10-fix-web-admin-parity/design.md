## Context

71 findings across the seven admin surfaces (all under `web-admin`). Reconciling against the app's shared types and the `web-admin` spec, roughly half are presentational fidelity, one is a wizard flow restructure, and a large cluster is blocked on data/endpoints that don't exist. This change takes the first two; the third is broken into named backend/contract follow-ups so the admin fidelity work is not silently half-done against missing data.

## Reconciliation — fix here (presentational + flow)

| Theme | Screens | Notes |
|---|---|---|
| Table-shell surface cards; shared bordered header bar; loading spinners; error Retry; submitting spinner/label | Certs list, Sources, Users, Audit, Review queue | Fidelity, no data dependency. |
| Relative timestamps (mono where designed) | Sources, Users, Audit, Review queue | "2h ago" / "Today 14:32" vs absolute `Intl.DateTimeFormat`. |
| Status/type/code chips with per-state color | Certs list, Sources | Pills currently single-color / plain text. |
| Re-verify diff as a **modal overlay** | Certs list | Currently an inline appended section. |
| Cert-setup **5-step restructure** + standalone identify step + **certifying-body** field + upfront known-URL + explainers + footer/breadcrumb/title/width | Cert setup | The one flow change; `provider` already exists on state but is unwired. |
| Cert-reverify **dedicated route** + stale header/pill + diff color coding + colored headers; remove stray "(unverified)" | Cert reverify | Route + presentation are web-doable now. |
| Render **source evidence** from the already-fetched `supportingSpans` (excerpt + highlight + link) + question snippet | Review queue | Data exists; component just doesn't render it. |
| Sources **running-job banner** from the existing `progress` field (spinner + name + % + ETA) | Sources | Data exists; banner is static text. |
| Client-side **user search** over the loaded list; amber Admin badge; "Email" column; toolbar order; avatar styling | Users | Search wiring is client-side. |
| Audit **Before/After columns** (six-column order) + append-only/★ caption + system-actor italic | Audit | Before/after data exists; only the merged cell + caption are missing. |

## Reconciliation — descope (backend/contract) & reaffirm

| Item | Screen | Decision | Why |
|---|---|---|---|
| Verdict taxonomy (confirmed/disputed/ambiguous/key-error); flag-type badge + report count; recommended-fix "edit key → X" action; per-source-correct vs stored-key distinction | Review queue | **Descope → `enrich-review-queue-contract`** | Shared types carry only pass/fail and no flag/report/source-correct fields; "edit key" is a new mutation. |
| User `name` + `lastActive` columns; Remove flow; Invite flow | Users | **Descope → `admin-user-management-contract`** | `AdminUserListItem` has no name/last-active; remove/invite have no wired endpoints. |
| `privileged` star marker; Export CSV | Audit | **Descope → `audit-log-privileged-and-export`** | `AuditLogEntry` has no `privileged` field; no export endpoint. |
| Cancel running job; source display `name` | Sources | **Descope → `source-ingestion-cancel-and-naming`** | No cancel endpoint; `ContentSourceResponse` has only `url`. |
| Per-field Accept; validity-period/exam-version diff rows; save-vs-verify two-step; stale-reason narrative | Cert reverify | **Descope → `cert-reverify-per-field-and-schema`** | `CertProposedValues` lacks these fields; per-field accept + 2-step commit need API support. |
| Pagination control | Audit | **Reaffirm app** | A real need; the artboard just shows a single non-paginated page. |

## Net scope

Admin-wide presentational fidelity + the cert-setup 5-step identify flow + the cert-reverify dedicated screen, all with zero API/DB changes. Everything that requires a new field, taxonomy, action, or export is enumerated above as a discrete follow-up so the fidelity pass renders exactly the data that exists — and no placeholder UI is wired to absent data.

## Follow-ups (separate changes, in rough priority)

1. `enrich-review-queue-contract` — verdict taxonomy, flag type + report count, per-source-correct, and the recommended-fix action (highest value: correctness of the reviewer's decisions).
2. `cert-reverify-per-field-and-schema` — per-field accept + validity/exam-version + save-vs-verify.
3. `admin-user-management-contract` — name + last-active + remove + invite.
4. `audit-log-privileged-and-export` — privileged flag + CSV export.
5. `source-ingestion-cancel-and-naming` — cancel job + display name.
