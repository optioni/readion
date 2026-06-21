# health-checks

## Purpose

Defines the `GET /health` endpoint that reports liveness and readiness for Kubernetes probes, checking PostgreSQL, Redis, and disk-storage dependencies.

## Requirements

### Requirement: Health endpoint with dependency checks

The API SHALL expose `GET /health` via `@nestjs/terminus` that reports the liveness/readiness of the service and its critical dependencies: PostgreSQL connectivity (through the shared `DbModule` connection), Redis connectivity, and a disk-storage threshold check. The endpoint MUST be reachable without the `/api/v1` version prefix and without authentication, so it can serve as a Kubernetes liveness and readiness probe.

#### Scenario: All dependencies healthy returns 200

- **WHEN** a GET request is made to `/health` while Postgres and Redis are reachable and disk is below the threshold
- **THEN** the response status is 200 and the body reports `status: "ok"` with `postgres`, `redis`, and `disk` (or `storage`) entries marked up

#### Scenario: Health endpoint requires no version prefix and no auth

- **WHEN** an unauthenticated GET request is made to `/health` (not `/api/v1/health`)
- **THEN** the response resolves (status 200 when healthy) without an authentication challenge

#### Scenario: A down dependency yields a 503

- **WHEN** a GET request is made to `/health` while Redis is unreachable
- **THEN** the response status is 503 and the body marks the `redis` check as down while still reporting the other checks
