## Reviewed Artifacts

- proposal.md
- specs/seo-hygiene/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| SUGGESTION | tasks.md | Polish commands could have referenced a non-existent workspace/scripts | Verified against `apps/web/package.json` — workspace is `@readion/web` with `typecheck`, `test:coverage`, `test:e2e`; `lint`/`format:fix` are root Biome. Tasks already matched; no change needed | tasks.md §6 (confirmed) |
| SUGGESTION | design.md / specs | `og:image` and `site.url`/canonical host are unresolved | Left as explicit Open Questions in design.md and handled conditionally in tasks (§2.2 site.url from public URL env, §3.2 ogImage only if a raster asset exists). Non-blocking — SVG-only OG image is a known limitation, not a spec requirement | design.md Open Questions, tasks.md §2.2/§3.2 |

No implementation-blocking gaps found. Capability `seo-hygiene` from proposal.md has a matching spec file. All four spec requirements (crawler exclusion, public-route allow, titled head, social meta) map to concrete scenarios, and every scenario has corresponding acceptance-test work in tasks §0 and per-component tests in §1–§3. Test Boundaries (no backend/DB; rendered-HTTP layer) are consistent with the tasks — no task invents a mock boundary design.md does not name.

## No Remaining Implementation-Blocking Gaps

Confirmed. The planning package is internally consistent: proposal scope (defensive-only, `Disallow: /` + `Allow:` public auth routes, module-based, OG cards on login/register) is reflected identically across specs, design decisions, and the outside-in task order. Nothing contradicts on route names, dependency choice, or verification expectations. Ready for implementation.

## Deferred Non-Blocking Notes

- **`og:image` asset**: only `public/icons/readion.svg` exists; many unfurlers won't render SVG OG images. Tasks wire `ogImage` only if a raster asset is present, otherwise omit. A bespoke PNG share image is intentionally out of scope (design.md Non-Goals) and can be added later without changing the spec.
- **`@nuxtjs/robots` vs `@nuxtjs/seo` umbrella**: resolved at implementation time (design.md Open Questions), default is the focused `@nuxtjs/robots`. Either satisfies the specs; the choice is a dependency-surface preference, not a behavioral gap.
