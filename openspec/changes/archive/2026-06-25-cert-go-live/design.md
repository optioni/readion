## Context

`Certification.state` (`draft` | `live`, default `draft`) already exists, and the public `GET /api/v1/certifications` listing already filters to `live` only — both shipped with the `certifications` change. The content pipeline (`content-pipeline`, archived) ingests sources into `ContentChunk`s carrying `certificationId`, `domainTags` (`{domain, confidence}[]`), `primaryDomain`, and a `state` (`active` | `superseded`), and `ContentSource` carries `enabled` + `certificationId`. What's missing is the logic that decides when a `draft` cert has enough coverage to become enrollable and performs the flip. PRD §4 fixes the thresholds; SPEC → Certification Setup & Grounding fixes that the flip is automatic with no publish button and that the admin sees per-domain coverage.

This change spans three workspaces: `apps/worker` (where ingestion completes and the flip is triggered), `apps/api` (the admin coverage read model), and `packages/shared` (`CoverageReport` types + the pure bar-evaluation logic). It owns no entity and adds no migration.

## Goals / Non-Goals

**Goals:**
- Compute per-domain + total coverage for a certification from `ContentChunk`/`ContentSource`.
- Flip `draft → live` automatically when the PRD §4 bar is met, recomputed on ingestion completion.
- Serve an admin-only per-domain coverage read model so the gap to go-live is visible.
- Keep the per-domain chunk minimum and total-chunk multiple configurable, with shared defaults (20, 3).

**Non-Goals:**
- The admin coverage **UI** — owned by `web-admin`.
- Demotion `live → draft` (e.g. after a takedown drops coverage). Out of scope; promotion is one-way here.
- Coverage-driven re-verification of exam-format metadata (`verifiedAt`) — owned by `cert-setup-grounding`.
- Any change to how chunks are ingested, tagged, or reconciled — this change only reads them.

## Test Boundaries

The outermost acceptance tests here are **NestJS integration tests** (Supertest for the API endpoint; direct service invocation for the worker promotion), not Playwright — this change ships no web view, so the Playwright e2e is deferred to `web-admin`. Postgres is always real (Testcontainers); the ingestion fetch/tag/embed collaborators are mocked so tests seed chunk state deterministically rather than hitting external sources or the LLM.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (chunks, sources, certs) | real (Testcontainers test DB) | real for repository/query tests; none for pure evaluator |
| Auth (`JwtAuthGuard` / `RolesGuard`) | real (admin + non-admin JWTs issued) | n/a |
| Fetch strategy / domain tagger / embedder (worker) | mocked at module boundary — seed final chunk rows directly | mocked |
| BullMQ / Redis | not exercised — promotion is invoked via `IngestionService` completion path directly | n/a |
| Pure coverage evaluator (`evaluateCoverage`) | real (called through the services) | real, table-driven, no DB |

## Decisions

**1. Split pure decision logic from DB aggregation.** A pure `evaluateCoverage(domainStats, totalChunks, questionCount, thresholds): CoverageReport` lives in `packages/shared` and is exhaustively unit-tested with no DB. The counting query (active chunks per domain, distinct enabled contributing sources per domain, total active chunks) lives in `packages/db` as a reusable query helper so `apps/api` and `apps/worker` share one implementation instead of duplicating SQL.
- _Alternative:_ duplicate the whole evaluation in each app. Rejected — two copies of the bar logic would drift, and the threshold semantics are exactly what must stay consistent between the flip and the admin read model.
- The evaluator is seeded from the **certification's configured domain list**, not from the query result alone: the chunk aggregation emits no row for a domain with zero chunks, so the caller zero-fills any configured domain missing from the query before evaluating. This guarantees an empty domain fails the bar instead of being silently skipped.

**2. Domain membership counts against `domainTags`, not `primaryDomain`.** A chunk counts toward every domain in its `domainTags` (above the tagging confidence threshold), matching the pipeline's "retrieval matches against any tagged domain." This is what makes a multi-domain chunk (e.g. IAM ↔ Security/Architecture) count for each domain it serves.
- _Alternative:_ count only `primaryDomain`. Rejected — it would under-count coverage for cross-cutting domains and contradict retrieval behavior.

**3. "Qualifying enabled source per domain" = a distinct `contentSourceId` among that domain's active chunks whose source is `enabled`.** A source that failed to fetch produces no chunks and is therefore naturally excluded, satisfying PRD's "no domain resting on a single failed fetch" without tracking a separate per-source success flag.

**4. Trigger the flip inline at the end of `IngestionService.ingest()`** (after reconciliation + `updateLastFetchedAt`), evaluating `source.certificationId`. The agent `fetchMoreMaterial` slow path and the staleness cron both enqueue onto the same per-source queues processed by `IngestionService`, so all ingestion routes are covered by one hook.
- _Alternative:_ a separate BullMQ `completed`-event listener. Rejected — a second moving part for the same trigger, with weaker transactional locality than evaluating right after the chunks are committed.

**5. Promotion is one-way and idempotent.** The evaluator only ever transitions `draft → live`; `live` certs are left untouched even if the bar no longer holds. Re-running on an already-`live` cert is a no-op. This avoids yanking an enrollable cert out from under active learners on a transient coverage dip.

**6. Thresholds from Zod-validated env in both apps**, defaulting to shared constants `DEFAULT_MIN_CHUNKS_PER_DOMAIN = 20` and `DEFAULT_TOTAL_CHUNK_MULTIPLE = 3` exported from `packages/shared`, so the two env schemas can't silently diverge on defaults.

**7. Coverage endpoint shape.** `GET /api/v1/certifications/:id/coverage`, admin-gated by `RolesGuard`, single-resource envelope `{ data }`. The report carries per-domain `{ name, chunkCount, chunkThreshold, enabledSourceCount, met }`, plus `totalChunks`, `totalThreshold`, `state`, and overall `met`. Nesting under the cert resource (rather than a top-level `/coverage`) keeps it discoverable as cert-scoped admin tooling. Missing cert → 404; non-admin → 403 (admin route, not a user-owned resource, so 403 not 404).

## Risks / Trade-offs

- **A live cert can drift below the bar after a source takedown** (chunks superseded) but stays `live` → acceptable for now; demotion is a deliberate non-goal and would need product rules about in-flight enrollments. Revisit with `chunk-lifecycle`/takedown if it becomes real.
- **Counting on every ingestion completion adds a few aggregate queries per job** → cheap (indexed counts scoped by `certificationId`); only the affected cert is evaluated, not all certs.
- **Two env schemas (api + worker) define the same thresholds** → mitigated by sourcing defaults from one shared constant; a drift in an explicit override across apps would be an operator error, not a code defect.
- **`domainTags` membership via JSON query** → ensure the query matches the stored shape (`{domain, confidence}[]`); covered by a real-DB repository test rather than a mock.

## Open Questions

- Should the promotion emit a metric/audit signal (e.g. a `cert_promoted_to_live` counter)? SPEC's metrics list doesn't name one and `AuditLog` (owned by `admin`) isn't a dependency here; left out unless `observability`/`admin` later want it. A structured log line on promotion is included regardless.
