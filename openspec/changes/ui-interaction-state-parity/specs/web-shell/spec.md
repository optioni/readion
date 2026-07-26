## MODIFIED Requirements

### Requirement: Dark-mode-first color mode with toggle

The web app SHALL default to dark color mode and SHALL expose a reusable color-mode toggle. The toggle MUST live in the **sidebar footer** next to the user block (it is no longer rendered in a top navigation bar). Activating the toggle MUST change the document root and the resolved semantic background, surface, text, border, focus, and status colors to the selected usable mode. Color preference MUST persist across reloads. The design follows `DESIGN.md`: dark mode is the primary experience.

#### Scenario: Dark mode is the default on first load

- **WHEN** a Playwright test loads the app with no stored color-mode preference
- **THEN** the document root carries the dark color-mode class (e.g. `<html class="dark">`)

#### Scenario: Toggle in the sidebar footer switches and persists the color mode

- **WHEN** the user records the resolved page background and primary text colors, activates the color-mode toggle in the sidebar footer once, and reloads the page
- **THEN** the document root reflects the toggled mode (light) after reload, read back from persisted storage
- **AND** the resolved page background and primary text colors differ from the recorded dark-mode values and meet the contrast thresholds in `web-interaction-states`

### Requirement: Design tokens mapped from the design system

The Nuxt UI theme and Tailwind configuration SHALL map the complete `DESIGN.md` token system: Slate background layers (`base` #0f172a, `surface` #1e293b, `elevated` #0a0f1e, `overlay` #16213e), a Blue/Indigo primary (#1d4ed8), the status color scale, borders, focus indicator, and Inter as the sole typeface. Semantic aliases used by components, including `readion-surface`, `readion-border-default`, and `readion-warning`, MUST resolve in every supported color mode. Depth MUST be communicated through background-layer contrast, not `box-shadow`.

#### Scenario: Primary color resolves to the design-system value

- **WHEN** a component test renders a Nuxt UI primary button and reads its resolved primary color custom property
- **THEN** the value corresponds to the configured primary (#1d4ed8), not the framework default

#### Scenario: Inter is the configured app font

- **WHEN** the app config / Tailwind theme is inspected in a unit test
- **THEN** the sans font family is configured to Inter

#### Scenario: Every referenced semantic token resolves

- **WHEN** a component fixture renders every Readion semantic background, border, text, status, and focus alias used by `apps/web` in dark and light modes
- **THEN** each referenced CSS custom property resolves to a non-empty valid color
- **AND** `readion-surface`, `readion-border-default`, and `readion-warning` resolve without falling back to an undeclared value

### Requirement: Responsive layout

The shell SHALL render usable layouts on small (phone) viewports as well as desktop, in line with the time-constrained, fragmented-moment learner in SPEC, and acts as the PWA frame. On narrow viewports the persistent sidebar MUST collapse into a drawer (or equivalent off-canvas pattern) that can be opened from the page chrome, keeping all navigation reachable. At a 375px viewport, the document and every in-shell content region MUST fit within the viewport without horizontal page scrolling; long labels, forms, charts, tables, and action rows MUST wrap, stack, scroll inside an explicitly bounded local container, or otherwise reflow without clipping essential controls.

#### Scenario: Sidebar collapses to a drawer on a phone viewport

- **WHEN** a Playwright test loads an in-shell page at a 375px-wide viewport
- **THEN** the persistent sidebar is collapsed (not occupying the full-width layout) and the content renders without horizontal overflow (document scroll width does not exceed the viewport width)
- **AND** a control is available to open the navigation drawer, after which the five nav items are reachable

#### Scenario: Representative in-shell pages do not overflow on phones

- **WHEN** Playwright loads Dashboard, Progress, Ask AI, Settings, and an Admin page at a 375px-wide viewport with long deterministic fixture labels
- **THEN** for each page `document.documentElement.scrollWidth` does not exceed `window.innerWidth`
- **AND** every primary action remains fully visible and reachable

#### Scenario: Sidebar is persistent on desktop

- **WHEN** a Playwright test loads an in-shell page at a 1440px-wide viewport
- **THEN** the left sidebar is visible alongside the content region without requiring a toggle to reveal it
