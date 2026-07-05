## Context

`apps/web` is a Nuxt 4 SPA (Pinia, `@nuxt/ui`, PWA) with no client analytics today. Auth state lives in `stores/auth.ts` (`user: { id, email, role, ... }`), bootstrapped by the client-only `plugins/auth-bootstrap.ts`. Most user actions already funnel through small composables (`useOnboardingActions`, `sessionViewApi`, `useMockExamSubmit`, `useStandaloneAgentChat`, `useQuickStartActions`), which are ideal single-point instrumentation seams.

We self-host Umami at `https://analytics.optioni.fi`. Umami's v2 tracker is a single `<script>` that auto-collects page views (patching the History API, so SPA route changes are captured) and exposes `window.umami.track()` and `window.umami.identify()`. It is cookieless and GDPR-oriented; our only PII risk is what *we* choose to pass, so UUID-only identification is a hard invariant.

This is a cross-cutting frontend change (new plugin + composable + edits across many flows) with an external dependency and a privacy constraint, which is why it warrants a design doc.

## Goals / Non-Goals

**Goals:**
- One config-gated, client-only bootstrap that loads the tracker and leaves page views to Umami's automatic collection.
- A typed, SSR-safe `useTrack()` seam so event names are a closed union and callers never branch on tracker presence.
- UUID-only `identify()`; no email or free-text PII ever reaches Umami.
- A funnel-shaped catalog of 25 custom events wired at existing composable/page choke points.

**Non-Goals:**
- No new UI, screens, or email templates (pure instrumentation — Visual Design section intentionally omitted).
- No new npm dependency (hand-rolled plugin, not the community module).
- No consent/cookie banner or DNT gating in this change (cookieless tracker; can layer later).
- No backend/API changes; unrelated to the admin `product-analytics` read model.
- No per-item `session_item_completed`, admin-CRUD, or settings-toggle events (page views cover them; excluded as noise).

## Test Boundaries

The tracker is the only external collaborator. We never contact the real Umami host in tests; `window.umami` is a recording stub whose calls we assert.

| Dependency | In acceptance test (Playwright e2e) | In unit tests (Vitest) |
|---|---|---|
| Umami tracker script (`/script.js`) | Route-intercepted: the request to `analytics.optioni.fi/script.js` is fulfilled with a stub that installs a recording `window.umami` (`track`/`identify` push to an array). Real network never hit. | Not loaded. `window.umami` set to a `vi.fn()` recorder, or left `undefined` to assert the no-op path. |
| `window.umami.track` / `.identify` | Recording stub; e2e asserts a given user action produced the expected event name + props. | `vi.fn()` — assert args, call count, and PII-absence. |
| Runtime config (`NUXT_PUBLIC_UMAMI_*`) | Set via test env to a dummy host + website id so the plugin injects (against the intercepted route). | Passed directly into the bootstrap/composable under test. |
| Auth store | Real Pinia store, seeded with a fake authenticated user for `identify` assertions. | Real store or a minimal stub exposing `user`. |
| API endpoints behind the instrumented composables | Existing e2e fixtures/mocks (unchanged by this change). | Mocked as those composables' tests already do. |

The privacy invariant is directly testable: assert the recorded `identify`/`track` payloads never contain the seeded user's email string.

## Decisions

**Hand-rolled client plugin + composable over the `nuxt-umami` module.** Chosen because it mirrors the existing `auth-bootstrap.ts` idiom, adds zero dependencies, and gives full control over the config gate and the `identify` wiring. Alternative (`nuxt-umami` module) would remove the small amount of script-injection code and handle SPA page views, but adds a dependency and less direct control over identification and the typed event seam; the v2 tracker already handles SPA page views, so the module's main advantage is muted.

**Config gate with silent skip when unset.** The plugin injects nothing unless both `NUXT_PUBLIC_UMAMI_HOST` and `NUXT_PUBLIC_UMAMI_WEBSITE_ID` are present. Chosen so local dev and tests run tracking-free by default with no errors and no accidental data to production Umami. Alternative (always inject, rely on a dev website id) risks polluting real metrics and coupling dev to the remote host.

**Typed `TrackEvent` union + `useTrack()` wrapper.** Event names are a closed union so a typo is a compile error and the full catalog is discoverable in one place; the wrapper centralizes the `window.umami` presence guard so every call site is a clean one-liner. Alternative (call `window.umami.track` directly at each site) scatters `window.umami?.` guards and magic strings, and drops type safety.

**Instrument at composable choke points, not in components.** Each event maps 1:1 onto an existing async function (`saveDefaultsAndEnroll`, `submitQuizAnswer`, `runSubmit`, `send`, …), so `track()` calls live beside the action's success path and components stay presentation-only. Page-scoped events (`session_completed`, `progress_viewed`, `review_started`) fire from the page's mount since they have no composable. Alternative (track in template click handlers) duplicates logic and misses non-button transitions.

**Fire only on the success path.** Events emit after the underlying request resolves successfully (e.g. `cert_enrolled` only when `saveDefaultsAndEnroll` returns `{ ok: true }`). Chosen so funnel counts reflect completed actions, not attempts. Failures are out of scope for v1 (see Open Questions).

**`identify()` driven by an auth-store watch.** The plugin watches the store's `user`; when it becomes non-null it calls `identify({ userId: user.id })`. Chosen because auth resolves asynchronously via bootstrap/refresh, so a watch handles both immediate and delayed authentication uniformly.

## Risks / Trade-offs

- **PII leak through event props** → Hard rule + test: props are typed and asserted to exclude email; `identify` sends only `{ userId }`. Reviewer gate on any new prop.
- **Ad-blockers / script blocked** → `useTrack` no-ops safely; page still works. Accepted under-count; not a correctness issue.
- **CSP blocks the tracker origin** → `apps/web` currently sets no CSP in source (no security module, no `routeRules` headers), so nothing blocks the tracker today. If a CSP is later added, allow `analytics.optioni.fi` in `connect-src`/`script-src`; e2e verifies the script loads against the intercept.
- **Double-injection on HMR / repeated plugin runs** → Guard on an existing script/`window.umami` before injecting; assert single injection.
- **Event-name drift between spec catalog and code** → The `TrackEvent` union is the single source; the catalog table in the spec must match it (checked in review).
- **SSR referencing `window`** → Plugin is `.client.ts` and `useTrack` guards `import.meta.client`/`window` presence; covered by the SSR no-op scenario.

## Open Questions

- Track auth **failures** (`login_failed`, `signup_failed`) for drop-off analysis? Deferred; easy additive follow-up if the funnel shows an unexplained gap.
- Do we want a build-time or runtime **DNT/consent** switch even though the tracker is cookieless? Not in v1; revisit if legal requires it.
- **CSP**: none configured in `apps/web` today (verified), so no allowance is needed now. Left as a task-7 verify-first step in case headers are introduced before this ships.
