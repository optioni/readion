# openapi-client

## Purpose

Defines OpenAPI document generation from NestJS decorators, the development-only `/api-json` endpoint, and the Orval pipeline that produces committed typed `@tanstack/vue-query` composables for the web app.

## Requirements

### Requirement: OpenAPI document generation

The API SHALL build an OpenAPI document from its NestJS decorators using `@nestjs/swagger`. The document MUST describe the response envelope and RFC 7807 problem-details shapes so generated clients are typed against the real contract. The document MUST be buildable in tests without starting the HTTP server.

#### Scenario: OpenAPI document builds with API metadata

- **WHEN** the OpenAPI document factory runs against the application module
- **THEN** it returns a valid OpenAPI 3 document with a title, a version, and the registered routes (including `/api/v1/...` paths) present in `paths`

### Requirement: Development-only raw OpenAPI endpoint

The raw OpenAPI JSON SHALL be served at `/api-json` only when the runtime environment is development; the Swagger UI and `/api-json` MUST be disabled in production. Orval consumes `/api-json` locally during development.

#### Scenario: api-json available in development

- **WHEN** the application boots with the runtime environment set to development and a GET request is made to `/api-json`
- **THEN** the response status is 200 and the body is the OpenAPI JSON document

#### Scenario: api-json disabled in production

- **WHEN** the application boots with the runtime environment set to production and a GET request is made to `/api-json`
- **THEN** the response status is 404

### Requirement: Committed Orval typed-client pipeline

The repository SHALL provide an Orval configuration and a `yarn codegen` script that reads the API's OpenAPI spec and generates typed `@tanstack/vue-query` composables into `apps/web/src/api/`. The generated client is committed to the repository; CI consumes the committed output and never regenerates it.

#### Scenario: Orval config targets the API spec and the web client directory

- **WHEN** the Orval configuration is read
- **THEN** its input resolves to the API OpenAPI spec (the `/api-json` document) and its output target is `apps/web/src/api/` producing `@tanstack/vue-query` clients

#### Scenario: codegen script is invocable from the workspace root

- **WHEN** `yarn codegen` is listed in the workspace
- **THEN** it runs Orval against the configured spec and writes the generated client into `apps/web/src/api/`
