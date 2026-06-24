## Purpose

Specifies the browser-side authentication layer for the Nuxt web app: in-memory token storage, auth pages (login, register, email verification, password reset), silent token refresh on load, logout, and route middleware that protects authenticated routes and gates auth-only pages.

## Requirements

### Requirement: Auth store holds the access token in memory only

The web app SHALL provide a Pinia auth store that holds the JWT access token in reactive in-memory state and MUST NEVER persist it to `localStorage`, `sessionStorage`, or a cookie. The store SHALL expose the current authenticated user (when hydrated), an `isAuthenticated` getter derived from the presence of a valid access token, and actions to set/clear the token and user.

#### Scenario: Access token is never written to web storage

- **WHEN** a unit test sets an access token on the auth store via its login/refresh action
- **THEN** the token is readable from the store's reactive state
- **AND** `localStorage` and `sessionStorage` contain no entry holding the token value

#### Scenario: Authentication status reflects token presence

- **WHEN** the store has no access token
- **THEN** `isAuthenticated` is `false`
- **WHEN** the store is given a non-expired access token
- **THEN** `isAuthenticated` is `true`

### Requirement: Login page authenticates and routes into the app

The web app SHALL expose a `/login` page with email and password fields. On submit it MUST call `POST /api/v1/auth/login`, store the returned access token in memory, hydrate the current user from `GET /api/v1/users/me`, and navigate to the post-login destination (the originally requested route, or the app home when none). A `401` MUST surface a single uniform "invalid email or password" message without revealing which field was wrong.

#### Scenario: Successful login lands in the app

- **WHEN** a registered user submits correct credentials on `/login`
- **THEN** the access token from the `200` response body is held in the auth store
- **AND** the user profile from `GET /users/me` populates the store
- **AND** the app navigates away from `/login` to the post-login destination

#### Scenario: Invalid credentials show a uniform error

- **WHEN** the login request returns `401`
- **THEN** the page shows a single "invalid email or password" message
- **AND** the access token in the store remains empty and the user stays on `/login`

### Requirement: Registration page creates an account and signs the user in

The web app SHALL expose a `/register` page with email and password fields enforcing the same minimum password rule as the API (at least 8 characters) before submit. On success (`POST /api/v1/auth/register`, `201`) it MUST store the access token, hydrate the user, and route the now-signed-in user onward. A `422` from the API MUST render the field-level problem-details errors. A `409`/duplicate-email response MUST surface an "email already registered" message.

#### Scenario: Successful registration signs the user in

- **WHEN** a visitor submits a valid email and an 8+ character password on `/register`
- **THEN** the access token from the `201` response is held in the store and the user is hydrated
- **AND** the app navigates onward to the post-registration destination

#### Scenario: Validation errors are shown per field

- **WHEN** the register request returns `422` with `errors` for the `password` field
- **THEN** the page renders the field-level message from the problem-details `errors` array
- **AND** no access token is stored

### Requirement: Email verification page consumes the link token

The web app SHALL expose a verification page (e.g. `/verify-email`) that reads the `token` from the URL the verification email links to, calls `POST /api/v1/auth/verify-email` with it, and shows a success state on `200` or an "invalid or expired link" state otherwise. A signed-in but unverified user SHALL be offered a "resend verification email" action that calls `POST /api/v1/auth/resend-verification`.

#### Scenario: Valid token verifies the email

- **WHEN** the verification page loads with a valid `token` query parameter
- **THEN** it POSTs the token to `/auth/verify-email` and renders a success confirmation

#### Scenario: Invalid token shows an error state

- **WHEN** the verification request returns a non-2xx (invalid or already-consumed token)
- **THEN** the page renders an "invalid or expired link" state rather than a success state

#### Scenario: Unverified user can resend the verification email

- **WHEN** a signed-in, not-yet-verified user triggers the resend action
- **THEN** the app calls `POST /auth/resend-verification` and shows a "verification email sent" confirmation

### Requirement: Forgot-password page requests a reset link

The web app SHALL expose a `/forgot-password` page that collects an email and calls `POST /api/v1/auth/forgot-password`. Regardless of the response it MUST show the same "if an account exists, a reset link has been sent" confirmation, so account existence is never revealed.

#### Scenario: Request always shows the same confirmation

- **WHEN** the user submits any email and the API responds `202`
- **THEN** the page shows the neutral "if an account exists, a reset link has been sent" message
- **AND** the message is identical whether or not the email maps to a real account

### Requirement: Reset-password page validates the token then sets a new password

The web app SHALL expose a `/reset-password` page that first validates the URL `token` via `GET /api/v1/auth/reset-password?token=`. A `200` renders the new-password form; a `400` renders an "invalid or expired link" state without a form. On form submit it MUST call `POST /api/v1/auth/reset-password` with the token and new password (enforcing the same strength rule), then route the user to `/login` on success.

#### Scenario: Valid token renders the new-password form

- **WHEN** the page loads and `GET /auth/reset-password?token=<valid>` returns `200`
- **THEN** the new-password form is shown

#### Scenario: Invalid token hides the form

- **WHEN** `GET /auth/reset-password?token=<invalid>` returns `400`
- **THEN** the page shows "invalid or expired link" and renders no password form

#### Scenario: Successful reset routes to login

- **WHEN** the user submits a valid token and a strong new password and the API returns success
- **THEN** the app navigates to `/login` with a "password updated" confirmation

### Requirement: Silent refresh bootstraps the in-memory access token on load

The web app SHALL run a client-side auth bootstrap on application load that calls `POST /api/v1/auth/refresh` against the `httpOnly` refresh cookie. On success it MUST store the new access token in memory and hydrate the user from `GET /api/v1/users/me`; on failure it MUST leave the store unauthenticated. Route decisions MUST wait for this bootstrap to settle so a hard refresh does not flash the user to `/login`.

#### Scenario: Hard reload restores the session from the cookie

- **WHEN** the app loads with a valid refresh cookie and no in-memory token
- **THEN** the bootstrap calls `/auth/refresh`, stores the returned access token, and hydrates the user
- **AND** a protected route the user requested renders without redirecting to `/login`

#### Scenario: No valid cookie leaves the user signed out

- **WHEN** the app loads and `/auth/refresh` returns `401`
- **THEN** the store stays unauthenticated and a protected route redirects to `/login`

### Requirement: Logout clears session state

The web app SHALL provide a logout action that calls `POST /api/v1/auth/logout`, clears the in-memory access token and user from the store, and navigates to `/login`.

#### Scenario: Logout clears the store and redirects

- **WHEN** an authenticated user triggers logout
- **THEN** the app calls `/auth/logout`, the store's access token and user become empty, and the app navigates to `/login`

### Requirement: Route middleware protects authenticated routes and gates auth pages

The web app SHALL register global route middleware that, after the auth bootstrap settles, redirects unauthenticated users away from protected routes to `/login` while preserving the originally requested path for post-login return, and redirects already-authenticated users away from the auth pages (`/login`, `/register`, `/forgot-password`) to the app home. The auth and verification/reset pages MUST remain publicly reachable.

#### Scenario: Unauthenticated access to a protected route redirects to login

- **WHEN** an unauthenticated user navigates to a protected route
- **THEN** the middleware redirects to `/login`
- **AND** the originally requested path is preserved so login can return there

#### Scenario: Authenticated user is kept out of the login page

- **WHEN** an authenticated user navigates to `/login`
- **THEN** the middleware redirects them to the app home

#### Scenario: Public auth pages stay reachable

- **WHEN** an unauthenticated user navigates to `/register` or the reset-password page
- **THEN** the middleware allows the navigation without redirecting to `/login`
