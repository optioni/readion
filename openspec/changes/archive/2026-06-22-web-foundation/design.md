## Context

`apps/web` is a minimal Nuxt 4 scaffold (`@nuxt/ui` + Tailwind v4, Vitest + Playwright) with a placeholder index page. The `api-foundation` change already shipped the Orval codegen pipeline (`orval.config.ts` → `apps/web/src/api/`, `yarn codegen`), the `/api-json` dev endpoint, the `{ data, … }` response envelope, RFC 7807 problem-details, and CORS with `credentials: true` against the explicit frontend origin.

This change adds the runtime foundation every downstream `web-*` page needs: an application shell, a credentialed typed data layer, an SSE primitive, and PWA installability. It introduces no backend code, no entities, and no migrations. The auth token model is decided upstream (SPEC → Token transport): the access token lives in memory in Pinia, the refresh token is an `httpOnly` cookie — so the fetch layer must send credentials, but token storage/refresh logic itself belongs to `web-auth`, not here.

## Goals / Non-Goals

**Goals:**
- A default layout (top nav, full-height, centred max-width container) following `DESIGN.md`, applied to all pages by default.
- Dark-mode-first color mode with a persistent toggle, and `DESIGN.md` design tokens mapped into the Nuxt UI / Tailwind theme.
- Pinia registered for downstream stores.
- `@tanstack/vue-query` plugin (single shared `QueryClient`) + an Orval custom fetch mutator that prefixes `runtimeConfig.public.apiBaseUrl`, sends `credentials: 'include'`, and raises typed problem-details errors.
- An SSE composable wrapping native `useEventSource`.
- PWA installability (manifest, icons, theme color, viewport, service worker) — install only.

**Non-Goals:**
- Auth flows, token storage, silent refresh, route guards (→ `web-auth`).
- Any feature page (dashboard, session view, mock exam, agent chat, admin) (→ downstream `web-*`).
- Offline content caching / offline mode (explicit SPEC Non-Goal).
- Changes to the Orval *config* or the `yarn codegen` script (owned by `api-foundation`); we only add the mutator it references.
- Consuming a real agent SSE endpoint (none exists yet) — the composable is exercised against a test source.

## Test Boundaries

Outside-in TDD: Playwright e2e first (shell + PWA + dark default), then Vitest component/composable tests. The web app has no database; the only external collaborator is the API over HTTP.

| Dependency | In acceptance test (Playwright e2e) | In unit/component tests (Vitest) |
|---|---|---|
| API HTTP endpoints (via Orval client / fetch mutator) | Not called by the shell page; mock `fetch`/route if a probe is needed | Mocked `fetch` (assert URL prefix + `credentials: 'include'` + problem-details mapping) |
| SSE endpoint (`useEventSource`) | n/a (no agent endpoint yet) | Fake `EventSource` / test SSE source emitting `message` events |
| `@tanstack/vue-query` `QueryClient` | real (runs in app) | real (mounted within Nuxt test env / `@nuxt/test-utils`) |
| Pinia store | real | real (mounted within app context) |
| Color mode storage (cookie/localStorage) | real (browser) | real / stubbed storage in component env |
| PWA manifest + service worker | real (served by built app; assert manifest JSON, `<link rel=manifest>`, SW registration) | config-level assertion (no offline runtime caching configured) |
| `runtimeConfig.public.apiBaseUrl` | real (from env) | real (read configured value) |

## Decisions

- **Orval custom mutator over global `$fetch` interceptor.** Orval is configured (via `output.override.mutator`) to call a single typed fetch function. This keeps base-URL prefixing, `credentials: 'include'`, and problem-details error mapping in one place that all generated composables share. Alternative — a Nuxt `$fetch` interceptor plugin — was rejected because the generated client would still need its own base instance, splitting the concern.
- **`credentials: 'include'` on every request.** Required so the `httpOnly` refresh cookie and CORS-credentialed calls work (SPEC → Token transport; `api-foundation` set CORS `credentials: true`). Access-token attachment and refresh are deferred to `web-auth`; the mutator simply leaves a seam for an Authorization header to be added later.
- **Native `useEventSource` for SSE.** SPEC → Streaming names the native composable explicitly. A thin wrapper composable adds reactive state + auto-close on unmount and a typed message shape, without pulling in an extra SSE library. Alternative — a hand-rolled `EventSource` wrapper — duplicates what VueUse/Nuxt already provide.
- **`@vite-pwa/nuxt` for PWA, install-only.** It generates the manifest + a minimal service worker and integrates with the Nuxt build. Runtime/offline caching is left unconfigured to honor the offline Non-Goal. Alternative — hand-written manifest + manual SW — is more work for no benefit.
- **Dark-mode-first via Nuxt UI / `@nuxtjs/color-mode` with `preference: 'dark'`.** `DESIGN.md` is dark-first; defaulting to dark and persisting the toggle matches both `DESIGN.md` and SPEC. The light/dark control surfaced in a user-preferences page is downstream; here we ship the toggle primitive.
- **Design tokens via Nuxt UI `app.config.ts` + Tailwind theme/CSS variables.** Map Slate background layers, Blue/Indigo primary, status scale, and Inter once at the foundation so feature pages inherit them. Depth is background-layer contrast, not shadows, per `DESIGN.md`.

## Risks / Trade-offs

- **SSR vs. client-only primitives.** `EventSource`, service workers, and `localStorage` are browser-only. → Guard SSE/PWA registration to client context (`import.meta.client` / `.client` plugins) so SSR build doesn't crash.
- **Cookie credentials in dev cross-origin (`:3000` web ↔ `:3001` api).** `credentials: 'include'` requires the API's CORS to echo the exact origin and `Access-Control-Allow-Credentials: true`. → Already configured by `api-foundation`; document the dev origin pairing in `.env.example`.
- **Vitest + Nuxt environment friction.** Component tests that need plugins (Pinia, Vue Query) require `@nuxt/test-utils` or explicit plugin setup. → Use `@nuxt/test-utils` `mountSuspended` / a test harness that installs the same plugins.
- **Orval regeneration drift.** The mutator must keep matching the generated client's expected signature. → Pin the mutator contract in a unit test asserting the Orval `override.mutator` points at it.

## Open Questions

- Color-mode persistence channel — cookie (SSR-friendly, avoids flash) vs. `localStorage`. Lean cookie via `@nuxtjs/color-mode` defaults; resolve during implementation, not blocking.
- Whether the index landing page should redirect to `/login` once `web-auth` exists — out of scope here; foundation ships a neutral shell-demo page.
