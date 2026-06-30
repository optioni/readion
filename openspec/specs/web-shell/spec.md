## Purpose

Specifies the application shell for the Nuxt web app: the default layout (persistent left sidebar with primary navigation and a footer user block, scrollable content region), dark-mode-first color mode with persistence and a sidebar-footer toggle, design token mapping from DESIGN.md, Pinia registration, and responsive layout behaviour that collapses the sidebar into a drawer on small viewports.

## Requirements

### Requirement: Application shell layout

`apps/web` SHALL provide a default Nuxt layout that wraps every authenticated page in a full-height structure with a **persistent left sidebar** and a scrollable content region. The shell MUST be the layout applied when a page declares no explicit layout.

The sidebar MUST render, top to bottom: the Readion brand (mark + wordmark); a primary navigation `nav` landmark containing the five items **Dashboard**, **Sessions**, **Progress**, **Ask AI**, and **Settings**, each linking to its route; a role-gated **Admin panel** entry shown only to admin users; and a footer block holding the signed-in user (avatar/initials + name) together with the relocated dark-mode toggle. The navigation item matching the current route MUST carry an active visual state and `aria-current="page"`; all other items MUST NOT.

Focused, full-screen flows (mock exam, quick-review run, in-session study view, session start) MUST opt out of this shell by declaring a bare layout, so they render WITHOUT the sidebar. Authentication screens keep their dedicated split layout.

#### Scenario: Authenticated page renders the sidebar with active item and footer

- **WHEN** a Playwright test navigates as an authenticated user to an in-shell page (e.g. `/settings`)
- **THEN** the page contains a left sidebar with a `nav` landmark holding Dashboard, Sessions, Progress, Ask AI, and Settings, plus the Readion brand
- **AND** the Settings nav item carries the active state and `aria-current="page"` while the other items do not
- **AND** the sidebar footer shows the signed-in user block and the dark-mode toggle

#### Scenario: Pages inherit the sidebar shell without opting in

- **WHEN** a page component renders without setting `definePageMeta({ layout })`
- **THEN** the rendered DOM includes the default layout's left sidebar around the page's own content

#### Scenario: Focused flows render without the sidebar

- **WHEN** a Playwright test opens a focused flow (mock exam, quick-review run, or in-session study view)
- **THEN** the page renders the bare/minimal chrome with no left sidebar present

#### Scenario: Admin sub-nav coexists inside the shell

- **WHEN** an admin user opens an admin console page within the default shell
- **THEN** the app sidebar shows the role-gated Admin panel entry
- **AND** the admin section's own sub-navigation continues to render inside the content region

### Requirement: Dark-mode-first color mode with toggle

The web app SHALL default to dark color mode and SHALL expose a reusable color-mode toggle. The toggle MUST live in the **sidebar footer** next to the user block (it is no longer rendered in a top navigation bar). Color preference MUST persist across reloads. The design follows `DESIGN.md`: dark mode is the primary experience.

#### Scenario: Dark mode is the default on first load

- **WHEN** a Playwright test loads the app with no stored color-mode preference
- **THEN** the document root carries the dark color-mode class (e.g. `<html class="dark">`)

#### Scenario: Toggle in the sidebar footer switches and persists the color mode

- **WHEN** the user activates the color-mode toggle in the sidebar footer once and then reloads the page
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

The shell SHALL render usable layouts on small (phone) viewports as well as desktop, in line with the time-constrained, fragmented-moment learner in SPEC, and acts as the PWA frame. On narrow viewports the persistent sidebar MUST collapse into a drawer (or equivalent off-canvas pattern) that can be opened from the page chrome, keeping all navigation reachable without horizontal overflow.

#### Scenario: Sidebar collapses to a drawer on a phone viewport

- **WHEN** a Playwright test loads an in-shell page at a 375px-wide viewport
- **THEN** the persistent sidebar is collapsed (not occupying the full-width layout) and the content renders without horizontal overflow (document scroll width does not exceed the viewport width)
- **AND** a control is available to open the navigation drawer, after which the five nav items are reachable

#### Scenario: Sidebar is persistent on desktop

- **WHEN** a Playwright test loads an in-shell page at a 1440px-wide viewport
- **THEN** the left sidebar is visible alongside the content region without requiring a toggle to reveal it
