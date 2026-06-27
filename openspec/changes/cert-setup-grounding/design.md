## Context

`certifications` ships verified seed data for primary-target certs and owns the `Certification` entity (with `state`, structured `provenance`, and `verifiedAt`). `cert-go-live` flips `draft`→`live` automatically when the coverage bar is met. What is still missing is the SPEC → Certification Setup & Grounding flow for a **new/unlisted** cert: discover the official guide, let the admin confirm the source, extract each exam-format field with a citation, flag what couldn't be grounded, persist a grounded draft, and re-verify when metadata goes stale.

All dependencies are archived: `certifications`, `content-pipeline` (scrapper + ingestion + the stale-source cron), `llm-foundation` (gateway with `certification-prefill` and `answer-verification` task types, and a `streamText` that already accepts `tools`/`stopWhen`), `grounding-verification` (shared extractive-contract validator + the independent-verifier discipline), `content-admin` (source registration + `ingestionQueueName` + audit vocab), and `admin` (`AuditLogService` + the append-only `AuditLog`, with `cert.published`/`cert.reverified` already in the vocabulary).

## Goals / Non-Goals

**Goals**
- Admin-only API for source discovery → source confirm → grounded per-field extraction with citations → unverified flagging → grounded draft creation → re-verification, all audited.
- A derived "due for re-verification" surface (API list + worker cron) driven by `verifiedAt` and a configurable interval.
- Reuse the existing scrapper, grounding contract, gateway, source-registration, and audit layers — orchestrate, don't reimplement.

**Non-Goals**
- The coverage-bar evaluation and automatic `draft`→`live` promotion (owned by `cert-go-live`). This change leaves new certs in `draft`.
- Source registration / manual re-ingest / job status (owned by `content-admin`; suggested sources are handed to those endpoints).
- The web admin UI (Phase 10 `web-admin`).
- Any new entity, table, or migration.

## Decisions

- **No new entity, no migration.** Per the Entity ownership table this change owns no entity. The confirmed `sourceUrl` and per-field citations live in the existing `Certification.provenance` JSON column; the unverified/manually-confirmed states are additive JSON shapes over that same column; the due-for-reverification flag is **derived** from `verifiedAt` + `CERT_REVERIFICATION_INTERVAL_DAYS`. Adding a stored boolean would duplicate derivable state. Alternative — a `reverificationDueAt` column or a setup-session entity — rejected as redundant given the data is derivable and the flow is stateless.

- **Stateless multi-step flow.** Discovery, extraction, and creation are independent requests; the client carries the admin's confirmed source and reviewed fields forward. No "cert setup session" is persisted. This keeps the human gate (source confirm, field confirm) on the client and avoids a throwaway entity.

- **Per-field provenance is a three-state union (additive to the shared type).** `CertificationProvenance` stays `'verified' | Record<field, …>`; the per-field value becomes `CertificationFieldCitation { url, passage } | { unverified: true } | { manuallyConfirmed: true }`. Because the column is `p.json`, this is a TypeScript-only additive extension with **no migration**. `certifications` explicitly designed provenance to accommodate per-field citations "without a schema migration"; this extends that intent to the unverified/manual states.

- **Discovery uses the gateway's existing tool-capable streaming call.** `LlmService.streamText` already accepts `tools`/`stopWhen`; discovery resolves the `certification-prefill` task type and supplies the provider's web-search tool, consuming the final result. No change to the gateway is needed (the API's non-streaming `generateText` does not pass tools, but discovery does not require streaming-to-client — it just awaits the resolved result). The model grounds candidates in the search-tool results; it must not fabricate URLs.

- **Extraction is an async worker job with an explicit produce/poll API contract.** The scrapper client lives only in `apps/worker`, and the worker has both `LlmService` and access to the shared extractive-contract validator. `POST /api/v1/admin/certifications/extract` enqueues one `cert-extraction` job (cross-app BullMQ queue, shared name constant — mirroring `ingestionQueueName`) carrying `{ name, code, confirmedSourceUrl }` and returns `202 { jobId, state }`; `GET /api/v1/admin/certifications/extractions/:jobId` returns `200 { state, fields }` (`fields` null until the job completes, `404` for an unknown job id). The cert does not exist yet during extraction, so the result is keyed by `jobId`, not a cert id. This mirrors the established `content-admin` admin→worker job + status-read pattern rather than blocking the request on the scrapper.
- **The grounding contract is honored via the shared validator + an independent verifier call.** In the worker job, per field, the system (a) validates the cited passage is a **verbatim** substring of the fetched source using the shared extractive-contract validator from `grounding-verification`, and (b) issues an **independent verifier** call (`answer-verification` task type, distinct from the extraction call) that the value is entailed by the passage. A field failing either is flagged `unverified`. This satisfies SPEC's "extract each field with a citation to the exact source passage" and the grounding-layer's generate-then-verify discipline. See Open Questions for the boundary nuance.

- **Audit vocabulary extended additively.** Add `cert.created` to `@readion/shared` `auditActions`; reuse the already-present `cert.reverified` for re-verification. `cert.published` is left to `cert-go-live`/promotion. Creation, re-verification (and, when the admin registers a suggested source, the existing `source.added`) are the audited privileged actions.

- **Due-for-reverification: derived flag + a surfacing cron, not a mutation cron.** The cross-cutting table lists "Stale-source re-ingestion + cert 'due for re-verification' flag" as shared between `content-pipeline` and this change. `content-pipeline` already owns and ships the stale-**source** re-ingestion cron (`stale-source.cron.ts`). This change owns the cert **metadata** half: a separate worker cron that scans certs with stale/null `verifiedAt` and **surfaces** them (gauge metric of the due count + log) plus the admin `due-for-reverification` list endpoint. The cron mutates nothing — re-verification is an explicit admin action.

## Test Boundaries

Outside-in TDD. The acceptance test boots `CertSetupModule` with `AdminModule` (`AuditLogService`), `CertificationsModule`, real `JwtAuthGuard`/`RolesGuard`, and the registered `cert-extraction` queue, against Testcontainers Postgres + Redis; it registers the first user (auto-admin) plus a `user`-role account.

| Dependency | In acceptance/integration tests | Notes |
|---|---|---|
| Postgres (`certifications`, `audit_logs`) | real (Testcontainers) | assert draft creation, provenance persistence, `verifiedAt`, audit rows |
| Redis / BullMQ `cert-extraction` queue | real | API asserts the producer contract (job enqueued with the right data) and that `GET .../extractions/:jobId` returns the job state; the worker processor is **not** booted by the API harness, so the API test reads job `state`/`404` and seeds a completed-job result when it needs to assert the `fields` read — the real per-field grounding result is asserted in the worker processor test (tasks group 4) |
| Web-search tool / LLM gateway | **stubbed** at the gateway boundary | discovery and extraction inject a fake gateway returning canned candidates / extraction so tests are deterministic; the real provider is never called in CI |
| Scrapper sidecar | **stubbed** in worker extraction tests; real in the local smoke step | per the existing worker scrapper test pattern |
| Grounding extractive-contract validator | real (shared pure function) | verbatim-substring checks run against fixture source text |

Pure-logic unit tests: the verbatim-passage extraction validator wiring, the per-field provenance builder (citation/unverified/manuallyConfirmed), the domain-weights-sum-to-100 validator, the discovery vendor-domain ranking, and the `dueForReverification` derivation from `verifiedAt` + interval.

## Risks / Trade-offs

- **Web-search quality / hallucinated URLs** → discovery returns only URLs grounded in actual search-tool results and ranks vendor domains first; the admin confirms the source before any extraction, so a wrong candidate is caught at the human gate. An empty `candidates` array is preferred over a fabricated URL.
- **Extraction misreads a field** → every grounded field must carry a verbatim passage and pass the independent verifier; anything else is flagged `unverified` for manual confirmation, so silent fabrication is structurally prevented. The admin reviews each field next to its citation before creation.
- **Cross-app queue drift (API producer / worker consumer)** → use a single shared `cert-extraction` queue-name constant in `@readion/shared`, imported by both apps (same pattern `content-admin` established for `ingestionQueueName`).
- **A second scrapper touch-point** → extraction reuses the worker's existing scrapper client (runs in the worker), so no scrapper client is added to the API and no fetch strategy is duplicated.

## Open Questions

- **"Per-field extraction MUST go through the existing grounding/verifier layer" — interpretation taken.** The api `GroundingModule.VerifierService` is shaped for quiz items (`verify(item, chunks)` with options/distractors) and lives in `apps/api` only; it is not a literal fit for single-value field extraction, and the extraction runs in the worker (where the scrapper is). This change therefore reuses the **shared** extractive-contract validator (verbatim-passage grounding, published in `packages/shared` by `grounding-verification`) plus an **independent `answer-verification` verifier call** (the same generate-then-verify discipline), rather than importing the quiz-shaped `VerifierService` object. This honors the grounding *contract* at the boundary the firm instruction names. If the team prefers a single reusable object, the cleanest follow-up is to add a field-extraction `verify` method to the shared grounding layer — flagged for review, not assumed here.
- **Suggested-source auto-registration.** This change surfaces suggested content sources for review only; registering + ingesting them goes through the existing `content-source-admin` endpoints. Whether the web UI chains those calls is a Phase 10 (`web-admin`) concern, out of scope here.
