## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Add `@mikro-orm/nestjs` (major matching `@mikro-orm/* ^7.1.4`) and `uuid` to `packages/db`; no DB mocking — all DB-touching tests use the real Testcontainers `pgvector/pgvector:pg17` per design.md Test Boundaries
- [x] 0.2 Write failing acceptance integration test (`*.spec.ts`, co-located): boot the DB harness, register a test-only fixture entity extending `BaseEntity` with a `Vector` embedding column, import `DbModule` via `@nestjs/testing`, resolve `EntityManager`, persist+flush a fixture row, and assert UUID v4 `id`, populated `createdAt`/`updatedAt`, and a round-tripped embedding array — covers `database-foundation` scenarios "Module provides an EntityManager", "New entity receives a UUID primary key", "Timestamps populated on insert", "pgvector literal hydrated to JS array", "Harness boots a migrated database"
- [x] 0.3 Confirm it fails for the right reason (missing `DbModule`/`BaseEntity`/`Vector`/harness — not a container or import setup error)

## 1. MikroORM Config & Naming Strategy

- [x] 1.1 RED: Unit test (no I/O) asserting the exported config uses the underscore naming strategy — `createdAt` → `created_at` and class `ContentChunk` → table `content_chunks` — and resolves Postgres host/port/dbName/user/password from env with defaults (`database-foundation` scenarios "Naming strategy maps camelCase to snake_case", "Entity class name maps to snake_case plural table", "Connection driver is PostgreSQL")
- [x] 1.2 GREEN: Harden `src/mikro-orm.config.ts` — set `UnderscoreNamingStrategy`, connection pool, and keep env-driven connection params; export the config object
- [x] 1.3 REFACTOR: Centralize env-default constants; ensure a single exported config consumed everywhere

## 2. BaseEntity

- [x] 2.1 RED: Unit test for `BaseEntity` shape — UUID v4 `id` default and `createdAt`/`updatedAt` properties with onCreate/onUpdate hooks (`database-foundation` scenarios "New entity receives a UUID primary key", "updatedAt advances on modification" — DB-backed assertions covered by acceptance test)
- [x] 2.2 GREEN: Implement `src/entities/base.entity.ts` — abstract class, `@PrimaryKey` UUID v4 `id`, `@Property` `createdAt` (onCreate) and `updatedAt` (onUpdate)
- [x] 2.3 REFACTOR: Export from barrel; confirm strict-mode typing (no `any`)

## 3. pgvector Vector Type & HNSW Index Helper

- [x] 3.1 RED: Unit tests (pure) — `Vector(1536)` emits column type `vector(1536)`; serialize `[0.1,0.2,0.3]` → `[0.1,0.2,0.3]` literal; hydrate literal → numeric array; HNSW helper emits `USING hnsw (<col> vector_cosine_ops)` (`database-foundation` scenarios "Vector type declares fixed dimension column", "JS array serialized to pgvector literal", "pgvector literal hydrated to JS array", "HNSW index uses cosine operator class")
- [x] 3.2 GREEN: Implement `src/types/vector.type.ts` (MikroORM custom `Type`, dimension parameter) and the HNSW index DDL helper
- [x] 3.3 REFACTOR: Export both from barrel; document that dimension is migration-time, not runtime config

## 4. pgvector Extension Migration

- [x] 4.1 RED: Within the acceptance/harness path, assert migrate-up enables the `vector` extension and introduces no domain tables (`database-foundation` scenarios "Extension present after migrate-up", "Migration is idempotent-safe", "No domain tables introduced")
- [x] 4.2 GREEN: Create the first migration under `src/migrations/` running `CREATE EXTENSION IF NOT EXISTS vector`; no entity tables
- [x] 4.3 REFACTOR: Confirm migration filename/order is the earliest; verify re-running against an existing extension is a no-op

## 5. Migrator Configuration & Workflow

- [x] 5.1 RED: Unit test asserting the config's migrator settings — migrations path inside `packages/db`, `emit: 'ts'`, snapshot enabled, transactional enabled (`migration-tooling` scenarios "Migrations path and emit format", "Transactional migrations enabled", "Snapshotting enabled")
- [x] 5.2 GREEN: Add the `migrations` block to the exported config; verify `migration:create`/`migration:up`/`migration:down` scripts resolve the shared config (`migration-tooling` scenarios "migration:up applies pending migrations", "migration:down reverts the latest migration", "Scripts resolve the shared config")
- [x] 5.3 REFACTOR: Document in `packages/db` README the immutable-committed-migration convention (`migration-tooling` scenario "Correcting a committed migration")

## 6. NestJS DbModule

- [x] 6.1 RED: Integration test importing `DbModule` in an `@nestjs/testing` module against the test DB and resolving a usable `EntityManager` (`database-foundation` scenarios "Module provides an EntityManager", "Single config source")
- [x] 6.2 GREEN: Implement `src/db.module.ts` wrapping `MikroOrmModule.forRoot(mikroOrmConfig)` and re-exporting `MikroOrmModule` for downstream `forFeature`
- [x] 6.3 REFACTOR: Export `DbModule` from barrel; keep connection config single-sourced

## 7. Reusable Testcontainers DB Harness

- [x] 7.1 RED: Test the harness contract — boots a migrated pgvector DB, hands out a forked `EntityManager` per test, and resets state between tests (`database-foundation` scenarios "Harness boots a migrated database", "Fresh EntityManager fork per test", "State reset between tests")
- [x] 7.2 GREEN: Extend `src/test-helpers/` — boot one Postgres+pgvector container per suite, run migrations, expose ORM/`EntityManager` fork accessor and a reset hook that truncates non-bookkeeping tables (preserving the migrations table)
- [x] 7.3 REFACTOR: Export harness from a test-helpers barrel; keep the existing Redis container helper untouched

## 8. Acceptance Test — Outer Loop GREEN

- [x] 8.1 Confirm the acceptance integration test from group 0 passes end-to-end
- [x] 8.2 REFACTOR: Clean up the test-only fixture entity wiring and harness setup; ensure the fixture entity is not exported from the package's public barrel

## 9. Change Review — Subagent Verification

- [x] 9.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 9.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 10. Polish

- [x] 10.1 Run linter and fix all errors (`yarn lint`)
- [x] 10.2 Run formatter and apply fixes (`yarn format`)
- [x] 10.3 Run type checker with zero errors (`yarn workspace @readion/db typecheck`)
- [x] 10.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace @readion/db test:coverage`)
