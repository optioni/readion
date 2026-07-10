## MODIFIED Requirements

### Requirement: Login page authenticates and routes into the app

The web app SHALL expose a `/login` page with email and password fields. On submit it MUST call `POST /api/v1/auth/login`, store the returned access token in memory, hydrate the current user from `GET /api/v1/users/me`, and navigate to the post-login destination (the originally requested route, or the app home when none). A `401` MUST surface a single uniform "invalid email or password" message without revealing which field was wrong.

On a failed login the credential input(s) SHALL additionally render the design's **errored-field styling** (a Readion error/danger-token border, matching `openspec/design/SignIn.html`), so the error is visible on the fields and not only in the banner. This styling MUST NOT be accompanied by any per-field, account-revealing message (e.g. "No account found with this email"); the uniform banner message stands as the only textual error, preserving the non-enumeration guarantee.

The login form SHALL be presented in the design's split-panel auth layout (brand panel + form panel) matching `openspec/design/SignIn.html`. The form panel SHALL be a **full-height `background-surface` pane that fills the right side of the layout** (`flex: 1`), with the form **vertically centered and left-aligned** inside it and its content constrained to a comfortable reading width. It MUST NOT render as a bordered card floating in an empty `background-base` void. The deliberately preserved divergence stands: the page SHALL NOT render the artboard's "Sign in with SSO" button or `or` divider — SSO remains omitted and is NOT reintroduced by this fidelity change (any future SSO is a separate product decision with its own backend scope).

#### Scenario: Successful login lands in the app

- **WHEN** a registered user submits correct credentials on `/login`
- **THEN** the access token from the `200` response body is held in the auth store
- **AND** the user profile from `GET /users/me` populates the store
- **AND** the app navigates away from `/login` to the post-login destination

#### Scenario: Invalid credentials show a uniform error

- **WHEN** the login request returns `401`
- **THEN** the page shows a single "invalid email or password" message
- **AND** the access token in the store remains empty and the user stays on `/login`

#### Scenario: Failed login styles the credential fields without revealing which is wrong

- **WHEN** the login request returns `401`
- **THEN** the credential input(s) render the errored (danger-token) styling
- **AND** the only textual error is the uniform "invalid email or password" banner — no per-field or account-existence message is shown

#### Scenario: Form pane fills the surface, not a floating card

- **WHEN** the `/login` page renders
- **THEN** the form panel is a full-height `background-surface` pane filling the right side of the split-panel layout
- **THEN** the form is vertically centered and left-aligned within the pane with its content constrained to a reading width
- **AND** the form is not a bordered card floating in an empty `background-base` region

#### Scenario: No SSO control or divider is rendered

- **WHEN** the `/login` page renders
- **THEN** no "Sign in with SSO" control or `or` divider is present

### Requirement: Reset-password page validates the token then sets a new password

The web app SHALL expose a `/reset-password` page that first validates the URL `token` via `GET /api/v1/auth/reset-password?token=`. A `200` renders the new-password form; a `400` renders an "invalid or expired link" state without a form. On form submit it MUST call `POST /api/v1/auth/reset-password` with the token and new password (enforcing the same strength rule), then route the user to `/login` on success.

The reset form SHALL include a **Confirm-password** field beneath the new-password field (matching `openspec/design/ResetPassword.html`). Submit SHALL be gated on the two entries matching in addition to the strength rule: a mismatch SHALL surface an inline "passwords do not match" message and block submission, and a match SHALL show the design's success (checkmark) indicator on the confirm field. The match check is client-side only and does not change the request payload (token + new password).

#### Scenario: Valid token renders the new-password form

- **WHEN** the page loads and `GET /auth/reset-password?token=<valid>` returns `200`
- **THEN** the new-password form is shown

#### Scenario: Invalid token hides the form

- **WHEN** `GET /auth/reset-password?token=<invalid>` returns `400`
- **THEN** the page shows "invalid or expired link" and renders no password form

#### Scenario: Confirm-password mismatch blocks submit

- **WHEN** the user enters a valid new password but a non-matching confirmation
- **THEN** an inline "passwords do not match" message is shown and the form does not submit

#### Scenario: Matching confirmation shows the success indicator and allows submit

- **WHEN** the new password and confirmation match and satisfy the strength rule
- **THEN** the confirm field shows the success (check) indicator and the form can be submitted

#### Scenario: Successful reset routes to login

- **WHEN** the user submits a valid token and a strong new password and the API returns success
- **THEN** the app navigates to `/login` with a "password updated" confirmation
