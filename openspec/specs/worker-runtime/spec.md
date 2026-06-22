## Purpose

Defines the foundational runtime for the headless NestJS worker application: how it boots, validates its configuration, and wires shared infrastructure (Redis, database, scheduling) that downstream capabilities depend on.

## Requirements

### Requirement: Headless NestJS application context

The worker SHALL boot as a NestJS application context (`NestFactory.createApplicationContext`) with no HTTP server, no route listener, no `/api/v1` prefix, and no Swagger surface. The bootstrap MUST enable shutdown hooks so that on `SIGTERM`/`SIGINT` the BullMQ/Redis connections and the MikroORM connection are closed gracefully before the process exits.

#### Scenario: Boot exposes no HTTP listener

- **WHEN** the worker is bootstrapped from `main.ts`
- **THEN** the created instance is an application context (it has no `listen`/HTTP adapter) and the process does not bind a TCP port

#### Scenario: Application context resolves the root module

- **WHEN** the worker is bootstrapped via `@nestjs/testing` against the root module
- **THEN** the context initializes successfully and the `ConfigModule`, `DbModule`, `RedisModule`, and BullMQ + schedule roots are all resolvable from the container

#### Scenario: Shutdown hooks close connections

- **WHEN** the application context receives `app.close()` (the path a `SIGTERM` triggers)
- **THEN** the shared Redis connection is quit and the MikroORM connection is closed without throwing

### Requirement: Fail-fast validated configuration

The worker SHALL validate all environment variables at startup with a Zod schema loaded through `@nestjs/config`, reusing the `@readion/shared` env helpers. The base schema MUST cover the variables the runtime itself consumes — `DATABASE_URL`, `REDIS_URL`, `SCRAPPER_URL`, and `NODE_ENV` — and MUST be additively extensible by downstream changes. Boot MUST fail with an error naming the offending variable when a required variable is missing or malformed.

#### Scenario: Valid config exposes typed values

- **WHEN** the schema parses an env object with valid `DATABASE_URL`, `REDIS_URL`, `SCRAPPER_URL`, and `NODE_ENV=development`
- **THEN** parsing succeeds and the typed config exposes each value, with `NODE_ENV` defaulting to `development` when omitted

#### Scenario: Boot fails when a required variable is missing

- **WHEN** the schema parses an env object with `REDIS_URL` absent
- **THEN** validation throws an error whose message names `REDIS_URL`

#### Scenario: Boot fails when a URL variable is malformed

- **WHEN** the schema parses an env object where `SCRAPPER_URL` is `"not-a-url"`
- **THEN** validation throws an error whose message names `SCRAPPER_URL`

### Requirement: Shared Redis connection provider

The worker SHALL provide a single shared `ioredis` connection, built from the validated `REDIS_URL`, exposed under an injection token and reused by BullMQ (and later worker code). The connection MUST be quit when its module is destroyed.

#### Scenario: Redis client is injectable and responds to PING

- **WHEN** a `@nestjs/testing` context resolves the Redis client token against a real Redis Testcontainer
- **THEN** the provider resolves an `ioredis` client that answers `PING` with `PONG`

#### Scenario: Connection is closed on shutdown

- **WHEN** the module is destroyed (`app.close()`)
- **THEN** the shared Redis client transitions to an `end` state and issues no further commands

### Requirement: Shared database connection via DbModule

The worker SHALL import `DbModule` from `@readion/db` to share the MikroORM connection and conventions rather than configuring its own ORM. The worker introduces no entity and no migration of its own.

#### Scenario: EntityManager is resolvable in the worker context

- **WHEN** a `@nestjs/testing` context backed by the `@readion/db` Testcontainers harness resolves the MikroORM `EntityManager`
- **THEN** the manager is resolvable and connected to the migrated test database

#### Scenario: No worker-owned migration is added

- **WHEN** the change's source tree is inspected
- **THEN** `apps/worker` contains no migration files and `packages/db/src/migrations` gains no migration attributable to this change

### Requirement: Scheduling foundation

The worker SHALL register `@nestjs/schedule` (`ScheduleModule.forRoot()`) at the root so downstream changes can declare `@Cron` jobs, without defining any concrete cron job in this change.

#### Scenario: Schedule registry is available

- **WHEN** the worker context is initialized
- **THEN** the `@nestjs/schedule` `SchedulerRegistry` is resolvable from the container and reports zero registered cron jobs
