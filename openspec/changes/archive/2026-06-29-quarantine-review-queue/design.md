# Design — quarantine-review-queue

## Context

The grounding pipeline already quarantines items that fail the independent verifier (`grounding-verification` → "Quarantine and cache eviction") and counts them (`readion_grounding_quarantined_items_total`), via `QuarantineService`. But quarantined items are not exposed: the `web-admin` Review queue is an honest placeholder. This change makes quarantine **durable and admin-reviewable**.

## Pre-flight (resolve before sizing)

**Is quarantine currently persisted, or ephemeral/metric-only?** Inspect `apps/api/src/grounding/quarantine.service.ts` and `grounding.metrics.ts`. The `QuarantineRecord` type exists in the service; determine whether records are stored in Postgres or only emitted as metrics/logs. This decides whether the change is (a) a new `QuarantinedItem` entity + write at the quarantine point, or (b) a read-model + admin API over an existing store. The spec assumes (a); downgrade to (b) if a durable store already exists.

**RESOLVED (planning-review):** Quarantine is **ephemeral/metric-only**. `QuarantineService.quarantine(cacheKey, provenance, reason, certificationId?)` evicts the cache key, increments the `readion_grounding_quarantined_items_total` counter, and returns a frozen in-memory `QuarantineRecord` — nothing is written to Postgres. Therefore option **(a)** holds: this change adds a new `QuarantinedItem` entity + a write at the quarantine point. Note: the current signature does not pass `domain`; the spec requires it on the record, so the implementer must derive it from `provenance`/`GenerationOptions` or extend the call (caller: `apps/api/src/quiz/quiz.service.ts:366`, where `GenerationOptions.domain` is in scope).

**Audit vocabulary (planning-review):** `packages/shared/src/admin` defines `AuditAction` with `ContentQuarantined: 'content.quarantined'` but **no approve/reject actions**. The approve/reject endpoints must add two new values (e.g. `QuarantineApproved: 'quarantine.approved'`, `QuarantineRejected: 'quarantine.rejected'`) to `AuditAction` + `auditActions` and update `packages/shared/src/admin/admin.spec.ts`, then audit via the existing `AuditLogService.record(...)` (`apps/api/src/admin/audit-log.service.ts`).

## Approach

- **Persistence**: own a `QuarantinedItem` entity (table + first migration) keyed to certification + domain + source `ContentChunk`, with verifier verdict/reason, generated content (or reference), `status` (`pending|approved|rejected`), timestamps. Write it at the existing quarantine point in `QuarantineService` (additive — eviction + metric unchanged).
- **Admin API**: a new admin controller (standalone `QuarantineAdminModule`, or extend `AdminModule`) under `/api/v1/admin/quarantine`, guarded by `JwtAuthGuard` + `RolesGuard(admin)`:
  - `GET /admin/quarantine` — paginated (default 25/max 100), filter by `certificationId`/`status`.
  - `POST /admin/quarantine/:id/approve` — re-instate via the grounding reinstatement path, set `approved`, write `AuditLog`.
  - `POST /admin/quarantine/:id/reject` — set `rejected`, write `AuditLog`.
  - Resolving an already-resolved item → idempotent or `409` (decide in tasks).
- **Audit**: reuse the `admin`/`AuditLog` append-only writer for approve/reject (actor, target, before/after), like user promote/demote.
- **Shared**: DTOs for the list item + actions.
- **Web**: `web-admin` Review queue consumes the list + actions, replacing the placeholder.

## Test boundaries

- **Integration (Testcontainers)**: quarantine writes a `pending` row; admin list paginates/filters; non-admin → `403`; approve re-instates + audits + flips status; reject discards + audits; double-resolve handled; metric/eviction still fire on quarantine.
- **Unit**: status-transition guards; the approve→reinstate mapping.
- **e2e (Playwright)**: admin Review queue lists items and resolves one.
- **Outside-in order**: e2e RED → integration RED → unit RED → implement.

## Decisions

- **Additive at the quarantine point**: do not change the verifier/retry/substitution budget or the metric; only add a durable write + admin surface.
- **Reuse `AuditLog`**: every mutating admin action is audited, consistent with `user-admin`.

## Open questions

- Persistence model (see Pre-flight) — the crux of scope.
- Approve semantics: re-instate the original generated item, or merely un-quarantine the source chunk for regeneration? Confirm against how `grounding-verification` reinstatement actually works before implementing approve.
- Cross-cutting: no new cron; this rides existing grounding flow. If a retention/cleanup cron for resolved items is wanted, flag it as a follow-up rather than expanding scope here.
