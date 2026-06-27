## Reviewed Artifacts

- proposal.md
- specs/content-source-admin/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | Task 0.1 implied the API acceptance harness must "ensure the worker ingestion processor does NOT autorun" — but the API test never boots the worker app, so the autorun gate is irrelevant in this harness and the wording was a stale cross-app assumption | Rewrote 0.1 to state the worker is not booted and the test asserts the producer contract only (job on `ingestion-<type>` + readable state), matching design.md Test Boundaries | tasks.md § 0 (0.1) |
| SUGGESTION | proposal.md / design.md | SPEC → Source Etiquette → Takedown path couples disabling with chunk superseding + cache eviction, which could read as in-scope here | Confirmed both artifacts already scope disable to the `enabled` flag only and explicitly assign chunk superseding/eviction to the archived `chunk-lifecycle` change; no change needed beyond the existing notes | design.md § Decisions / Non-Goals (verified) |

## No Remaining Implementation-Blocking Gaps

All capabilities in proposal.md map to the single `content-source-admin` spec file; there are no MODIFIED/REMOVED/RENAMED requirements (the audit-vocabulary extension is an additive shared constant, captured as an ADDED requirement, not a behavioral change to the archived `audit-log` capability). Every spec scenario is concrete (explicit inputs, status codes, audit rows, queue assertions) and is covered by acceptance work in tasks group 0 and controller/service tests in groups 4–5. Design.md resolves the implementation-critical choices: module boundary (`ContentModule` in `apps/api`), no new entity/migration, the cross-app queue contract (`ingestionQueueName` promoted to `@readion/shared`, `BullModule.registerQueue` in the API, `IngestionJobData` shape), error handling (`404`/`409`/`403`/`401`), idempotent audited enable/disable, and BullMQ-as-system-of-record for job status. Test Boundaries name every collaborator (Postgres, Redis/BullMQ, auth guards, `AuditLogService`) and tasks invent no mock boundary beyond them. Dependencies (`content-pipeline`, `auth`, `admin`) are all archived. Implementation may proceed.

## Deferred Non-Blocking Notes

- Chunk superseding and cache eviction on source disable/takedown are intentionally deferred to the already-archived `chunk-lifecycle` change; design.md § Non-Goals records this boundary. This change only flips `enabled`, on which the stale-source cron already gates.
- The `GET /:id/jobs` recent-window size and the BullMQ state set to scan are left as implementation-chosen constants (design.md § Open Questions); defaults are sufficient for the low-traffic admin surface.
