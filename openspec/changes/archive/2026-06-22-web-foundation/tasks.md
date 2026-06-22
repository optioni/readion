## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Install web deps and register modules so the harness can boot: add `pinia`, `@pinia/nuxt`, `@tanstack/vue-query`, `@vueuse/core`, `@nuxtjs/color-mode` (or confirm Nuxt UI native mode), `@vite-pwa/nuxt`; set up the Playwright + Vitest harness per design.md Test Boundaries (no real API needed for the shell page; client uses mocked `fetch`)
- [x] 0.2 Write failing Playwright e2e (`apps/web/e2e/`) covering the shell scenarios: `/` renders the top nav with "Readion" inside a centred max-width container; `<html>` defaults to `class="dark"`; manifest is served with `name`/`short_name`/`display: standalone`/`192x192`+`512x512` icons; `<head>` has `<link rel="manifest">`, `<meta name="theme-color">`, and `<meta name="viewport" content="width=device-width, initial-scale=1">`; layout has no horizontal overflow at 375px
- [x] 0.3 Confirm the e2e fails for the right reason (missing layout/PWA/dark default), not a harness/config error

## 1. Application shell layout (web-shell)

- [x] 1.1 RED: Component test for `layouts/default.vue` — renders a `<header>`/banner with the app name and wraps the page slot in a centred max-width container; applied by default when a page sets no layout
- [x] 1.2 GREEN: Implement `layouts/default.vue` and a minimal shell-demo `pages/index.vue` (replace the placeholder); full-height structure per DESIGN.md
- [x] 1.3 REFACTOR: Extract nav-bar markup into a component; ensure responsive (no overflow at 375px)

## 2. Design tokens + dark-mode-first color mode (web-shell)

- [x] 2.1 RED: Unit test that the Nuxt UI `app.config.ts` / Tailwind theme resolves the primary to #1d4ed8, configures Inter as the sans font, and defines the Slate background layers + status scale; test that default color mode is dark and the toggle persists across reload
- [x] 2.2 GREEN: Map DESIGN.md tokens in `app.config.ts` + Tailwind CSS variables; configure color mode `preference: 'dark'`; implement a reusable color-mode toggle composable/component
- [x] 2.3 REFACTOR: Centralize tokens; confirm depth uses background-layer contrast, not box-shadow

## 3. Pinia registration (web-shell)

- [x] 3.1 RED: Component test mounting a component that reads a defined Pinia store within the Nuxt test env — asserts a reactive instance with initial state, no "no active Pinia" error
- [x] 3.2 GREEN: Register `@pinia/nuxt`; add a trivial example store to prove wiring
- [x] 3.3 REFACTOR: Clean up example store to a minimal seam for downstream stores

## 4. Environment-driven API base URL (api-client)

- [x] 4.1 RED: Unit test that `runtimeConfig.public.apiBaseUrl` equals `NUXT_PUBLIC_API_BASE_URL` (e.g. `http://localhost:3001/api/v1`); document the var in `.env.example`
- [x] 4.2 GREEN: Add `runtimeConfig.public.apiBaseUrl` in `nuxt.config.ts` sourced from the env var
- [x] 4.3 REFACTOR: Ensure no hardcoded base URLs remain in client code

## 5. Credentialed fetch mutator + typed problem-details (api-client)

- [x] 5.1 RED: Unit test (mocked `fetch`) that the mutator prefixes `apiBaseUrl`, sends `credentials: 'include'`, and maps a 422 `application/problem+json` body to a typed error exposing `status`/`title`/`detail`/`errors`
- [x] 5.2 GREEN: Implement the Orval custom mutator; wire `orval.config.ts` `output.override.mutator` to point at it and regenerate via `yarn codegen` (committed client in `apps/web/src/api/`)
- [x] 5.3 REFACTOR: Leave a seam for a future Authorization header (web-auth); unit-test that the Orval config references the mutator

## 6. Vue Query plugin (api-client)

- [x] 6.1 RED: Component test that a generated `useQuery` composable resolves against an injected shared `QueryClient` (no "no QueryClient found" error); assert a single client instance is reused
- [x] 6.2 GREEN: Implement the Vue Query Nuxt plugin providing one shared `QueryClient` with sensible defaults
- [x] 6.3 REFACTOR: Consolidate default options; ensure SSR-safe setup

## 7. SSE composable (api-client)

- [x] 7.1 RED: Component test against a fake `EventSource`/test source emitting two `message` events — composable's reactive data reflects the latest payload and reports an open status; on unmount the `EventSource` is closed
- [x] 7.2 GREEN: Implement the SSE composable wrapping native `useEventSource` (client-only guard), typed message shape, reactive state, auto-close on unmount
- [x] 7.3 REFACTOR: Tidy the typed message contract

## 8. PWA installability (pwa)

- [x] 8.1 RED: Config-level unit test that the PWA manifest declares name/short_name/`standalone`/start_url/theme_color/192+512 icons and that no offline runtime caching of API/app content is configured
- [x] 8.2 GREEN: Configure `@vite-pwa/nuxt` — manifest, icons, theme color, viewport meta, service worker registration (install only, no offline caching)
- [x] 8.3 REFACTOR: Guard SW registration to client context; confirm SSR build is unaffected

## 9. Acceptance Test — Outer Loop GREEN

- [x] 9.1 Confirm the Playwright acceptance test passes end-to-end
- [x] 9.2 Verify the affected app starts in the local environment (smoke test) — `yarn workspace @readion/web dev` boots with no startup/config errors and `/` renders the shell
- [x] 9.3 REFACTOR: Clean up test setup, harness, and mocks if needed

## 10. Change Review — Subagent Verification

- [x] 10.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 10.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason each), note SUGGESTIONs; re-run affected tests

## 11. Polish

- [x] 11.1 Run linter and fix all errors (`yarn lint`)
- [x] 11.2 Run formatter and apply fixes (`yarn format`)
- [x] 11.3 Run type checker with zero errors (`yarn workspace @readion/web typecheck`)
- [x] 11.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace @readion/web test:coverage`)
