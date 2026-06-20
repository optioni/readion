## Why

Every domain feature (auth, certifications, content pipeline, sessions, agent) persists data through MikroORM in `packages/db`, but the scaffold only left a bare connection config — no NestJS integration, no entity conventions, no migration tooling, and no reusable test harness. Until this foundation exists, no downstream change can define an entity, run a migration, or write the Testcontainers-backed integration tests the project's outside-in TDD mandates. This change establishes that shared database layer once so every later change builds on it instead of reinventing it.

## What Changes

- Harden the shared MikroORM config in `packages/db`: snake_case underscore naming strategy, connection pool, and wired-in migrator + extension manager (so `vector` is created automatically and entities, once added, are discovered).
- Add `@mikro-orm/nestjs` and expose a reusable `DbModule` that both `apps/api` and `apps/worker` import via `MikroOrmModule.forRoot(mikroOrmConfig)` — a single source of connection truth shared across apps.
- Add a `BaseEntity` abstract class: UUID v4 primary key and managed `createdAt` / `updatedAt` timestamps, the convention every domain entity will extend.
- Add a reusable pgvector `Vector` custom type and an HNSW (`vector_cosine_ops`) index helper so entity-owning changes (e.g. `content-pipeline`'s `content_chunks`) declare embedding columns and ANN indexes consistently. The embedding dimension is fixed at the column/migration level here, not as runtime config.
- Author the **pgvector extension migration** (`CREATE EXTENSION IF NOT EXISTS vector`) — the one migration this change owns. No domain table is created.
- Configure MikroORM migration tooling: migrations directory under `packages/db`, TS emit, snapshotting, transactional per-migration, and the wired `migration:create` / `migration:up` / `migration:down` workflow. Establish the convention that committed migrations are never edited — a new migration is created instead.
- Extend the Testcontainers harness into a reusable DB test harness: boot Postgres+pgvector, run migrations, and hand each test a fresh `EntityManager` fork with state reset between tests. Every downstream integration test reuses this.

## Capabilities

### New Capabilities
- `database-foundation`: Shared MikroORM configuration, NestJS `DbModule` integration, `BaseEntity` conventions, pgvector `Vector` type + HNSW index helper, the pgvector extension migration, and the reusable Testcontainers DB test harness.
- `migration-tooling`: MikroORM migrator configuration and the `create`/`up`/`down` migration workflow rooted in `packages/db`, including the immutable-committed-migration convention.

### Modified Capabilities
<!-- None — this change introduces foundation capabilities only. -->

## Impact

- **Code**: `packages/db` (`src/mikro-orm.config.ts`, new `src/db.module.ts`, `src/entities/base.entity.ts`, `src/types/vector.type.ts`, `src/migrations/`, extended `src/test-helpers/`, `src/index.ts` barrel). No changes to `apps/*` yet — they consume `DbModule` in their own foundation changes.
- **Dependencies**: adds `@mikro-orm/nestjs` (and `@nestjs/common`/`@nestjs/core` peer context) to `packages/db`. Existing `@mikro-orm/*`, `pg`, `testcontainers` already present from scaffold.
- **Database**: introduces the `vector` extension via the first migration; no domain tables.
- **Entities owned**: none — `db-foundation` owns database setup only (extension migration + conventions + tooling), per the roadmap entity-ownership table.
- **Out of scope (owned elsewhere)**: the Kubernetes migration `Job` / `pre-sync` hook (SPEC "Database Migrations") belongs to `k8s-deployment`; the boot-time embedding-dimension-vs-column check belongs to the content/LLM changes that consume the `Vector` type.
- **Depends on**: `scaffold-monorepo` (archived).
- **Unblocks**: `api-foundation`, `worker-foundation`, and transitively every entity-owning change.
