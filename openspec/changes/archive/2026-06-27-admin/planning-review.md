## Reviewed Artifacts

- `proposal.md`
- `specs/user-admin/spec.md`
- `specs/audit-log/spec.md`
- `design.md`
- `tasks.md`

Cross-checked against SPEC.md (AdminModule; Authentication & Authorisation → Roles; Core Entities → AuditLog; Resource ownership), the IMPLEMENTATION-ORDER.md row for `admin` (Capabilities `user-admin`, `audit-log`; owns `AuditLog`; depends on `auth`, `users`), and the existing code (`apps/api/src/auth/auth.guards.ts`, `apps/api/src/users/last-active-admin.guard.ts`, `apps/worker/src/users/user-purge.service.ts`, `packages/db/src/entities/user.entity.ts`).

## Gaps Found and Fixed

| Severity | Source artifact | Problem | Fix made | Section updated |
|---|---|---|---|---|
| WARNING | specs vs worker code | The worker purge already hard-codes `UPDATE audit_logs SET user_id = NULL`; a free-chosen column name would silently break the strip step. | Pinned the actor column to `user_id` in the spec, design decision, and migration task. | audit-log spec (strip requirement), design Decisions/Risks, tasks 2.2/2.3/5.1 |
| WARNING | specs vs SPEC roles | Demotion could remove the last admin, contradicting the first-user-admin / role invariants. | Added a `409` last-active-admin block reusing `LastActiveAdminGuard`. | user-admin spec (demote requirement + scenarios), design Decisions, tasks 4.2/4.4 |
| SUGGESTION | proposal vs SPEC audit semantics | Idempotent promote/demote could otherwise spam the append-only log with no-op entries. | Specified audit writes only on an actual role transition. | both specs, design Decisions, tasks 4.1/4.4 |
| SUGGESTION | design vs ownership table | Risk that admin endpoints get user-scoped like owned resources. | Stated admin endpoints are role-scoped (RolesGuard), list filtered to active users. | design Decisions, user-admin spec |

## No Remaining Implementation-Blocking Gaps

Confirmed. Every capability in the proposal (`user-admin`, `audit-log`) has a spec file; every spec requirement has at least one concrete WHEN/THEN scenario with a matching acceptance/integration task; design.md Test Boundaries name every real/mocked collaborator the tasks rely on; the owned `AuditLog` entity + migration and the cross-cutting `AuditLogService` writer are reflected in tasks. Dependencies `auth` and `users` are archived under `openspec/changes/archive/`, and `user-certifications` (read for enrollment counts) is likewise archived.

## Deferred Non-Blocking Notes

- The privileged-action vocabulary is introduced as an open string-constant set; `content-admin` and `cert-setup-grounding` extend it and inject the same `AuditLogService` when they land — flagged in design.md Open Questions, not blocking this change.
- No worker cron and no feature-emitted Prometheus metric are attributed to `admin` in IMPLEMENTATION-ORDER.md's cross-cutting tables, so none are in scope here (only an integration test of the pre-existing `users` purge strip).
