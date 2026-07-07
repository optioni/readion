## Reviewed Artifacts

- proposal.md
- specs/certification-setup/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| SUGGESTION | design.md | Provider was left as an open question ("Tavily or Brave"), leaving the env-var shape and mapping code undecided before coding. | Fixed the provider to **Tavily**, specified the env vars (`CERT_SEARCH_PROVIDER`, `TAVILY_API_KEY`, `CERT_SEARCH_MAX_RESULTS`) and the `results[] → CertSearchResult` mapping. | design.md § Decision 1; proposal.md § What Changes; tasks.md 1.2, 2.3 |
| SUGGESTION | specs / design | The `official` flag that drives vendor-first ranking must have a concrete source, since `deriveVendorDomains` reads `official` from results (circular unless the adapter sets it from a known list). | Confirmed the resolution is already specified: adapter sets `official` from a static vendor-domain list in shared config (design § Decision 3), with tasks.md 2.4 owning it. No artifact change needed beyond noting coverage. | design.md § Decision 3; tasks.md 2.4 |

## No Remaining Implementation-Blocking Gaps

Confirmed. Reviewed the four artifacts as one contract:

- **Capability coverage** — proposal names exactly one modified capability (`certification-setup`); the matching delta spec exists with all new behavior under `## ADDED Requirements`. No capability appears only in tasks/design.
- **Scenario coverage** — all four spec scenarios have acceptance/unit work in tasks.md: "configured yields grounded" → 0.2 + 4.1; "not configured degrades to empty" → 2.2 (adapter unit) + 3.1 (observability); "provider error is not a 5xx" → 0.1 + 4.2; "only genuinely-surfaced URLs eligible" (grounding guard) → 4.3. The unconfigured and error endpoint behaviors are behaviorally identical (200 + empty candidates) and distinguished only by the observability signal, which 3.1 asserts.
- **Design completeness** — provider, env/config shape, degradation contract (unconfigured/error → 200 empty, observable), timeout + result cap, and the vendor-domain `official` heuristic are all decided. No DB migration, no API-contract change, no Orval regen (correctly reflected — the discovery endpoint contract is unchanged).
- **Test boundaries** — design names the faked HTTP client (adapter unit tests) and the cert-setup acceptance-harness `CERT_SEARCH_PORT` override (integration); tasks introduce no mock boundary design.md does not name; no live provider call in CI.
- **Task alignment** — outside-in order holds (acceptance RED → env → adapter → observability → acceptance GREEN → deploy docs); every requirement, scenario, and design decision has a task; the deploy-secret note is captured in 5.1.
- **Contradictions** — none: proposal, spec, design, and tasks agree on Tavily, the env vars, the degraded-but-observable behavior, and "no contract change / no migration".

## Deferred Non-Blocking Notes

- **Query-result caching** (Redis, via the existing LLM-cache infra) to avoid repeat paid searches for identical discovery queries is explicitly out of scope here and noted as a follow-up in design.md § Risks. Not implementation-blocking.
