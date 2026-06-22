## Why

`apps/web` is a bare Nuxt scaffold with no application shell, no connection to the API, and no installability. Every downstream frontend page change (`web-auth`, `web-dashboard`, `web-session-view`, …) needs a consistent layout, a typed data-fetching layer wired to the running API, and a streaming primitive to build on. This change establishes that foundation so feature pages have real plumbing — not boilerplate they each reinvent.

## What Changes

- Add **Pinia** and **`@tanstack/vue-query`** to `apps/web` and register a Vue Query Nuxt plugin (shared `QueryClient`, sensible defaults).
- Wire the **Orval-generated client at runtime**: a custom fetch mutator that targets `runtimeConfig.public.apiBaseUrl`, sends `credentials: 'include'` (so the `httpOnly` refresh cookie and CORS-credentialed requests work), and surfaces RFC 7807 problem-details as typed errors. The Orval *codegen pipeline* (`orval.config.ts`, `yarn codegen`) already exists from `api-foundation`; this change consumes its output, it does not redefine it.
- Expose `NUXT_PUBLIC_API_BASE_URL` through Nuxt `runtimeConfig.public` so the base URL is environment-driven, validated at startup.
- Add the **application shell**: a default layout with a full-height structure, top navigation bar, and a centred max-width content container, following `DESIGN.md` (Slate background layers, Blue/Indigo primary, Inter typeface, layer-based depth — no decorative shadows).
- Configure **dark-mode-first** color mode via Nuxt UI/`@nuxtjs/color-mode` (dark default) and provide a reusable color-mode toggle composable/component (placement in a preferences page is downstream).
- Make the app a **responsive, installable PWA** (web app manifest, icons, theme color, viewport meta, install support). **No offline mode** — a Non-Goal in SPEC; the service worker handles installability only, not offline caching.
- Add an **SSE composable** wrapping the native `useEventSource` for consuming the API's Server-Sent-Events endpoints (connect, parse message parts, expose reactive state, close on unmount). Used later by the agent chat; no agent endpoint is consumed here.
- Replace the placeholder landing page with a minimal shell-demonstrating index page (feature pages such as dashboard/session view are out of scope — they belong to downstream `web-*` changes).

## Capabilities

### New Capabilities
- `web-shell`: Nuxt UI + Tailwind application shell — default layout (top nav, full-height, max-width container), dark-mode-first color mode + toggle, Pinia store registration, responsive design tokens mapped from `DESIGN.md`.
- `api-client`: Runtime wiring of the typed Orval `@tanstack/vue-query` client — Vue Query plugin, custom fetch mutator with `credentials: 'include'`, environment-driven API base URL, typed problem-details errors, and the SSE composable for streaming endpoints.
- `pwa`: Progressive Web App installability — web app manifest, icons, theme color, responsive viewport, install support; explicitly no offline caching.

### Modified Capabilities

_None — no existing spec's requirements change._

## Impact

- **`apps/web`** — new dependencies (`pinia`, `@pinia/nuxt`, `@tanstack/vue-query`, `@vueuse/core`, `@nuxtjs/color-mode` or Nuxt UI's native mode, `@vite-pwa/nuxt`); `nuxt.config.ts` (modules, `runtimeConfig.public.apiBaseUrl`, PWA + color-mode config); new `plugins/`, `layouts/default.vue`, `composables/` (vue-query client, Orval mutator, SSE), `assets/css` theme tokens, `app.config.ts` for Nuxt UI theme.
- **Generated client** — `apps/web/src/api/` (committed; produced by the existing `yarn codegen`) becomes consumable at runtime through the mutator.
- **Env contract** — `NUXT_PUBLIC_API_BASE_URL` is the single required public var; documented in `apps/web/.env.example`.
- **Depends on** `api-foundation` (Orval pipeline, `/api-json`, CORS `credentials: true`, problem-details envelope). No backend, database, or worker changes; no new entities or migrations.
- **Testing** — Playwright e2e (shell renders, PWA manifest served, dark mode default) → Vitest component/composable tests (layout, color-mode toggle, vue-query plugin, SSE composable, fetch mutator).
