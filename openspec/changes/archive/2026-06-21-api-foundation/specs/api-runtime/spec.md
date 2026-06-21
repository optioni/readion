## ADDED Requirements

### Requirement: Global API version prefix

The API SHALL serve all routes under the `/api/v1` prefix. The health probe (`/health`) and the development OpenAPI document (`/api-json`) are the only routes exempt from the version prefix.

#### Scenario: Versioned route is reachable under the prefix

- **WHEN** a GET request is made to `/api/v1/health` — and the same handler is mounted at the versioned path
- **THEN** the response status is 200

#### Scenario: Unprefixed application route is not found

- **WHEN** a GET request is made to an application route without the `/api/v1` prefix (e.g. `/certifications`)
- **THEN** the response status is 404

#### Scenario: Health probe is exempt from the version prefix

- **WHEN** a GET request is made to `/health`
- **THEN** the response status is 200 and the route resolves without the `/api/v1` prefix

### Requirement: Single-resource response envelope

A global `ResponseInterceptor` SHALL wrap a controller return value that is a single resource object into the shared `SingleResourceEnvelope` shape `{ data, relationships? }`, without controllers wrapping it manually. A value already shaped as an envelope (already containing a top-level `data` key) SHALL be passed through unchanged.

#### Scenario: Plain object is wrapped in a data envelope

- **WHEN** a controller returns `{ id: "1", name: "AWS Cloud Practitioner" }` with HTTP 200
- **THEN** the response body is `{ "data": { "id": "1", "name": "AWS Cloud Practitioner" } }`

#### Scenario: Already-enveloped value is passed through

- **WHEN** a controller returns a value that already has a top-level `data` key (e.g. `{ data: {...}, meta: {...} }`)
- **THEN** the response body equals that value, not double-wrapped (no `data.data`)

### Requirement: Collection response envelope

The `ResponseInterceptor` SHALL recognise a paginated collection result and emit the shared `CollectionEnvelope` shape `{ data: [...], meta: { total, page, limit } }`. A controller returning a bare array with pagination metadata SHALL be wrapped so that `data` holds the items and `meta` holds `total`, `page`, and `limit`.

#### Scenario: Collection result carries pagination meta

- **WHEN** a controller returns a collection result with items `[a, b]` and pagination `{ total: 100, page: 1, limit: 25 }`
- **THEN** the response body is `{ "data": [a, b], "meta": { "total": 100, "page": 1, "limit": 25 } }`

### Requirement: RFC 7807 problem-details exception filter

A global `ExceptionFilter` SHALL convert every thrown `HttpException` and every unhandled error into an RFC 7807 `ProblemDetails` body `{ type, title, status, detail, errors? }` with `Content-Type: application/problem+json`, using the shared `ERROR_TYPES` for the `type` field. The HTTP status of the response MUST equal the `status` field in the body.

#### Scenario: NotFoundException becomes a problem-details body

- **WHEN** a handler throws a NestJS `NotFoundException` with message "Certification not found"
- **THEN** the response status is 404, `Content-Type` is `application/problem+json`, and the body is `{ "type": "/errors/not-found", "title": ..., "status": 404, "detail": "Certification not found" }`

#### Scenario: Unhandled error becomes a 500 problem-details body without leaking internals

- **WHEN** a handler throws a non-HTTP `Error("boom")`
- **THEN** the response status is 500, the body `type` is `/errors/internal-server-error`, `status` is 500, and `detail` does not contain the raw stack trace

### Requirement: Global validation pipe

The API SHALL register a global `ValidationPipe` using `class-validator` and `class-transformer`, configured to whitelist (strip) unknown properties and transform payloads to their DTO types. A request body that fails validation SHALL be rendered through the problem-details filter with status 422 and a populated `errors` array mapping each failing field to a message.

#### Scenario: Invalid body yields a 422 validation problem

- **WHEN** a request is sent to an endpoint whose DTO requires a non-empty string `email`, with body `{ "email": "" }`
- **THEN** the response status is 422, the body `type` is `/errors/validation-error`, and `errors` contains an item with `field: "email"` and a non-empty `message`

#### Scenario: Unknown properties are stripped before the handler

- **WHEN** a request body includes a property not declared on the DTO (e.g. `{ "email": "a@b.com", "isAdmin": true }`)
- **THEN** the handler receives the DTO without the `isAdmin` property

### Requirement: Fail-fast environment validation

The API SHALL validate its environment variables against a Zod schema at startup via `@nestjs/config`, exposing a typed config service. If a required variable is missing or malformed, the application MUST refuse to boot and emit an error that names the offending variable(s). The base schema MUST include the database connection URL, Redis connection URL, allowed CORS origin(s), the rate-limit TTL/limit overrides, and the HTTP port plus runtime environment; downstream changes extend the schema additively.

#### Scenario: Boot fails when a required variable is missing

- **WHEN** the application boots with `DATABASE_URL` unset
- **THEN** startup throws before the HTTP server begins listening and the error message references `DATABASE_URL`

#### Scenario: Boot fails when a variable is malformed

- **WHEN** the application boots with `PORT` set to a non-numeric value like `"abc"`
- **THEN** startup throws before listening and the error message references `PORT`

#### Scenario: Valid config exposes typed values

- **WHEN** the application boots with all required variables present and valid
- **THEN** the config service returns the parsed, typed values (e.g. `PORT` as a number) and the server begins listening
