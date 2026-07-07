## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Extend the cert-setup acceptance harness so `CERT_SEARCH_PORT` can be bound to (a) a fake returning ranked vendor + third-party results and (b) a fake that throws / times out
- [x] 0.2 Write failing acceptance test: with the configured (vendor-returning) fake, `POST /api/v1/admin/certifications/discover-sources { name, code }` returns `200` with a **non-empty** `candidates` array, vendor-domain candidate ranked first
- [x] 0.3 Confirm it fails for the right reason against the current placeholder (candidates always empty), not a harness error

## 1. Env config for the search provider

- [x] 1.1 RED: unit test the env schema — provider vars parse when present; the schema still validates (API boots) when they are **absent**
- [x] 1.2 GREEN: add `CERT_SEARCH_PROVIDER` (default `tavily`), `TAVILY_API_KEY`, `CERT_SEARCH_MAX_RESULTS` to the API Zod env schema and `packages/shared` env types; add `.env.example` entries
- [x] 1.3 REFACTOR: colocate a typed `getSearchProviderConfig()` accessor; document the "unconfigured = inert" contract in the WHY comment

## 2. Concrete CertSearchPort adapter

- [x] 2.1 RED: unit test the adapter with a faked HTTP client — maps provider payload → `CertSearchResult[]` (`url`, `title`, `snippet?`), sets `official` from the vendor-domain heuristic, caps to max results
- [x] 2.2 RED: unit test degraded paths — missing config → `[]`; provider error → `[]`; timeout → `[]`; each emits the not-configured / failed log or metric exactly once
- [x] 2.3 GREEN: implement the concrete Tavily-backed adapter (POST to Tavily search, map `results[]` → `CertSearchResult`) with request timeout and result cap; keep `CERT_SEARCH_PORT` bound `useClass` in `cert-setup.module.ts`
- [x] 2.4 GREEN: add the vendor-domain list to shared config and use it for `official`
- [x] 2.5 REFACTOR: extract the HTTP call behind a small injectable client for testability; ensure no provider SDK/model id is hardcoded outside config

## 3. Observability of the inert/failed state

- [x] 3.1 RED: assert (unit or integration) that an unconfigured search increments a "discovery search unavailable" counter / logs a warn, distinct from a genuine empty result
- [x] 3.2 GREEN: wire the metric/log through existing observability infra
- [x] 3.3 REFACTOR: clean up metric naming to match the worker/api conventions

## 4. Acceptance Test — Outer Loop GREEN

- [x] 4.1 Configured-fake acceptance test passes: non-empty, vendor-first candidates end-to-end
- [x] 4.2 Throwing-fake case returns `200` + empty candidates (no 5xx)
- [x] 4.3 Grounding guard regression still holds: a model-proposed URL absent from search results is dropped
- [x] 4.4 Smoke: boot `apps/api` with and without provider creds set — no startup error in either case

## 5. Deploy wiring (docs only in this change)

- [x] 5.1 Note the required secret (search-provider API key) in the API `.env.example` and the k8s secret manifest/README so each environment can turn discovery live; absent it, discovery stays inert but healthy
