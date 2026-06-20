## ADDED Requirements

### Requirement: Reusable Zod env-validation helpers

The shared package SHALL export pure (no I/O) Zod-based helpers for validating environment variables — at minimum a required URL, a coerced port/number, and a coerced boolean — reusable across `apps/api` and `apps/worker`.

#### Scenario: Valid URL accepted

- **WHEN** the URL helper parses `'postgres://localhost:5432/readion'`
- **THEN** parsing succeeds and returns the string value

#### Scenario: Coerced number from string

- **WHEN** the numeric helper parses the string `'9090'`
- **THEN** parsing succeeds and returns the number `9090`

#### Scenario: Malformed value rejected

- **WHEN** the URL helper parses `'not-a-url'`
- **THEN** parsing fails with a Zod validation error

### Requirement: Shared env var definitions

The shared package SHALL export reusable schema fragments for env vars common across apps, including a database URL and a Redis URL, so the same variable validates identically wherever consumed.

#### Scenario: Composing fragments into an app schema

- **WHEN** an app builds `z.object({ ...databaseUrlFragment, ...redisUrlFragment })` and parses `{ DATABASE_URL: 'postgres://localhost:5432/readion', REDIS_URL: 'redis://localhost:6379' }`
- **THEN** parsing succeeds and the result carries both validated values

### Requirement: Fail-fast validation contract

The shared env helpers SHALL support validating the full environment such that a missing or malformed required variable produces a clear error, and parsing MUST report every offending variable rather than only the first.

#### Scenario: Missing required variable named

- **WHEN** a composed schema requiring `DATABASE_URL` parses an object that omits it
- **THEN** parsing fails and the error identifies `DATABASE_URL` as the missing variable

#### Scenario: All offenders reported

- **WHEN** a composed schema requiring both `DATABASE_URL` and `REDIS_URL` parses an object where both are absent
- **THEN** the parse failure lists both `DATABASE_URL` and `REDIS_URL`, not just the first
