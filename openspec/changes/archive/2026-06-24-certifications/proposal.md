## Why

Every study feature — enrollment, quiz generation, mock exams, readiness scoring, the agent — is scoped to a specific certification and reads its structured exam-format facts (domain weights, question count, passing score, time limit). Those facts must be trustworthy and are **never generated at question time**, so the catalog of supported certifications has to exist as first-class, provenance-carrying data before any study loop can be built. This change introduces the `Certification` entity, verified seed data for the primary-target certs, and the read-only catalog API the rest of Phase 3+ depends on.

## What Changes

- Add the `Certification` MikroORM entity (owned by this change) + its creation migration in `packages/db`: name, provider, exam code, domain list with weights, question count, passing score, time limit, structured exam-format provenance, `verifiedAt`, and a `state` (`draft` | `live`) column.
- Model exam-format **provenance** as structured data: `verified` (seed data) or a per-field citation (`{ url, passage }`) so grounded pre-fill (`cert-setup-grounding`, later) can populate it without a migration. This change only ever sets `verified`.
- Add a **verified seed data** mechanism (idempotent seeder migration) populating the AWS / Azure / Kubernetes / AI-ML primary-target certs from `SPEC.md → Supported Certifications`, each with curated domains, weights, and exam-format facts marked `verified`. Seed certs start in `state: draft` (not enrollable until content lands).
- Add `CertificationsModule` to `apps/api` with read-only catalog endpoints:
  - `GET /api/v1/certifications` — paginated collection, returns `live` certifications only.
  - `GET /api/v1/certifications/:id` — detail: domains (topic breakdown) + exam format, returned via the standard single-resource envelope with a `relationships` block.
- Regenerate and commit the Orval client for the new endpoints.

**Out of scope (owned by later changes, called out so they aren't dropped):**
- The coverage-bar evaluation and **automatic `draft` → `live` flip** live in `cert-go-live`; this change only creates the `state` column (default `draft`) that `cert-go-live` writes to.
- The `verifiedAt` metadata-staleness "due for re-verification" cron and grounded per-field extraction live in `content-pipeline` / `cert-setup-grounding`.
- Admin draft visibility, per-domain coverage read model, and the admin cert UI live in `cert-go-live` / `web-admin`.
- User-specific data (`readinessScore`, weak areas) lives on `UserCertification`, never on `Certification`.

## Capabilities

### New Capabilities
- `certifications`: The certification catalog — the `Certification` entity and its structured, provenance-carrying exam-format fields; verified seed data for primary-target certs; `draft`/`live` state; and the read-only list/detail API consumed by enrollment and the study features.

### Modified Capabilities
<!-- None — this change introduces a new capability and a new entity; no existing spec requirements change. -->

## Impact

- **`packages/db`**: new `Certification` entity, creation migration, and an idempotent seed-data migration. Owns this entity per the roadmap entity-ownership table.
- **`apps/api`**: new `CertificationsModule` (controller + service + DTOs), wired into the app module. Read-only, non-user-scoped catalog endpoints; no role logic (this change does not depend on `auth`).
- **`apps/web`**: regenerated Orval client (`apps/web/src/api/`) for the new endpoints, committed.
- **`packages/shared`**: certification DTO/type definitions if shared across api/web.
- **Depends on** (both archived/complete): `api-foundation` (response envelope, exception filter, OpenAPI/Orval pipeline), `db-foundation` (MikroORM config, migration tooling, Testcontainers harness).
- **Unblocks**: `user-certifications` (enrollment), `content-pipeline` (per-cert sources), `cert-go-live` (writes `state`).
