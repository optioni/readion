## MODIFIED Requirements

### Requirement: Credentialed fetch mutator for the generated client

The Orval-generated client SHALL route every request through a custom fetch mutator that prefixes `runtimeConfig.public.apiBaseUrl` and sends `credentials: 'include'`, so the `httpOnly` refresh-token cookie and CORS-credentialed requests function. The Orval codegen pipeline (`orval.config.ts`, `yarn codegen`) is owned by `api-foundation`; this change only configures the runtime mutator it calls.

The mutator SHALL additionally:
- Attach an `Authorization: Bearer <accessToken>` header when the auth store holds an access token, and omit the header when it does not.
- On unsafe (state-changing) HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`), echo the value of the non-`httpOnly` `csrf_token` cookie into the `x-csrf-token` request header, so the API's double-submit CSRF check passes.
- On a `401` response, attempt a single silent refresh via `POST /api/v1/auth/refresh`; if it succeeds, store the new access token and retry the original request once with the refreshed token; if it fails, clear the auth store and surface the original `401` as a typed error. The retry MUST NOT loop more than once.

#### Scenario: Requests are sent with credentials and the configured base URL

- **WHEN** a generated client method is invoked in a test with a mocked fetch
- **THEN** the request URL begins with `runtimeConfig.public.apiBaseUrl`
- **THEN** the request is issued with `credentials: 'include'`

#### Scenario: Mutator targets the committed generated client directory

- **WHEN** the Orval output configuration is inspected
- **THEN** it is configured to use the custom mutator for the client generated into `apps/web/src/api/`

#### Scenario: Access token is attached when present

- **WHEN** the auth store holds an access token and a generated client method is invoked
- **THEN** the request carries an `Authorization: Bearer <accessToken>` header
- **WHEN** the auth store holds no access token
- **THEN** the request carries no `Authorization` header

#### Scenario: CSRF token is echoed on state-changing requests

- **WHEN** a `POST` (or other unsafe method) request is issued and a `csrf_token` cookie is present
- **THEN** the request carries an `x-csrf-token` header equal to the `csrf_token` cookie value
- **WHEN** a `GET` request is issued
- **THEN** no `x-csrf-token` header is added

#### Scenario: A 401 triggers a single silent refresh and retry

- **WHEN** a request returns `401` and `POST /auth/refresh` then succeeds with a new access token
- **THEN** the mutator stores the new token and retries the original request exactly once with it
- **AND** the retried response is returned to the caller

#### Scenario: A failed refresh clears the store and surfaces the 401

- **WHEN** a request returns `401` and the subsequent `POST /auth/refresh` also returns `401`
- **THEN** the auth store is cleared (no access token, no user)
- **AND** the mutator rejects with the typed `401` error without retrying again
