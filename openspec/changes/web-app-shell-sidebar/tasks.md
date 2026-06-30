## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Playwright e2e: an authenticated page (e.g. Settings/Dashboard) renders the left sidebar with brand + Dashboard/Sessions/Progress/Ask AI/Settings, correct active item, and a footer user block + Dark toggle.
- [ ] 0.2 Playwright e2e: a focused flow (mock exam / quick-review run / session view) renders WITHOUT the sidebar (bare chrome preserved).
- [ ] 0.3 Confirm both fail against the current top-nav layout.

## 1. Sidebar component

- [ ] 1.1 RED: component test for the sidebar — nav items, routes, active-state from the current route, footer user block.
- [ ] 1.2 GREEN: build the sidebar per `App Shell.html` (tokens from the design system).
- [ ] 1.3 REFACTOR: extract nav config; ensure a11y (nav landmark, aria-current).

## 2. Dark-mode toggle relocation

- [ ] 2.1 RED: test the toggle now lives in the sidebar footer and still flips/persists theme.
- [ ] 2.2 GREEN: move the toggle into the footer; remove it from the old top bar.
- [ ] 2.3 REFACTOR: restyle to match the footer.

## 3. Layout swap + focused-flow opt-out

- [ ] 3.1 RED: tests that the default authenticated layout uses the sidebar and focused-flow routes use the bare layout.
- [ ] 3.2 GREEN: make the sidebar the default layout; keep/assign the bare layout for mock-exam, quick-review run, and session-view routes; verify admin sub-nav still renders inside the shell.
- [ ] 3.3 REFACTOR: delete the old top-nav component and dead references.

## 4. Responsive / PWA frame

- [ ] 4.1 RED: test the narrow-viewport collapse/drawer behavior.
- [ ] 4.2 GREEN: implement responsive collapse; keep content reachable.
- [ ] 4.3 REFACTOR: tidy breakpoints against the design system.

## 5. Verification gates

- [ ] 5.1 Update all page/component tests that assumed the top bar; `yarn lint`, `yarn typecheck`, web unit tests + e2e green; coverage ≥ 80%.
