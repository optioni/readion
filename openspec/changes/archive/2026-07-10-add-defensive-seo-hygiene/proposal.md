## Why

Readion is a fully authenticated tool: every meaningful page sits behind `auth.global.ts`, and the web app currently ships with no `robots.txt`, no indexing controls, no `<title>` template, and no social-share metadata. That means search engines could index half-rendered app shells or externally-linked auth URLs, and any link a user pastes into Slack/Twitter/iMessage unfurls as a bare, title-less URL. This is defensive SEO hygiene — keep the tool out of search indexes and make the few shareable links look like a product — not a growth/marketing play (a public acquisition surface, if ever built, will live in a separate repo).

## What Changes

- Add a `robots.txt` that disallows crawling the entire app (`Disallow: /`), with explicit `Allow:` entries for the public auth routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) so link-unfurl crawlers (Slackbot, Twitterbot) can still fetch them to render share cards.
- Add a global `<title>` template (e.g. `%s · Readion`) and a default site title + meta description in the Nuxt app head, so every page — and every shared link — has a sane title instead of a bare URL.
- Add Open Graph + Twitter Card metadata to the public auth pages (`login`, `register`) so pasted links unfurl into a proper product card.
- Adopt the `@nuxtjs/robots` / `@nuxtjs/seo` module ecosystem to manage robots rules and SEO meta declaratively, rather than hand-rolling static files and per-page `useHead` calls.

Non-goals (explicitly out of scope): a public marketing/landing surface, per-certification programmatic SEO pages, sitemap generation for app content, and structured-data/schema.org markup.

## Capabilities

### New Capabilities
- `seo-hygiene`: Defensive search-engine and social-share behavior for the web app — crawler exclusion via robots rules, a global title/description baseline, and Open Graph/Twitter share metadata on public entry pages.

### Modified Capabilities
<!-- None — no existing spec's requirements change. -->

## Impact

- **App**: `apps/web` only. New module registration in `nuxt.config.ts`, robots configuration, a global head/SEO baseline (likely in the default layout or `app.head`), and OG/Twitter meta on `app/pages/login.vue` and `app/pages/register.vue`.
- **Dependencies**: adds `@nuxtjs/robots` (or the `@nuxtjs/seo` umbrella) to `apps/web`. No API, worker, DB, or shared-package changes.
- **Runtime/SEO posture**: the app becomes explicitly non-indexable; public auth routes remain crawlable purely so their share cards render. No behavior change for authenticated users.
- **Tests**: e2e assertions that `robots.txt` is served with the expected rules and that public pages emit the expected title/OG tags; no backend test surface.
