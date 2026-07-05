# db-migration-job

## Purpose

Defines the MikroORM migration `Job` that runs `mikro-orm migration:up` against the production database as an ArgoCD `pre-sync` hook — ordered before the API and worker pods roll and gating the rollout on migration success. This capability runs the migrations owned by `db-foundation` and the feature changes; it authors none itself.

## Requirements

### Requirement: MikroORM migrations run as a Kubernetes Job

Database migrations SHALL run as a Kubernetes `Job` that executes `mikro-orm migration:up` against the production database. The Job's image SHALL bundle the compiled `packages/db` migrations and MikroORM configuration so the CLI can locate and apply them, and it SHALL read the database connection string from the same `Secret` the application workloads use. This change authors no migrations itself — it only runs the migrations owned by `db-foundation` and the feature changes.

#### Scenario: Migration Job applies pending migrations

- **WHEN** the migration `Job` runs
- **THEN** it executes `mikro-orm migration:up` against the database referenced by the `DATABASE_URL` secret
- **AND** its image contains the compiled `packages/db` migrations and MikroORM config

#### Scenario: Job image is pinned to the rollout digest

- **WHEN** a rollout to a new image digest occurs
- **THEN** the migration `Job` runs the migrations built at that same `sha-*` digest so schema and application code move together

### Requirement: Migrations run before app pods via a pre-sync hook

The migration `Job` SHALL be wired as an ArgoCD `pre-sync` hook so that it runs to completion before the new api and worker pods are started. The hook SHALL declare a delete policy that prevents a prior Job instance from blocking a subsequent sync.

#### Scenario: Job carries the pre-sync hook annotation

- **WHEN** the migration `Job` manifest is inspected
- **THEN** it declares `argocd.argoproj.io/hook: PreSync` and a hook-delete policy

#### Scenario: Migrations complete before app rollout

- **WHEN** ArgoCD syncs a new revision
- **THEN** the migration `Job` runs and succeeds before the api and worker `Deployment`s roll to the new image

### Requirement: A failed migration blocks the rollout

If the migration `Job` fails, the ArgoCD sync SHALL fail and the api and worker pods SHALL NOT be rolled to the new image, leaving the previous healthy version running.

#### Scenario: Failed migration halts the sync

- **WHEN** the migration `Job` exits non-zero
- **THEN** the ArgoCD sync fails at the pre-sync phase
- **AND** the api and worker workloads are not updated to the new image
