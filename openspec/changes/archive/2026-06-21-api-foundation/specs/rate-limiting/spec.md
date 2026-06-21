## ADDED Requirements

### Requirement: Redis-backed throttler with named tiers

The API SHALL configure `@nestjs/throttler` to store request counters in the existing Redis instance (so limits hold across multiple API replicas) and SHALL define three named tiers read from validated config with documented defaults: an `auth` tier (10 requests / 15 minutes), an `agent` tier (30 requests / minute), and a `general` tier (300 requests / minute). The TTL and limit of each tier MUST be overridable via environment configuration.

#### Scenario: Counters persist in Redis

- **WHEN** the throttler module is configured
- **THEN** its storage adapter targets the configured Redis connection rather than in-memory storage

#### Scenario: Named tiers carry the documented defaults

- **WHEN** no tier overrides are set in the environment
- **THEN** the `auth` tier resolves to limit 10 / ttl 15 min, the `agent` tier to 30 / 1 min, and the `general` tier to 300 / 1 min

### Requirement: Global throttler guard with the general tier

The throttler guard SHALL be registered globally so the `general` tier applies to every route by default. When a client exceeds the limit, the API MUST respond with HTTP 429 rendered through the problem-details filter (RFC 7807 body), and the response SHALL include a `Retry-After` header.

#### Scenario: Requests under the limit succeed

- **WHEN** a client makes requests below the `general` tier limit within the window
- **THEN** each response status is the handler's normal status (not 429)

#### Scenario: Exceeding the general limit yields a 429 problem-details body

- **WHEN** a client exceeds the configured `general` tier limit within the window
- **THEN** the response status is 429, the body is an RFC 7807 problem-details object, and a `Retry-After` header is present

### Requirement: Per-route tier override decorator

The change SHALL expose a decorator (or named-throttler mechanism) that lets a downstream route opt into a stricter tier than the global `general` default — specifically the `auth` tier for credential endpoints and the `agent` tier for the SSE endpoint. Applying an override to a handler MUST cause that handler to be limited by the named tier rather than the global default.

#### Scenario: A route annotated with the auth tier uses the strict limit

- **WHEN** a test handler is annotated to use the `auth` tier and receives more than 10 requests within 15 minutes from one IP
- **THEN** the request beyond the limit returns 429 while a route under the global tier at the same request count still succeeds
