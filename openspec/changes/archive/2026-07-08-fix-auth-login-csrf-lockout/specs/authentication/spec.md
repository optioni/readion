## MODIFIED Requirements

### Requirement: State-changing requests are CSRF-protected

The system SHALL protect cookie-authenticated, state-changing requests with a CSRF defense (double-submit token validated server-side together with `SameSite`). A state-changing request that relies on the refresh cookie but lacks a valid CSRF token MUST be rejected with `403`.

**Session-establishing endpoints are exempt.** `POST /api/v1/auth/login` and `POST /api/v1/auth/register` authenticate from body credentials, not from an ambient cookie, so the double-submit check is meaningless there and MUST NOT be applied. These endpoints MUST succeed even when a `refresh_token` cookie is present without a matching or valid `csrf_token` cookie/header. The exemption is expressed by marking those handlers exempt (a `@CsrfExempt()` metadata decorator honored by the CSRF guard); it MUST NOT weaken CSRF protection for any other cookie-authenticated state change (`refresh`, `logout`, `change-password`).

#### Scenario: Missing CSRF token is rejected on a protected endpoint

- **WHEN** a `POST /api/v1/auth/refresh` is sent with a valid refresh cookie but no matching CSRF token
- **THEN** the response is `403` RFC 7807 and no new tokens are issued

#### Scenario: Matching CSRF token is accepted

- **WHEN** the same request includes a CSRF token that matches the double-submit value
- **THEN** CSRF validation passes and the request proceeds

#### Scenario: Login is exempt even with a stale refresh cookie and no matching CSRF token

- **WHEN** `POST /api/v1/auth/login` is sent with correct credentials and a lingering `refresh_token` cookie but no matching or valid `csrf_token` cookie/header
- **THEN** the CSRF guard does not reject the request and the response is `200` with an access token
- **AND** a fresh `refresh_token` cookie and a fresh `csrf_token` cookie are reissued

#### Scenario: Register is exempt even with a stale refresh cookie and no matching CSRF token

- **WHEN** `POST /api/v1/auth/register` is sent with valid credentials and a lingering `refresh_token` cookie but no matching or valid `csrf_token` cookie/header
- **THEN** the CSRF guard does not reject the request and the response is `201`
- **AND** a fresh `refresh_token` cookie and a fresh `csrf_token` cookie are reissued

## ADDED Requirements

### Requirement: No permanent login lockout from a stale refresh cookie

The system SHALL guarantee that a lingering, expired, or mismatched `refresh_token` cookie can NEVER permanently block a user from authenticating. Because the CSRF guard rejects a cookie-bearing state change that lacks a valid `csrf_token`, the session-establishing endpoints (`login`, `register`) — the only requests that can reissue a fresh `csrf_token` cookie — MUST remain reachable regardless of any `refresh_token`/`csrf_token` cookie state. A successful `login` or `register` MUST reissue both the `refresh_token` and `csrf_token` cookies, restoring a consistent double-submit pair and thereby providing the recovery path out of any stale-cookie state.

#### Scenario: A stale refresh cookie without a csrf cookie does not lock the user out

- **WHEN** a browser holds a `refresh_token` cookie with no matching `csrf_token` cookie (e.g. after the csrf cookie expired or was cleared) and the user submits correct credentials to `POST /api/v1/auth/login`
- **THEN** login succeeds with `200` rather than `403`
- **AND** the response reissues a fresh `refresh_token` cookie and a fresh `csrf_token` cookie, so subsequent CSRF-protected requests (e.g. `refresh`) once again have a valid double-submit pair

#### Scenario: Recovery is possible without manually clearing cookies

- **WHEN** a user is in a stale-cookie state where `POST /api/v1/auth/refresh` returns `403`
- **THEN** the user can still reach and complete `POST /api/v1/auth/login` (or `register`) without first clearing any cookie
- **AND** completing it clears the lockout by reissuing a consistent `refresh_token` + `csrf_token` pair
