## Purpose

Docker Compose service stack and per-app environment configuration that enables a developer to run all dependencies locally with a single command.

## Requirements

### Requirement: Docker Compose service stack

A root `docker-compose.yml` SHALL define three services — `postgres` (with the pgvector extension available), `redis`, and `scrapper` (amerkurev/scrapper) — that a developer can start with a single command.

#### Scenario: Services start and become reachable

- **WHEN** a developer runs `docker compose up -d`
- **THEN** the `postgres`, `redis`, and `scrapper` containers start and report healthy/running
- **THEN** Postgres accepts TCP connections on its mapped port and Redis responds to `PING` with `PONG`

#### Scenario: pgvector extension is installable

- **WHEN** `CREATE EXTENSION IF NOT EXISTS vector;` is executed against the running `postgres` service
- **THEN** the statement succeeds and `vector` appears in `pg_extension`

#### Scenario: Scrapper answers over HTTP

- **WHEN** an HTTP request is made to the running `scrapper` service's base URL
- **THEN** the service responds (non-connection-refused), confirming the sidecar is reachable from the worker

### Requirement: Per-app environment contracts

Each runnable app (`apps/api`, `apps/web`, `apps/worker`) SHALL ship a `.env.example` at its root documenting the variables it requires.

#### Scenario: Each app declares its env example

- **WHEN** the repository is inspected
- **THEN** `apps/api/.env.example`, `apps/web/.env.example`, and `apps/worker/.env.example` all exist

#### Scenario: Copying the example yields a runnable config

- **WHEN** a developer copies `apps/api/.env.example` to `apps/api/.env`, fills the documented values, and the Docker Compose stack is running
- **THEN** `apps/api` starts in development against those services without missing-variable errors

### Requirement: Testcontainers-based integration harness

The test setup SHALL allow integration tests to provision real Postgres (with pgvector) and Redis via Testcontainers, without depending on a pre-running dev stack.

#### Scenario: Integration tests provision their own services

- **WHEN** an integration test that requests a Postgres + Redis container runs via `yarn test` with no Docker Compose stack already up
- **THEN** Testcontainers starts the containers, the test connects to them, and the suite exits `0`
