# Spec: Database Foundation

## Purpose

Defines the shared MikroORM configuration, NestJS integration module, base entity conventions, pgvector support, and test harness used by all apps in the monorepo.

## Requirements

### Requirement: Shared MikroORM configuration

The `packages/db` package SHALL export a single MikroORM PostgreSQL configuration object that is the sole source of connection truth for both `apps/api` and `apps/worker`. The configuration MUST use a snake_case underscore naming strategy (so a `createdAt` property maps to a `created_at` column and an entity `ContentChunk` maps to a `content_chunks` table), read connection parameters from the environment, and enable a connection pool.

#### Scenario: Naming strategy maps camelCase to snake_case

- **WHEN** the exported config's naming strategy converts the property name `createdAt`
- **THEN** it returns the column name `created_at`

#### Scenario: Entity class name maps to snake_case plural table

- **WHEN** the exported config's naming strategy derives a table name from the class name `ContentChunk`
- **THEN** it returns `content_chunks`

#### Scenario: Connection driver is PostgreSQL

- **WHEN** a consumer reads the exported config
- **THEN** the driver/dialect is PostgreSQL and the host, port, dbName, user, and password resolve from environment variables with documented defaults

### Requirement: NestJS DbModule integration

The package SHALL export a NestJS `DbModule` that wraps `MikroOrmModule.forRoot` using the shared config, so that `apps/api` and `apps/worker` obtain a working `EntityManager` by importing one module. The module MUST be importable without throwing during NestJS dependency resolution.

#### Scenario: Module provides an EntityManager

- **WHEN** a NestJS test module imports `DbModule` against a running Postgres instance and resolves `EntityManager`
- **THEN** resolution succeeds and the resolved `EntityManager` can execute a trivial query (e.g. `SELECT 1`)

#### Scenario: Single config source

- **WHEN** `DbModule` is constructed
- **THEN** it uses the package's exported MikroORM config rather than redefining connection parameters inline

### Requirement: BaseEntity conventions

The package SHALL export an abstract `BaseEntity` class that every domain entity extends. It MUST define a UUID v4 primary key named `id` and managed `createdAt` and `updatedAt` timestamp columns, where `updatedAt` is refreshed on update.

#### Scenario: New entity receives a UUID primary key

- **WHEN** an entity extending `BaseEntity` is persisted and flushed
- **THEN** its `id` is populated with a valid UUID v4 string

#### Scenario: Timestamps populated on insert

- **WHEN** an entity extending `BaseEntity` is persisted and flushed
- **THEN** both `createdAt` and `updatedAt` are set to non-null `Date` values

#### Scenario: updatedAt advances on modification

- **WHEN** a persisted entity is modified and flushed a second time at a later instant
- **THEN** its `updatedAt` is greater than its original `updatedAt` while `createdAt` is unchanged

### Requirement: pgvector Vector type and HNSW index helper

The package SHALL export a reusable MikroORM custom `Vector` type representing a pgvector `vector(N)` column of a caller-specified dimension, plus a helper that emits an HNSW index using the `vector_cosine_ops` operator class for such a column. The embedding dimension MUST be fixed at the column definition (migration) level, not read from runtime configuration.

#### Scenario: Vector type declares fixed dimension column

- **WHEN** the `Vector` type produces the column DDL for dimension `1536`
- **THEN** the generated column type is `vector(1536)`

#### Scenario: JS array serialized to pgvector literal

- **WHEN** the `Vector` type converts the JS value `[0.1, 0.2, 0.3]` to its database representation
- **THEN** it produces the pgvector literal `[0.1,0.2,0.3]`

#### Scenario: pgvector literal hydrated to JS array

- **WHEN** the `Vector` type converts the database value `[0.1,0.2,0.3]` back to a JS value
- **THEN** it returns the numeric array `[0.1, 0.2, 0.3]`

#### Scenario: HNSW index uses cosine operator class

- **WHEN** the index helper generates DDL for an embedding column
- **THEN** the statement creates an `hnsw` index `USING hnsw (<column> vector_cosine_ops)`

### Requirement: pgvector extension migration

The package SHALL include the first migration, owned by this change, that enables the `vector` extension. Running migrations against a fresh database MUST make the `vector` extension available; no domain table is created by this change.

#### Scenario: Extension present after migrate-up

- **WHEN** all migrations are applied to a fresh Postgres (pgvector image) database
- **THEN** querying `pg_extension` shows `vector` is installed

#### Scenario: Migration is idempotent-safe

- **WHEN** the extension migration runs against a database where `vector` already exists
- **THEN** it completes without error (uses `CREATE EXTENSION IF NOT EXISTS`)

#### Scenario: No domain tables introduced

- **WHEN** migrations finish on a fresh database
- **THEN** the only schema artifacts are the migrations bookkeeping table and the `vector` extension — no domain entity tables

### Requirement: Reusable Testcontainers DB harness

The package SHALL export a test harness that boots a Postgres+pgvector container, applies all migrations, and provides each test a usable MikroORM context with state reset between tests, so every downstream integration test reuses one harness instead of mocking the database. Database mocking MUST NOT be required for integration tests.

#### Scenario: Harness boots a migrated database

- **WHEN** a test calls the harness setup
- **THEN** it returns a connected MikroORM ORM/`EntityManager` whose schema reflects all applied migrations (the `vector` extension is present)

#### Scenario: Fresh EntityManager fork per test

- **WHEN** a test requests an `EntityManager` from the harness
- **THEN** it receives a forked `EntityManager` with its own identity map, isolated from other tests

#### Scenario: State reset between tests

- **WHEN** one test persists rows and a subsequent test runs after the harness reset hook
- **THEN** the subsequent test observes no rows left over from the previous test
