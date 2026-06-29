## Reviewed Artifacts

- proposal.md
- specs/web-admin/spec.md
- design.md
- tasks.md

Reviewed as one contract against the live backend (`apps/api/src/{admin,content,cert-setup,certifications,grounding,users}`), the shared schemas (`packages/shared/src/{certification-setup,content-pipeline,admin,users,auth}`), and the committed Orval client (`apps/web/src/api/{admin,content,cert-setup,certifications,certification-coverage}`). The contract realities the planning package depends on were verified directly in source:

- **All consumed endpoints already exist in the committed Orval client — no `yarn codegen`.** Confirmed every method named in proposal/design/tasks is generated and committed: `adminControllerListUsers` / `Promote` / `Demote` / `ListAuditLogs`; `contentControllerList` / `Register` / `FindOne` / `Enable` / `Disable` / `Reingest` / `ListJobs` / `JobStatus`; `certSetupControllerDiscoverSources` / `Extract` / `ReadExtraction` / `ListDueForReverification` / `Create` / `Reverify`; `certificationCoverageControllerCoverage`; `certificationsControllerDetail`. The Phase-8 admin modules are archived; the client mirrors them. ✔
- **Quarantine review has no backend.** `apps/api/src/grounding/quarantine.service.ts` exposes only `quarantine()` (cache eviction + Prometheus counter); no controller lists/reads/resolves quarantined items, and the only feeder is the user-facing `POST /api/v1/quiz/:questionId/report`. ✔ The Review-queue placeholder (no requests, no fabricated data, no badge count) is the correct treatment.
- **Field extraction returns four grounded fields only.** `CertExtractionFields` = `domains`, `questionCount`, `passingScore`, `timeLimitMinutes` (each `{value,citation}` | `{unverified:true}`). ✔ The artboard's ~11 metadata fields are correctly dropped to four + admin-entered `name`/`provider`/`code`.
- **No publish gate / automatic go-live.** SPEC.md → Certification Setup & Grounding ("Draft → live is automatic … there is no manual 'publish' button"); `POST /admin/certifications` creates a `draft`; coverage is read via `GET /certifications/:id/coverage`. ✔ The artboard's "Publish certification" + sign-off is correctly removed.
- **Source registration is URL-only**, with no chunk-count/status/name field, no job-cancel, and no delete (`registerSourceRequestSchema` + `ContentSourceResponse` in `content-pipeline/index.ts`; `ContentController` has only `enable`/`disable`/`reingest`/`jobs`). ✔ The Sources reconciliation matches.
- **`role` is already on the profile contract.** `UsersService.toProfile` returns `role`; `@readion/shared` `authUserSchema` includes it; only the hand-written `app/stores/auth.ts` `AuthUser` omits it. ✔ The planned `AuthUser` extension + admin middleware are sound and require no backend work.
- **`certificationsControllerList`/`Detail` filter to `state: 'live'`** (`certifications.service.ts`). ✔ Confirmed this does not block re-verification (due certs are live) and correctly leaves draft-cert browsing as a flagged follow-up.

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | specs/web-admin/spec.md (Cert setup — draft creation) + tasks.md (task 8) + design.md (Decisions) | The submit endpoint `POST /admin/certifications` returns `409` (duplicate code) and `422` (domain weights must sum to 100) — verified in `cert-setup.controller.ts` — but no spec scenario, design decision, or task covered these error states. Grounded `domains` can be partial/unverified, so a `422` weight-sum failure is a realistic, unhandled path. | Added a spec scenario "Submission surfaces contract validation errors" (409/422 → surface error, keep fields editable); added a design **Pin** under the cert-setup-persists decision (handle 409/422; gate submit on a client-side weight-sum check via `validateDomainWeights`); extended task 8.1 to assert both error paths and the pre-submit weight check. | spec.md → "draft creation"; design.md → Decisions; tasks.md → 8.1 |
| WARNING | design.md (Decisions) + tasks.md (task 7) | The extraction poll was specified only as "poll until `fields` non-null", with no handling for a failed/terminal-without-fields extraction job (the worker can fail). | Added a design **Pin** keying the poll off `data.state` (continue while non-terminal, surface a retryable error on terminal-without-fields, stop on success). Task 7.1 already polls `ReadExtraction` until `fields` present; the design now pins the terminal/failure behaviour an implementer must build to. | design.md → Decisions |
| SUGGESTION | specs/web-admin/spec.md (shell requirement) + tasks.md (task 1) | The shell requirement enumerated only the five owned sections, while design.md and the `AdminSidebar` artboard also carry a `Settings` nav item — leaving ambiguous whether `Settings` should render and where it routes. | Clarified the spec shell requirement and task 1.1 that `Settings` is a nav item linking out to the existing `/settings` page (`web-settings`), not a web-admin-owned section. | spec.md → shell requirement; tasks.md → 1.1 |
| SUGGESTION | design.md (Decisions — re-verification) | Did not state why `certificationsControllerDetail` (live-only) is safe to read for a stale cert. | Added a note that `due-for-reverification` certs are already `live`, so the live-only Detail filter resolves them. | design.md → Decisions |

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved. Confirmed after fixes:

- **Capability coverage** — proposal names exactly one new capability (`web-admin`) with a matching `specs/web-admin/spec.md`; no modified/removed backend capabilities (frontend-only consumer). No capability exists only in tasks/design.
- **Scenario coverage** — every spec requirement maps to a concrete, mockable acceptance scenario and to outside-in task work: shell + role gate → task 1 + acceptance 0.2; users promote/demote (incl. 409) → task 3; audit log read-only → task 4; sources list/register-by-URL/reingest/disable + job status → task 5; cert-setup discovery → task 6; grounded extraction + citations + unverified flags → task 7; sources+coverage + draft submit (no publish, 409/422 paths) → task 8; re-verification (due list + client diff) → task 9; quarantine placeholder (no requests) → task 10.
- **Endpoints pinned to concrete client methods** — each surface names its generated Orval method(s) in design.md Test Boundaries and tasks; weak success types are narrowed via `@readion/shared` types/schemas (`registerSourceRequestSchema`, `discoverSourcesRequestSchema`, `extractRequestSchema`, `createCertificationRequestSchema`, `reverifyCertificationRequestSchema`, `DiscoverSourcesResponse`, `ExtractionStatusResponse`, `ContentSourceResponse`, `IngestionJobStatus`, `DueForReverificationItem`); the `provenance` map is built with `buildProvenanceMap`.
- **Test boundaries** — design.md's mocked collaborators (the named generated methods, real Pinia auth store with `role`, real `@readion/shared`) exactly match what tasks.md mocks; no task invents an un-named boundary. NestJS/Postgres/Redis are correctly out of scope.
- **Task alignment** — outside-in order holds (acceptance RED → shell/gate → query keys → users → audit → sources → cert-setup steps → re-verify → quarantine placeholder → acceptance GREEN → review → polish), includes per-surface visual-design reconciliation, a smoke/verify step (11.2), subagent review (12), and lint/format/typecheck/coverage (13). No backend/migration/codegen work is required or implied.
- **No contradictions remain** across proposal/spec/design/tasks on scope, endpoints, domain names, persistence behaviour, dependencies, or UI copy/states. `validate web-admin --strict` passes.

## Deferred Non-Blocking Notes

Backend follow-ups are intentionally deferred and out of scope for this frontend change, already recorded in proposal.md (Impact → "Backend gaps flagged") and design.md (Open Questions); none block implementation, because each affected surface is fully specified against the contract as it exists today (the Review queue ships as an honest placeholder):

1. A persisted quarantine store + admin list/review/resolve endpoints so the Review queue can be built (`grounding-verification`/`content-admin`).
2. Admin listing/detail of `draft` certifications (`certifications`/`cert-setup-grounding`).
3. Content-source chunk-count/status fields, job-cancel, delete, and a file-upload path (`content-admin`).
4. A server-computed re-verification diff (`cert-setup-grounding`).
5. User search / last-active and an admin delete, plus audit-log actor resolution and CSV export (`admin`).
