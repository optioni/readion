# Spec: Migration Tooling

## Purpose

Defines the MikroORM migrator configuration, CLI scripts, and immutability conventions for database migrations in `packages/db`.

## Requirements

### Requirement: MikroORM migrator configuration

The shared MikroORM config SHALL configure the migrator so migrations live under a fixed directory in `packages/db`, are emitted as TypeScript, use snapshotting, and run each migration inside a transaction. The configuration MUST allow programmatic access to the migrator for both the CLI and the test harness.

#### Scenario: Migrations path and emit format

- **WHEN** a consumer reads the migrator settings from the exported config
- **THEN** the migrations path points inside `packages/db` and the emit format is TypeScript (`ts`)

#### Scenario: Transactional migrations enabled

- **WHEN** a consumer reads the migrator settings
- **THEN** per-migration transactions are enabled so a failed migration rolls back atomically

#### Scenario: Snapshotting enabled

- **WHEN** a consumer reads the migrator settings
- **THEN** snapshotting is enabled so `migration:create` diffs against the last known schema state

### Requirement: Migration create/up/down workflow

The package SHALL expose `migration:create`, `migration:up`, and `migration:down` scripts wired to the shared MikroORM config so migrations can be generated and applied from `packages/db`. Applying then reverting MUST leave the schema consistent.

#### Scenario: migration:up applies pending migrations

- **WHEN** `migration:up` runs against a fresh database
- **THEN** all pending migrations are applied and recorded in the migrations bookkeeping table

#### Scenario: migration:down reverts the latest migration

- **WHEN** `migration:down` runs after a successful `migration:up`
- **THEN** the most recently applied migration is reverted and removed from the bookkeeping table

#### Scenario: Scripts resolve the shared config

- **WHEN** any migration script is invoked
- **THEN** it loads the package's exported MikroORM config (not an ad-hoc inline config)

### Requirement: Committed migrations are immutable

The migration workflow SHALL treat committed migration files as immutable: schema corrections are made by creating a new migration, never by editing an already-committed one. This convention MUST be documented in `packages/db`.

#### Scenario: Correcting a committed migration

- **WHEN** a schema change is needed after a migration has been committed
- **THEN** the documented workflow is to run `migration:create` and produce a new migration file rather than modifying the existing committed file
