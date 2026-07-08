## MODIFIED Requirements

### Requirement: Login page authenticates and routes into the app

The web app SHALL expose a `/login` page with email and password fields. On submit it MUST call `POST /api/v1/auth/login`, store the returned access token in memory, hydrate the current user from `GET /api/v1/users/me`, and navigate to the post-login destination (the originally requested route, or the app home when none). A `401` MUST surface a single uniform "invalid email or password" message without revealing which field was wrong.

The login form SHALL be presented in the design's split-panel auth layout (brand panel + form panel) matching `openspec/design/Login.html`. The form panel SHALL be a **full-height `background-surface` pane that fills the right side of the layout** (`flex: 1`), with the form **vertically centered and left-aligned** inside it and its content constrained to a comfortable reading width. It MUST NOT render as a bordered card floating in an empty `background-base` void. The deliberately preserved divergence stands: the page SHALL NOT render the artboard's "Sign in with SSO" button or `or` divider — SSO remains omitted and is NOT reintroduced by this fidelity change (any future SSO is a separate product decision with its own backend scope).

#### Scenario: Successful login lands in the app

- **WHEN** a registered user submits correct credentials on `/login`
- **THEN** the access token from the `200` response body is held in the auth store
- **AND** the user profile from `GET /users/me` populates the store
- **AND** the app navigates away from `/login` to the post-login destination

#### Scenario: Invalid credentials show a uniform error

- **WHEN** the login request returns `401`
- **THEN** the page shows a single "invalid email or password" message
- **AND** the access token in the store remains empty and the user stays on `/login`

#### Scenario: Form pane fills the surface, not a floating card

- **WHEN** the `/login` page renders
- **THEN** the form panel is a full-height `background-surface` pane filling the right side of the split-panel layout
- **THEN** the form is vertically centered and left-aligned within the pane with its content constrained to a reading width
- **AND** the form is not a bordered card floating in an empty `background-base` region

#### Scenario: No SSO control or divider is rendered

- **WHEN** the `/login` page renders
- **THEN** no "Sign in with SSO" control or `or` divider is present
