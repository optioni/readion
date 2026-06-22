## ADDED Requirements

### Requirement: Application shell layout

`apps/web` SHALL provide a default Nuxt layout that wraps every page in a full-height structure with a top navigation bar and a centred, max-width content container. The shell MUST be the layout applied when a page declares no explicit layout.

#### Scenario: Default layout renders the shell chrome

- **WHEN** a Playwright test navigates to `/` in `apps/web`
- **THEN** the page contains a top navigation bar element (role `banner` / `<header>`) holding the app name "Readion"
- **THEN** the page content is wrapped in a centred container whose computed width is capped by a max-width (the container is not full viewport width on a 1440px-wide viewport)

#### Scenario: Pages inherit the default layout without opting in

- **WHEN** a page component renders without setting `definePageMeta({ layout })`
- **THEN** the rendered DOM includes the default layout's navigation bar around the page's own content

### Requirement: Dark-mode-first color mode with toggle

The web app SHALL default to dark color mode and SHALL expose a reusable color-mode toggle. Color preference MUST persist across reloads. The design follows `DESIGN.md`: dark mode is the primary experience.

#### Scenario: Dark mode is the default on first load

- **WHEN** a Playwright test loads `/` with no stored color-mode preference
- **THEN** the document root carries the dark color-mode class (e.g. `<html class="dark">`)

#### Scenario: Toggle switches and persists the color mode

- **WHEN** the user activates the color-mode toggle once and then reloads the page
- **THEN** the document root reflects the toggled mode (light) after reload, read back from persisted storage

### Requirement: Design tokens mapped from the design system

The Nuxt UI theme and Tailwind configuration SHALL map the `DESIGN.md` token system: Slate background layers (`base` #0f172a, `surface` #1e293b, `elevated` #0a0f1e, `overlay` #16213e), a Blue/Indigo primary (#1d4ed8), the status color scale, and Inter as the sole typeface. Depth MUST be communicated through background-layer contrast, not `box-shadow`.

#### Scenario: Primary color resolves to the design-system value

- **WHEN** a component test renders a Nuxt UI primary button and reads its resolved primary color custom property
- **THEN** the value corresponds to the configured primary (#1d4ed8), not the framework default

#### Scenario: Inter is the configured app font

- **WHEN** the app config / Tailwind theme is inspected in a unit test
- **THEN** the sans font family is configured to Inter

### Requirement: Pinia state management registered

The web app SHALL register Pinia so that downstream stores (auth, preferences) can be defined and accessed within components and plugins.

#### Scenario: A Pinia store is usable inside the app

- **WHEN** a component test mounts a component that calls `useState`-style access to a defined Pinia store within the Nuxt test environment
- **THEN** the store resolves to a reactive instance with its initial state (no "no active Pinia" error is thrown)

### Requirement: Responsive layout

The shell SHALL render usable layouts on small (phone) viewports as well as desktop, in line with the time-constrained, fragmented-moment learner in SPEC.

#### Scenario: Navigation bar and container adapt to a phone viewport

- **WHEN** a Playwright test loads `/` at a 375px-wide viewport
- **THEN** the top navigation bar and content container render without horizontal overflow (document scroll width does not exceed the viewport width)
