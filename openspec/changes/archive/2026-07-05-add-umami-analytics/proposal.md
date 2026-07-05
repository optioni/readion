## Why

We have no visibility into how real users move through the product — where they drop off between register → onboard → enroll → study → return. The existing `product-analytics` capability is an admin read model over internal outcome data (readiness, retention); it cannot tell us that, say, users abandon the cert-setup wizard, or never open the tutor. A privacy-respecting, self-hosted client-side analytics layer closes that gap so we can observe the actual user-flow funnel.

## What Changes

- Integrate the self-hosted Umami tracker (`https://analytics.optioni.fi`) into `apps/web` via a **client-only Nuxt plugin** that injects the tracker script from config and enables automatic page-view tracking (the v2 tracker hooks the History API, so SPA route changes are captured).
- Add a typed **`useTrack()` composable** — a thin, SSR-safe wrapper over `window.umami.track()` with a `TrackEvent` union so event names are never magic strings; it no-ops when the tracker is absent (SSR render, local dev, ad-blocked).
- Call `window.umami.identify({ userId })` on login/bootstrap using the **user UUID only**. Email and any other PII SHALL NEVER be sent to Umami.
- Wire 25 **custom events** into the existing composable choke points across the auth, onboarding, study-session, mock-exam, agent-tutor, and progress flows (each event maps 1:1 onto a function that already exists — instrumentation stays out of components).
- Add two public runtime-config vars (`NUXT_PUBLIC_UMAMI_HOST`, `NUXT_PUBLIC_UMAMI_WEBSITE_ID`) beside `apiBaseUrl`, plus `.env.example` entries. When either is unset, the plugin skips injection entirely — zero tracking, no errors.

## Capabilities

### New Capabilities
- `web-analytics`: Client-side Umami integration for the Nuxt frontend — tracker bootstrap, config gating, SSR-safe typed event tracking, UUID-only user identification, and the catalog of custom user-flow events.

### Modified Capabilities
<!-- None. Event tracking is additive instrumentation layered onto existing web flows; it changes no
     existing spec-level behavior. product-analytics (admin dashboard read model) is unrelated. -->

## Impact

- **New code** (`apps/web`): `app/plugins/umami.client.ts`, `app/composables/useTrack.ts`, config additions in `nuxt.config.ts` (`runtimeConfig.public`), `.env`/`.env.example`.
- **Touched code**: `track()` calls added to existing composables/pages — auth (`useCredentialForm` callers, `stores/auth`), onboarding (`useOnboardingActions`), sessions (`sessionViewApi`, `useQuickStartActions`), mock exam (`useMockExamSubmit`, `useQuickStartActions`), agent (`useStandaloneAgentChat`), progress/review pages.
- **Dependencies**: none added — hand-rolled plugin, no new npm packages.
- **External**: emits traffic to the self-hosted Umami instance at `https://analytics.optioni.fi`. Requires a website ID provisioned there and its CSP/connect-src allowance for that origin.
- **Privacy**: hard invariant — only the user UUID and non-PII event props leave the browser.
