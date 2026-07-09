## Context

`apps/web` is a Nuxt 3 app rendered with SSR (it uses `internalApiBaseUrl` for server-side auth bootstrap). Every meaningful route is gated by `auth.global.ts`; the only routes reachable while logged out are the auth flow pages (`login`, `register`, `forgot-password`, `reset-password`, `verify-email`). Today the app ships no `robots.txt`, no indexing directives, and `nuxt.config.ts`'s `app.head` declares only `theme-color`, `viewport`, and the PWA manifest link — no `<title>` template, no description, no social metadata. There is no marketing/acquisition intent in this repo; that surface, if built, is a separate project.

This change is deliberately small and confined to `apps/web`. There is no backend, DB, or shared-package surface.

## Goals / Non-Goals

**Goals:**
- The app is explicitly non-indexable: crawlers are told to stay out via `robots.txt` (`Disallow: /`).
- The five public auth routes remain crawlable (`Allow:`) purely so link-unfurl bots (Slackbot, Twitterbot) can fetch them to render share cards.
- Every page has a sane title via a global template (`%s · Readion`) and a default site title + meta description, so shared links never render as bare URLs.
- Public auth pages (`login`, `register`) emit Open Graph + Twitter Card tags so pasted links unfurl into a product card.
- Robots rules and SEO meta are managed declaratively via the `@nuxtjs/seo` / `@nuxtjs/robots` module ecosystem, not hand-maintained static files.

**Non-Goals:**
- No public marketing/landing surface, no per-certification programmatic SEO pages.
- No sitemap generation (the `@nuxtjs/sitemap` sub-module is either disabled or, if the umbrella pulls it in, configured to emit nothing meaningful — there is no public content to map).
- No schema.org / structured-data markup, no `og:image` asset design work beyond wiring an existing logo/icon (a bespoke share image is out of scope; use the existing `readion.svg`/a raster fallback if one exists, otherwise omit `og:image` rather than block on asset creation).
- No `noindex` per-page meta strategy — Strategy 1 (blanket `Disallow`) was chosen precisely to avoid per-route index directives; we accept that a bare, description-less URL *could* appear if linked externally.

## Visual Design

No design source applies. This change adds crawler directives and document-head metadata (`robots.txt`, `<title>`, meta/OG tags) — there is no new or modified user-facing view or email template. The auth pages themselves are unchanged; only their `<head>` gains metadata. Section intentionally skipped.

## Test Boundaries

The change produces no server-side/business logic — it is Nuxt config plus document-head output. Verification is behavioral at the rendered-HTTP layer.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Nuxt SSR server | real (Playwright dev/preview server) | n/a |
| `robots.txt` route (module-generated) | real HTTP fetch, assert body rules | n/a |
| Rendered page `<head>` (title, meta description, OG/Twitter) | real DOM/HTML assertions via Playwright | component-level head assertion via Vitest + `@nuxt/test-utils` where practical |
| API backend | not involved (public auth pages render without auth) | mocked/absent |

Acceptance (Playwright e2e in `apps/web/e2e/`): fetch `/robots.txt` and assert `Disallow: /` plus `Allow:` for the public routes; load `/login` and `/register` logged-out and assert `document.title` matches the template and that `og:title`/`og:description`/`twitter:card` meta are present; load any authenticated route's public redirect target and assert the global title/description baseline. No backend integration or DB test surface exists for this change.

## Decisions

- **Strategy 1 (blanket `Disallow: /`) over per-page `noindex`.** Chosen by the user. Simpler, zero per-route bookkeeping, and correct for a tool where nothing should be indexed. Alternative considered: allow crawling + global `X-Robots-Tag: noindex` (guarantees a clean index but requires *not* disallowing paths and adds a response-header concern). Rejected as heavier than the value for a login-walled app. Trade-off accepted: an externally-linked URL may still surface as a bare entry.
- **`Allow:` the public auth routes despite the blanket `Disallow`.** Slackbot and Twitterbot honor `robots.txt`; a pure `Disallow: /` would suppress the share cards the user explicitly wants. Explicit `Allow:` entries for `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` keep them fetchable by unfurlers. This is the reconciliation of "Strategy 1" + "auth pages get OG cards."
- **Module ecosystem (`@nuxtjs/robots` / `@nuxtjs/seo`) over hand-rolled static files + per-page `useHead`.** Chosen by the user. Declarative, per-route robots control, and a managed `robots.txt` route that plays well with SSR/preview. Decide during implementation between the focused `@nuxtjs/robots` module and the `@nuxtjs/seo` umbrella (which bundles robots + sitemap + og-image + schema-org + link-checker). Lean toward `@nuxtjs/robots` alone to keep the dependency surface matched to the actual (defensive-only) scope; adopt the umbrella only if `useSeoMeta` defaults or og-image generation earn their weight. Either way, global title/description live in `nuxt.config.ts` `app.head` (or `site` config), and OG/Twitter specifics go on the individual public pages via `useSeoMeta`.
- **Global baseline in `nuxt.config.ts`, page-specific OG via `useSeoMeta` on the page.** Keeps the site-wide default in one place while letting `login`/`register` override title/description/OG without touching a shared layout.

## Risks / Trade-offs

- [A blanket `Disallow: /` could be misread as "SEO is handled" and silently block a future marketing need] → Non-goals in the proposal state the marketing surface is a *separate repo*; this app staying non-indexable is intended, not accidental.
- [`Allow:` on auth routes means `login`/`register` are technically indexable and could rank for "readion login"] → Harmless and arguably desirable; these are low-value, non-sensitive pages and ranking for the product name is fine.
- [The `@nuxtjs/seo` umbrella may pull in sitemap/og-image/schema sub-modules that generate output we don't want] → Prefer the focused `@nuxtjs/robots`; if the umbrella is used, explicitly disable/neuter the sitemap and schema sub-modules in config.
- [PWA/`@vite-pwa/nuxt` and the new module both touch the document head / generated routes] → Verify no route collision on `/robots.txt` and that the manifest link and theme-color still render after adding the module.
- [`og:image` with no designed share asset] → Wire the existing icon or omit `og:image`; do not block the change on producing a bespoke image.

## Open Questions

- **`@nuxtjs/robots` alone vs. the `@nuxtjs/seo` umbrella** — resolve at implementation time based on whether `useSeoMeta` ergonomics / og-image generation are wanted now. Default: focused module.
- **`og:image` source** — is there an existing raster share image, or do we ship without `og:image` for now? (Only `icons/readion.svg` is currently in `public/`; many unfurlers won't render SVG OG images, so a PNG may be needed later — out of scope to design one here.)
- **`site.url` / canonical host** — the module needs the production origin for absolute OG URLs; confirm the env var/config source for the public site URL (likely alongside `NUXT_PUBLIC_API_BASE_URL`).
