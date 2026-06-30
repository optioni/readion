## MODIFIED Requirements

### Requirement: Login page authenticates and routes into the app

The web app SHALL expose a `/login` page with email and password fields. On submit it MUST call `POST /api/v1/auth/login`, store the returned access token in memory, hydrate the current user from `GET /api/v1/users/me`, and navigate to the post-login destination (the originally requested route, or the app home when none). A `401` MUST surface a single uniform "invalid email or password" message without revealing which field was wrong.

The login form SHALL be presented in the design's contained-card placement (matching `openspec/design/Login.html`): the split-panel auth layout (brand panel + form panel) with the form constrained to a fixed reading width inside the form panel, so the fields sit in a tidy card rather than floating across a large empty region. The deliberately preserved divergence stands: the page SHALL NOT render the artboard's "Sign in with SSO" button or `or` divider — SSO remains omitted and is NOT reintroduced by this placement tightening.

#### Scenario: Successful login lands in the app

- **WHEN** a registered user submits correct credentials on `/login`
- **THEN** the access token from the `200` response body is held in the auth store
- **AND** the user profile from `GET /users/me` populates the store
- **AND** the app navigates away from `/login` to the post-login destination

#### Scenario: Invalid credentials show a uniform error

- **WHEN** the login request returns `401`
- **THEN** the page shows a single "invalid email or password" message
- **AND** the access token in the store remains empty and the user stays on `/login`

#### Scenario: Form sits in the contained-card placement without SSO

- **WHEN** the `/login` page renders
- **THEN** the form is constrained to a fixed reading width within the auth layout's form panel (not stretched across the full panel width)
- **AND** no "Sign in with SSO" control or `or` divider is rendered
