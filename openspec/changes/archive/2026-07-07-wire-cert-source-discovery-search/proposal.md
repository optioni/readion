## Why

The admin "discover sources" step (`POST /api/v1/admin/certifications/discover-sources`) can never return a candidate. Its web-search tool is backed by `CertWebSearchAdapter`, a placeholder whose `search()` returns `[]` unconditionally, and discovery deliberately drops any model-proposed URL that a real search did not surface (grounding guard). So every call returns `{ candidates: [] }` regardless of the certification entered — the feature looks wired (module boots, endpoint responds) but does nothing. This was mistaken for "done"; it is not shippable, because the primary path of an already-specified capability is inert in every environment.

## What Changes

- Replace the placeholder `CertWebSearchAdapter` (returns `[]`) with a real implementation of `CertSearchPort` backed by the **Tavily** web-search API, so discovery can surface grounded candidate URLs. Provider is swappable behind the port; Tavily is the initial concrete backend.
- Add env-schema config (`CERT_SEARCH_PROVIDER` default `tavily`, `TAVILY_API_KEY`, `CERT_SEARCH_MAX_RESULTS`) validated with Zod at API startup, following the fail-fast convention. When the provider is **not configured**, discovery MUST degrade to the existing empty-candidates behavior (never crash, never fabricate) and this state MUST be observable (log/metric), not silent.
- Map provider results into `CertSearchResult` (`url`, `title`, `snippet?`, `official?`), setting `official` from a vendor-domain heuristic so the existing vendor-first ranking in `assembleResponse` keeps working.
- Apply request timeout, error handling, and per-call result capping in the adapter; a provider error MUST degrade to empty candidates, not a 5xx from the discovery endpoint.
- No change to the discovery contract, the discovery endpoint, the grounding/dedup logic, or the admin UI — only the search backend behind `CERT_SEARCH_PORT` becomes real.

**Out of scope (called out so they aren't dropped):**
- Extraction, verification, draft creation, re-verification (the rest of `certification-setup`) already work against the scrapper and are unaffected.
- Ingesting/registering discovered sources into the knowledge base (owned by `content-source-admin`).
- The agent's own web-search tooling, if any — this change touches only cert-setup discovery.

## Capabilities

### New Capabilities
<!-- None — this reuses the existing certification-setup capability and its CERT_SEARCH_PORT seam. -->

### Modified Capabilities
- `certification-setup`: Adds a requirement that source discovery is backed by a configured, real web-search provider (replacing the placeholder), including provider configuration, graceful degradation when unconfigured or failing, and vendor-domain classification of results. The existing discovery request/response contract and grounding scenarios are unchanged.

## Impact

- **`apps/api`** (`src/cert-setup/`): `cert-web-search.adapter.ts` gains a real implementation; `cert-setup.module.ts` binding for `CERT_SEARCH_PORT` unchanged (still `useClass`). No controller/service contract change.
- **`packages/shared`** (`src/env/`) and **`apps/api` env schema**: new provider config vars + `.env.example` entries.
- **Config / deploy**: a new secret (search-provider API key) must be provisioned in each environment (k8s secret) for discovery to be live; absent it, discovery stays inert but healthy.
- **Depends on** (archived/complete): `certification-setup`, `llm-gateway`, `env-schema`.
- **No DB migration, no API contract change, no Orval regeneration.**
