## Reviewed Artifacts

- proposal.md
- specs/content-quarantine-review/spec.md
- specs/grounding-verification/spec.md
- specs/web-admin/spec.md
- design.md
- tasks.md

Also inspected the implementation surface to resolve the crux pre-flight question: `apps/api/src/grounding/quarantine.service.ts`, `grounding.metrics.ts`, `quiz.service.ts` (quarantine caller), `apps/api/src/admin/audit-log.service.ts`, `packages/db/src/entities/audit-log.entity.ts`, and `packages/shared/src/admin`.

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | design.md (Pre-flight / Open questions) | The "is quarantine persisted?" open question — the crux of scope — was unresolved. Verified in code: `QuarantineService.quarantine()` only evicts the cache key and increments the Prometheus counter, returning a frozen in-memory record; nothing is persisted. | Recorded the resolution: quarantine is ephemeral/metric-only, so option (a) (new `QuarantinedItem` entity + write at the quarantine point) is correct. The spec's assumption holds; no downgrade to a read-model. | design.md → Pre-flight (RESOLVED note) |
| WARNING | design.md / tasks.md (audit reuse) | Specs/design require approve/reject to be audit-logged "reusing the AuditLog writer", but the `AuditAction` vocabulary in `packages/shared/src/admin` only has `content.quarantined` — there are no approve/reject actions. Without new vocabulary values, the audit writes cannot be expressed (`AuditActionValue` is a closed union enforced by `admin.spec.ts`). | Documented that two new values (`quarantine.approved`, `quarantine.rejected`) must be added to `AuditAction` + `auditActions` + `admin.spec.ts`, then audited via the existing `AuditLogService.record(...)`. Added the work to the GREEN task. | design.md → Pre-flight (Audit vocabulary note); tasks.md → 4.2 |
| SUGGESTION | design.md (data model) | The `QuarantinedItem` spec requires a `domain`, but the current `quarantine(cacheKey, provenance, reason, certificationId?)` signature does not carry `domain`. | Noted that the implementer must derive `domain` from `provenance`/`GenerationOptions` (the caller at `quiz.service.ts:366` has `GenerationOptions.domain` in scope) or extend the call additively. | design.md → Pre-flight (RESOLVED note) |

## No Remaining Implementation-Blocking Gaps

All capabilities in proposal.md map to spec files: `content-quarantine-review` (ADDED), `grounding-verification` (MODIFIED), `web-admin` (MODIFIED). Every spec requirement has a concrete, testable scenario, and each has corresponding acceptance/integration/unit/e2e work in tasks.md following outside-in order (Section 0 outer-loop RED → entity → persist → list → approve/reject → codegen → web → e2e/close → verification gates). Design.md names the test boundaries (Testcontainers integration, unit transition guards, Playwright e2e). The crux persistence question is resolved in favor of the new entity, and the only collaborator vocabulary gap (audit actions) is now captured in design.md and tasks.md. No blocking gaps remain.

## Deferred Non-Blocking Notes

- Retention/cleanup cron for resolved quarantined items is intentionally out of scope; design.md (Open questions) already flags it as a follow-up rather than expanding this change.
- Double-resolve semantics (idempotent vs `409`) are intentionally left for the implementer to decide at task 4.1/4.2; both specs accept either, and the integration test will pin the chosen behavior.
