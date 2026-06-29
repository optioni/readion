## Why

The grounding pipeline quarantines generated items that fail the independent verifier (`grounding-verification` → "Quarantine and cache eviction"), but quarantined items are currently a dead end: a `QuarantineService` records them and a Prometheus counter (`readion_grounding_quarantined_items_total`) tallies them, but **no admin API surfaces them**. The archived `web-admin` console therefore ships its **Review queue** section as an honest placeholder. Admins need to triage quarantined items — release a false-positive back into circulation, or reject it permanently — so good content isn't silently lost and verifier precision can be monitored over time.

(Surfaced as a flagged follow-up in `web-admin` — the review queue was shipped as a placeholder with no fabricated data.)

## What Changes

- **Persist** quarantined items in an admin-queryable store keyed by certification + domain + source `ContentChunk`, carrying the verifier verdict/reason and provenance. (Quarantine is presently a service/metric concern; this change gives it a durable, listable shape — see the open question in Impact.)
- New **admin-only, audit-logged** endpoints:
  - `GET /api/v1/admin/quarantine` — paginated list of quarantined items with verdict, reason, certification, and provenance.
  - `POST /api/v1/admin/quarantine/:id/approve` — release the item back into circulation (re-instate to cache / knowledge base).
  - `POST /api/v1/admin/quarantine/:id/reject` — discard permanently.
- Each mutating action writes an `audit-log` entry (actor, target, before/after), consistent with the other admin mutations (`user-admin`).
- Frontend: the `web-admin` Review queue placeholder becomes the real list + approve/reject actions.

## Capabilities

### New Capabilities
- `content-quarantine-review`: admin-facing listing and approve/reject of grounding-quarantined items, authorization-gated and audit-logged.

### Modified Capabilities
- `grounding-verification`: quarantined items are persisted in an admin-listable form, not only counted as a metric; approve/reject feed back into cache/eviction.
- `web-admin`: the Review queue section consumes the new endpoints instead of the placeholder.

## Impact

- **Code**: `apps/api/src/grounding/` (persist quarantine records) plus a new admin controller/service (standalone or extending `user-admin`), `packages/db` (likely a new `QuarantinedItem` entity + migration), `packages/shared` (DTOs), `apps/web` admin review-queue components. Integration tests (list/approve/reject + admin authorization + audit entries); Playwright e2e.
- **API**: new admin routes → run `yarn codegen` and commit the client.
- **Entity/migration**: likely a new `QuarantinedItem` entity + first migration — **confirm current persistence first** (quarantine may presently be ephemeral; the data model is the crux of scope).
- **Dependencies**: archived `grounding-verification`, `user-admin`, `audit-log`, `web-admin`.
- **Open question**: whether quarantined items are already persisted anywhere or only counted/evicted — answer drives whether this is a read-model addition or a new entity. Resolve in the design step before sizing.
