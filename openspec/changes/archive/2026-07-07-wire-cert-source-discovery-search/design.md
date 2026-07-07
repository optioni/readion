## Context

`CertDiscoveryService` runs the `certification-prefill` task through the LLM gateway with a locally-defined `webSearch` tool. That tool's `execute` calls `CertSearchPort.search(query)`. The only binding for `CERT_SEARCH_PORT` is `CertWebSearchAdapter`, which returns `[]`. `assembleResponse` then keeps only model-proposed URLs that appear in the search results (`grounded` map) and ranks vendor-domain hits first via `rankDiscoveryCandidates` + `deriveVendorDomains` (which reads each result's `official` flag). Because the search returns nothing, the grounded set is always empty and candidates is always `[]`.

The seam is already correct — the abstraction (`CertSearchPort` → `CertSearchResult[]`) is exactly what a real provider needs to satisfy. This change only supplies a real implementation and its configuration.

## Goals / Non-Goals

**Goals**
- Discovery returns real, grounded candidates when a provider is configured.
- Zero behavior change when unconfigured (safe default), but the inert state is observable.
- No change to the endpoint contract, grounding guard, ranking, or UI.

**Non-Goals**
- Reworking the gateway or the `certification-prefill` task wiring.
- Auto-registering discovered sources into the knowledge base.

## Decisions

### Decision 1: Dedicated search API behind `CertSearchPort` (vs. provider-native web search)

Two ways to make search real:

- **(A) Dedicated search API** (Brave Search API, Tavily, Exa, Google Programmable Search) called from a concrete `CertWebSearchAdapter`. Fits the existing `CertSearchPort` seam exactly; provider-agnostic; returns structured results with URLs/titles/snippets that map straight to `CertSearchResult`; easy to set `official` from the host.
- **(B) Provider-native server-side web search** (the model provider performs the search as a server tool). Would mean removing the local `webSearch` tool + `CertSearchPort` and trusting the model's tool results for grounding — a larger refactor, and grounding becomes harder to enforce because we no longer hold the raw result set independently.

**Chosen: (A), with Tavily as the concrete provider.** It is the minimal change that fills the existing seam, keeps the independent grounding set (we still hold the raw results to validate model output against), and keeps provider choice swappable behind the port. Tavily was chosen for its simple keyed HTTP API and result shape (`url`, `title`, `content` snippet) that maps directly to `CertSearchResult`; the port abstraction means a later swap to Brave/Exa/CSE stays local to the adapter.

Env var shape: `CERT_SEARCH_PROVIDER` (default `tavily`), `TAVILY_API_KEY`, optional `CERT_SEARCH_MAX_RESULTS` (default e.g. 8). All validated in the API Zod env schema; discovery stays inert (empty candidates) when `TAVILY_API_KEY` is absent.

### Decision 2: Unconfigured = safe inert, but observable

Keep the placeholder's virtue (deterministic, never hallucinates) as the *degraded* path, not the *only* path. When creds are absent the adapter short-circuits to `[]` and emits a one-time log + a counter so operators can tell "not wired" from "found nothing". This prevents a silent regression back to the current state after deploy.

### Decision 3: Vendor-domain `official` heuristic stays in the adapter

`deriveVendorDomains` already keys off `CertSearchResult.official`. The adapter sets `official = true` when the result host matches a known vendor domain (aws.amazon.com, learn.microsoft.com, kubernetes.io, etc.) or, more generally, when the host is the registrable domain the model was asked about. Keep the vendor list in shared config so ranking and adapter agree.

## Risks / Trade-offs

- **External dependency + cost:** discovery now makes a paid third-party call. Mitigate with the result cap, request timeout, and (optionally) caching identical queries in Redis (the LLM-cache infra already exists) — cache is out of scope here but noted.
- **Secret provisioning:** each environment needs the API key or discovery stays inert. The observability requirement makes that state visible rather than a mystery.
- **Provider result quality varies:** ranking + grounding already defend against junk URLs; worst case is a weaker candidate list, not a wrong persisted cert (discovery persists nothing).

## Test Boundaries

- **Unit:** the concrete adapter maps a provider payload → `CertSearchResult[]`, sets `official` correctly, caps results, and returns `[]` on missing config / provider error / timeout. The provider HTTP client is faked (no live network).
- **Integration:** the existing cert-setup acceptance harness overrides `CERT_SEARCH_PORT` with a fake returning ranked vendor pages — reused to prove vendor-first ordering end-to-end through the real service. A second case binds a "throws" fake and asserts `200` + empty candidates.
- **No live provider call in CI.**
