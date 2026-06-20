## Context

`scaffold-monorepo` left `packages/db` bootable but bare: a MikroORM PostgreSQL config with `entities: []`, an empty barrel, and a Testcontainers helper that boots Postgres (`pgvector/pgvector:pg17`) and Redis. There is no NestJS integration, no entity base class, no migrator wiring, no pgvector type support, and no reusable test harness. Per the roadmap entity-ownership table, `db-foundation` owns the database *setup* only — the `vector` extension migration plus shared conventions and tooling — and introduces **no domain entity**. Every Phase 2+ change (auth, certifications, content-pipeline, …) depends on this layer to declare entities, run migrations, and write Testcontainers-backed integration tests.

Because there are no domain tables yet, the integration tests here exercise the *foundation itself*: that the config/naming strategy/migrator behave, that `BaseEntity` produces UUIDs and timestamps against a real database, that the `Vector` type round-trips through pgvector, and that the harness boots a migrated DB with per-test isolation. A throwaway fixture entity (test-only, not exported) is used to exercise `BaseEntity` and `Vector` without creating a real domain table.

## Goals / Non-Goals

**Goals:**
- One shared MikroORM config consumed identically by `apps/api` and `apps/worker` via a NestJS `DbModule`.
- Snake_case underscore naming strategy and a `BaseEntity` (UUID v4 PK, managed `createdAt`/`updatedAt`) as the convention all entities extend.
- A reusable pgvector `Vector` custom type (fixed dimension at column level) + HNSW `vector_cosine_ops` index helper for downstream embedding columns.
- The owned `vector` extension migration as migration #1, with `create`/`up`/`down` tooling rooted in `packages/db` and the immutable-committed-migration convention documented.
- A reusable Testcontainers DB harness (boot pgvector Postgres → migrate → fork `EntityManager` per test → reset between tests) that all downstream integration tests import.

**Non-Goals:**
- Any domain entity or table (owned by later changes).
- The Kubernetes migration `Job` / ArgoCD `pre-sync` hook (owned by `k8s-deployment`).
- The boot-time embedding-dimension-vs-live-column check (owned by the content/LLM changes that consume `Vector`).
- Redis/BullMQ wiring (owned by `worker-foundation`); the existing Redis container helper stays untouched.

## Test Boundaries

Nothing is mocked — the whole point of this layer is to verify behavior against a real Postgres+pgvector. Unit tests cover the pure pieces (naming-strategy conversions, `Vector` serialize/hydrate, HNSW DDL string) with no I/O. A test-only fixture entity exercises `BaseEntity`/`Vector` against the real DB without introducing a domain table.

| Dependency | In acceptance (integration) test | In unit tests |
|---|---|---|
| Postgres + pgvector | real (Testcontainers `pgvector/pgvector:pg17`, migrated) | not used |
| MikroORM `EntityManager` | real (forked per test) | not used |
| NestJS DI (`DbModule`) | real (`@nestjs/testing` module against test DB) | not used |
| Naming strategy conversions | — | pure function calls, no I/O |
| `Vector` type serialize/hydrate | round-trips through real DB on the fixture entity | pure function calls, no I/O |
| HNSW index helper DDL | — | asserts generated SQL string |
| Redis | not used by this change | not used |

## Decisions

- **HNSW over IVFFlat for the embedding index helper.** SPEC §94 mandates HNSW with `vector_cosine_ops` for better recall/latency at the cost of memory — the right trade-off for retrieval quality. The helper hard-codes the `hnsw` access method and `vector_cosine_ops` operator class; callers supply the table/column.
- **Fixed dimension at the column, not runtime config.** Per SPEC §570/§758 the embedding dimension is a migration-time property. `Vector` takes the dimension as a type parameter so `vector(1536)` is emitted in DDL; swapping models is a deliberate migration, not a config flag. The boot-time mismatch check is deferred to consumers.
- **`BaseEntity` with UUID v4 PK.** UUIDs avoid cross-service sequence coordination and don't leak row counts. Generated app-side (v4) so an entity has its `id` before flush, simplifying tests and references. Alternative (DB `gen_random_uuid()` default) rejected to keep the id available pre-flush and DB-portable.
- **Underscore naming strategy.** MikroORM's built-in `UnderscoreNamingStrategy` yields `created_at` / `content_chunks` matching SPEC table names — chosen over a custom strategy to avoid maintenance.
- **`DbModule` wraps `MikroOrmModule.forRoot(config)`.** A thin re-export module gives apps a single import and one connection-config source, rather than each app calling `forRoot` with its own inline config. Re-exports `MikroOrmModule` so `forFeature` entity registration works downstream.
- **Test harness boots once, resets per test.** Container + migrations are expensive, so the harness boots one migrated container per suite and resets state between tests (fast truncation of all non-bookkeeping tables, or a fresh fork) rather than re-migrating each test. Keeps the suite fast while preserving isolation.
- **Migrator: TS emit + snapshot + transactional.** TS emit keeps migrations in the same language/toolchain; snapshotting makes `migration:create` diff cleanly; per-migration transactions give atomic rollback on failure.

## Risks / Trade-offs

- **No domain tables to test against** → use a test-only fixture entity (not exported, registered only in the harness/test module) to exercise `BaseEntity` and `Vector` end-to-end.
- **Truncation-based reset can miss future special tables** (e.g. the migrations table must be preserved) → reset logic explicitly excludes MikroORM bookkeeping tables and is centralized in the harness so downstream changes inherit correct behavior.
- **Testcontainers cold-start latency** inflates suite time → boot one container per suite (not per test) and reuse the running app's pulled image; CI caches the image layer.
- **`@mikro-orm/nestjs` version skew** with the pinned `@mikro-orm/*` `^7.1.4` → install a matching major and verify `DbModule` resolves an `EntityManager` in an integration test before relying on it.
- **HNSW index build cost on large tables** is a downstream concern → the helper only emits DDL; the actual index lands in `content-pipeline`'s migration where data volume is owned.

## Open Questions

- None blocking. The exact reset mechanism (per-test `TRUNCATE ... CASCADE` of discovered tables vs. transaction-rollback wrapping) is an implementation detail the harness encapsulates; both satisfy the isolation scenarios in the spec.
