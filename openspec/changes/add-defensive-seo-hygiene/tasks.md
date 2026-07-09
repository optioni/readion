## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the e2e harness for logged-out access in `apps/web/e2e/` (no API/DB dependency — public auth pages render without auth; see design.md Test Boundaries)
- [x] 0.2 RED: Write failing acceptance test `seo-hygiene.e2e.spec.ts` covering all spec scenarios: `GET /robots.txt` returns `text/plain` with `User-agent: *` + `Disallow: /`; `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` are `Allow`ed while `/agent` and `/onboarding` are disallowed; `/login` and `/register` render a `<title>` ending in `· Readion` plus `og:title`, `og:description`, `twitter:card` meta
- [x] 0.3 Confirm it fails for the right reason (`/robots.txt` 404 / missing meta), not a harness/setup error

## 1. Robots directives (module + config)

- [x] 1.1 RED: Write a focused test asserting `/robots.txt` is served and its rules match — `Disallow: /` for `*`, explicit `Allow:` for the five public auth routes (Vitest + `@nuxt/test-utils`, or a thin Playwright fetch if head-less render is impractical)
- [x] 1.2 GREEN: Add and register `@nuxtjs/robots` in `apps/web/nuxt.config.ts`; configure `disallow: ['/']` with `allow: ['/login','/register','/forgot-password','/reset-password','/verify-email']` for user-agent `*`; confirm no route collision with `@vite-pwa/nuxt`
- [x] 1.3 REFACTOR: Extract the public-route list to a single shared constant so robots `allow` and any future auth-route logic stay in sync

## 2. Global head baseline (title template + description)

- [x] 2.1 RED: Write a test asserting a page with no explicit title renders a non-empty `<title>` ending in `· Readion` and a non-empty `<meta name="description">`, and that a page setting `Sign in` renders `Sign in · Readion`
- [x] 2.2 GREEN: Add `titleTemplate: '%s · Readion'`, a default `title`, and a default `meta` description to `nuxt.config.ts` `app.head` (or `site` config); set `site.url` from the public site-URL env/config source for absolute OG URLs
- [x] 2.3 REFACTOR: Ensure the manifest link, `theme-color`, and viewport meta still render alongside the new head entries

## 3. Social share metadata on public auth pages

- [ ] 3.1 RED: Write component/page tests asserting `/login` and `/register` emit `og:title`, `og:description`, and `twitter:card` with non-empty content
- [ ] 3.2 GREEN: Add `useSeoMeta({ title, description, ogTitle, ogDescription, twitterCard, ... })` to `app/pages/login.vue` and `app/pages/register.vue`; wire an existing icon as `ogImage` only if a raster asset exists, otherwise omit per design.md non-goals
- [ ] 3.3 REFACTOR: Factor shared OG defaults (site name, card type) so per-page blocks only set title/description

## 4. Acceptance Test — Outer Loop GREEN

- [ ] 4.1 Confirm the `seo-hygiene` acceptance test passes end-to-end
- [ ] 4.2 Verify `apps/web` starts in the local environment (smoke test) — boot the app and confirm no startup/config errors from the new module and head config; confirm `/robots.txt` responds and the PWA manifest still loads
- [ ] 4.3 REFACTOR: Clean up test setup and any duplicated selectors/assertions

## 5. Change Review — Subagent Verification

- [ ] 5.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [ ] 5.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 6. Polish

- [ ] 6.1 Run linter and fix all errors (`yarn lint`)
- [ ] 6.2 Run formatter and apply fixes (`yarn format:fix`)
- [ ] 6.3 Run type checker with zero errors (`yarn workspace @readion/web typecheck`)
- [ ] 6.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace @readion/web test:coverage`)
