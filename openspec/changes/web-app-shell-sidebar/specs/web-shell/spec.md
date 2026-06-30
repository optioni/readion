## MODIFIED Requirements

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

### Requirement: Responsive layout

The shell SHALL render usable layouts on small (phone) viewports as well as desktop, in line with the time-constrained, fragmented-moment learner in SPEC, and acts as the PWA frame. On narrow viewports the persistent sidebar MUST collapse into a drawer (or equivalent off-canvas pattern) that can be opened from the page chrome, keeping all navigation reachable without horizontal overflow.

#### Scenario: Sidebar collapses to a drawer on a phone viewport

- **WHEN** a Playwright test loads an in-shell page at a 375px-wide viewport
- **THEN** the persistent sidebar is collapsed (not occupying the full-width layout) and the content renders without horizontal overflow (document scroll width does not exceed the viewport width)
- **AND** a control is available to open the navigation drawer, after which the five nav items are reachable

#### Scenario: Sidebar is persistent on desktop

- **WHEN** a Playwright test loads an in-shell page at a 1440px-wide viewport
- **THEN** the left sidebar is visible alongside the content region without requiring a toggle to reveal it
