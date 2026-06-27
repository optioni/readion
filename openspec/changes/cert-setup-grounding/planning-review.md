## Reviewed Artifacts

- proposal.md
- specs/certification-setup/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Resolution | Updated artifact / section |
|---|---|---|---|---|
| WARNING | design.md / tasks.md | "Per-field extraction MUST go through the existing grounding/verifier layer" could be read as importing the api `GroundingModule.VerifierService` (a quiz-shaped `verify(item, chunks)` object that lives in `apps/api` only) into the worker | Confirmed the artifacts already resolve this: extraction runs in the worker (where the scrapper lives) and honors the grounding *contract* via the shared extractive-contract validator (verbatim-passage substring check, published in `@readion/shared` by `grounding-verification`) plus an independent `answer-verification` verifier call — the generate-then-verify discipline — rather than the quiz-shaped service object. Recorded the clean follow-up (a field-extraction `verify` method on the shared grounding layer) as a non-blocking note, not a guess. | design.md § Open Questions (verified); tasks.md § 4 (4.1) |
| WARNING | tasks.md / design.md | The cross-cutting table lists "Stale-source re-ingestion + cert 'due for re-verification' flag" as shared between `content-pipeline` and this change, which could read as this change re-owning the stale-source cron | Confirmed the split is explicit: `content-pipeline` already ships `stale-source.cron.ts` (stale-**source** re-ingestion); this change owns only the cert-**metadata** half — a separate surfacing-only cron (`cert-reverification.cron.ts` + due-count gauge) plus the admin `due-for-reverification` list endpoint. The new cron mutates no certification row. | design.md § Decisions (due-for-reverification); tasks.md § 7 |
| SUGGESTION | proposal.md / design.md | SPEC → Certification Setup & Grounding couples grounded setup with the coverage-bar auto draft→live flip, which could read as in-scope here | Confirmed both artifacts scope this change to leaving new certs in `state: draft` and assign the coverage-bar / automatic `draft`→`live` promotion to the archived `cert-go-live` change; no change needed. | design.md § Non-Goals (verified) |

## No Remaining Implementation-Blocking Gaps

The single `certification-setup` spec's eight ADDED requirements all map to proposal.md, and there are no MODIFIED/REMOVED/RENAMED requirements (the `cert.created` audit value and the per-field provenance union are additive shared extensions, captured as ADDED requirements, not behavioral changes to the archived `audit-log`, `certifications`, or `grounding-verification` capabilities). Every spec scenario is concrete — explicit inputs, status codes (`200`/`201`/`202`/`404`/`409`/`422`/`403`/`401`), audit rows, provenance/`verifiedAt` persistence, and queue/job assertions — and each is covered by acceptance work in tasks group 0, service tests in group 5, controller tests in group 6, the worker extraction-processor test in group 4, and the cron test in group 7.

design.md resolves the implementation-critical choices: **no new entity or migration** (confirmed source URL, per-field citations, and unverified/manually-confirmed states all live additively in the existing `Certification.provenance` JSON column; the due-for-reverification flag is derived from `verifiedAt` + `CERT_REVERIFICATION_INTERVAL_DAYS`); a **stateless multi-step flow** (discover → confirm → extract → create → reverify, with the human gate on the client, no throwaway setup-session entity); discovery via the gateway's existing tool-capable `streamText` (`certification-prefill` task type + web-search tool + `stopWhen`, no gateway change); extraction as an async cross-app BullMQ `cert-extraction` job (shared queue-name constant mirroring `ingestionQueueName`, `202 { jobId, state }` produce + `GET .../extractions/:jobId` poll, keyed by `jobId` since the cert does not exist yet); the grounding contract honored via the shared verbatim-passage validator + independent verifier; and additive audit vocabulary (`cert.created`, reusing existing `cert.reverified`).

Test Boundaries name every collaborator (Postgres + `audit_logs` real via Testcontainers; Redis/BullMQ `cert-extraction` queue real with the API asserting the producer contract only since the worker processor is not booted by the API harness; the LLM gateway and scrapper stubbed at their boundaries; the shared grounding validator real). Tasks invent no mock boundary beyond these and follow strict RED → GREEN → REFACTOR. All five dependencies (`certifications`, `content-pipeline`, `llm-foundation`, `content-admin`, `admin`) are archived under `openspec/changes/archive/`. Implementation may proceed.

## Deferred Non-Blocking Notes

- A field-extraction `verify` method on the shared `grounding-verification` layer would let the api `GroundingModule` and this worker extraction job share one object; deferred as a clean follow-up rather than a prerequisite (design.md § Open Questions).
- Suggested content sources are surfaced for admin review only; registering + ingesting them flows through the existing `content-source-admin` endpoints owned by the archived `content-admin` change. Whether the Phase 10 `web-admin` UI chains those calls is out of scope here.
- The `cert-extraction` recent-result retention and the BullMQ state set scanned for the `extractions/:jobId` read are left as implementation-chosen constants; defaults are sufficient for the low-traffic admin surface.
