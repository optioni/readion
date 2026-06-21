# security-middleware

## Purpose

Defines global security middleware for the NestJS API: Helmet security headers (including a CSP that permits SSE and the configured frontend origin) and CORS restricted to the configured allowed origin(s) with credentials enabled.

## Requirements

### Requirement: Helmet security headers

The API SHALL apply `helmet` globally so that every response carries security headers: a Content-Security-Policy, HSTS (`Strict-Transport-Security`), `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`. The CSP MUST permit Server-Sent Events connections from the API's own origin and asset loads from the configured Nuxt frontend origin, so the streaming agent and the web app are not blocked.

#### Scenario: Standard security headers present on a response

- **WHEN** a GET request is made to any API route
- **THEN** the response includes `X-Content-Type-Options: nosniff`, an `X-Frame-Options` header, a `Referrer-Policy` header, a `Strict-Transport-Security` header, and a `Content-Security-Policy` header

#### Scenario: CSP allows the configured frontend origin and same-origin connections

- **WHEN** the application boots with the frontend origin configured (e.g. `http://localhost:3000`)
- **THEN** the emitted `Content-Security-Policy` `connect-src`/`default-src` directives include the API's own origin (for SSE) and the configured frontend origin

### Requirement: CORS restricted to the configured frontend origin

The API SHALL enable CORS only for the frontend origin(s) read from validated config, with credentials enabled (so the httpOnly auth cookie is accepted on cross-origin requests). A request from a disallowed origin MUST NOT receive an `Access-Control-Allow-Origin` header echoing that origin. In development the default allowed origin is `http://localhost:3000`.

#### Scenario: Allowed origin receives CORS headers with credentials

- **WHEN** a request carries `Origin: http://localhost:3000` and the configured allowed origin is `http://localhost:3000`
- **THEN** the response includes `Access-Control-Allow-Origin: http://localhost:3000` and `Access-Control-Allow-Credentials: true`

#### Scenario: Disallowed origin is not echoed

- **WHEN** a request carries `Origin: https://evil.example` and that origin is not in the configured allow-list
- **THEN** the response does not include `Access-Control-Allow-Origin: https://evil.example`

#### Scenario: Preflight for an allowed origin succeeds

- **WHEN** an `OPTIONS` preflight request is made from `http://localhost:3000` with `Access-Control-Request-Method: POST`
- **THEN** the response permits the method and reflects the allowed origin
