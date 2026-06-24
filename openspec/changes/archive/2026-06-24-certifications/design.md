## Context

Readion's study features (enrollment, quiz generation, mock exams, readiness, agent) are all scoped to a `Certification` and consume its structured exam-format facts. Those facts drive scoring and must be trustworthy, so they are stored as data with provenance and are never LLM-generated at question time. This change is the first of Phase 3: it creates the `Certification` entity, ships verified seed data for the primary-target certs, and exposes the read-only catalog API.

Dependencies `api-foundation` (response envelope, RFC 7807 exception filter, OpenAPI/Orval pipeline, throttler, terminus) and `db-foundation` (MikroORM config, migration tooling, Testcontainers DB harness) are complete and archived. This change does **not** depend on `auth`.

## Goals / Non-Goals

**Goals:**
- Own and create the `Certification` entity + migration in `packages/db`, including the `state` (`draft`/`live`), structured `provenance`, and `verifiedAt` columns.
- Provide an idempotent verified-seed mechanism for the primary-target certs.
- Expose `GET /api/v1/certifications` (live-only, paginated) and `GET /api/v1/certifications/:id` (detail) via `CertificationsModule`, using the standard envelopes.
- Regenerate and commit the Orval client.

**Non-Goals:**
- The coverage-bar evaluation and automatic `draft` → `live` flip (owned by `cert-go-live`, which writes the `state` column this change creates).
- The `verifiedAt` staleness "due for re-verification" cron and grounded per-field citation extraction (owned by `content-pipeline` / `cert-setup-grounding`).
- Admin-only draft visibility, per-domain coverage read model, and the admin cert UI (owned by `cert-go-live` / `web-admin`).
- Any user-scoped data (`readinessScore`, weak areas) — those belong on `UserCertification`.
- Role/authorization logic on the catalog endpoints.

## Test Boundaries

Per outside-in TDD: the acceptance test exercises real HTTP → real NestJS app → real Postgres via Testcontainers. There are no external services in this change (no LLM, no scrapper, no mail), so nothing is HTTP-mocked.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (Certification table) | real (Testcontainers test DB) | real (Testcontainers) for repository/integration; n/a for pure logic |
| NestJS HTTP layer | real (Supertest against the app) | n/a |
| Seed mechanism (migration/seeder) | real (run against test DB, asserted idempotent) | unit test for any pure seed-data validation (e.g. weights sum to 100) |
| Redis / LLM / scrapper / mail | not involved | not involved |

The e2e Playwright test (outermost loop) asserts the catalog is reachable through the web app's API client; since there is no dedicated catalog page yet, the e2e check targets the API surface the client generates against (live-only list returns 200 with the envelope shape).

## Decisions

- **Entity owns the `state` column even though `cert-go-live` flips it.** The roadmap entity-ownership table assigns `Certification` (and all its columns) to this change; `cert-go-live` introduces no entity and only writes `state`. Creating the column now (default `draft`) avoids a later migration owned by a change that owns no entity. Alternative — defer the column to `cert-go-live` — rejected because it splits one entity's schema across two owners.
- **Seed certs start `draft`, list is live-only.** Faithful to PRD §4 / SPEC "draft → live is automatic": a cert is not enrollable until its knowledge base meets the coverage bar, which only happens after `content-pipeline` + `cert-go-live`. Consequence: the public list is empty until those land. Alternative — seed as `live` for early testing — rejected as spec-violating; tests seed a `live` row directly when they need to assert list contents.
- **Provenance stored as a structured JSON value, not a boolean.** Modeled as `verified` or a per-field citation map (`{ field: { url, passage } }`) so `cert-setup-grounding` can later populate citations without a migration. This change only writes `verified`. Alternative — boolean `verified` flag — rejected because it would force a migration when grounded pre-fill arrives.
- **Domains stored as an embedded/JSON array on `Certification`** (`{ name, weight }[]`), not a separate `Domain` table. Domains are small, always read with their cert, configured per cert, and never queried independently in this phase. Alternative — normalized `Domain` table — rejected as premature; revisit only if a downstream change needs to query/relate domains directly.
- **Seeding via a MikroORM migration (idempotent upsert keyed on exam `code`).** Keeps seed data versioned and runnable through the existing `migration:up` tooling in CI and deploy, rather than a separate ad-hoc seeder script. Idempotency is enforced by checking existence on the unique `code` before insert. Alternative — a standalone seeder command — rejected to avoid a second migration-like path.
- **Read endpoints are public (no auth dependency).** The dependency graph omits `auth` from this change and the catalog is non-sensitive. If a global JWT guard is present at integration time, the routes are marked public. Alternative — require auth — rejected as it would add an undeclared dependency.

## Risks / Trade-offs

- [Empty public list until content + go-live land] → Expected per slicing; documented here and in the proposal. Integration tests that assert list contents seed a `live` certification directly.
- [Seed data accuracy — domain weights/exam facts must match official guides] → Seed values are curated from official exam guides and marked `verified`; a unit test asserts each seeded cert's domain weights sum to 100 and required exam-format fields are present. Drift is handled later by the `verifiedAt` re-verification flow (out of scope here).
- [Domains as JSON limit future relational queries] → Acceptable for this phase; the structured shape is stable and can be normalized in a later migration if a feature requires it.

## Open Questions

- None blocking. The exact curated weights/exam facts for every seeded cert are filled from the official exam guides during implementation; the entity shape and API contract above are settled.
