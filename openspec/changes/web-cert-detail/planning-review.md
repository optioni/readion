## Reviewed Artifacts

- proposal.md
- specs/web-cert-detail/spec.md
- design.md
- tasks.md

Cross-checked against the source-of-truth roadmap entry (`openspec/IMPLEMENTATION-ORDER.md` line 304 — `web-cert-detail`), SPEC → Layout Decisions / Dashboard / Progress, DESIGN.md tokens, the committed Orval client (`apps/web/src/api`), and the archived `web-dashboard` helpers (`apps/web/app/composables`).

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| SUGGESTION | tasks.md §0.1 and design.md Decisions | The review due-count generated method was written as `enrollmentReviewController…` (ellipsis placeholder), leaving the exact client method and response field unresolved before implementation. | Verified against the committed client: the method is `enrollmentReviewControllerQueue`, returning the due count in `meta.dueCount` (matches the design Context contract `GET /:id/review → { items[], meta: { dueCount, total } }`). Replaced the ellipsis with the concrete name + field. | tasks.md §0.1; design.md Decisions ("No `yarn codegen`") |

No CRITICAL or WARNING gaps were found. The remaining checklist dimensions verified clean:

- **Capability coverage** — proposal names exactly one capability (`web-cert-detail`); one matching spec file exists (`specs/web-cert-detail/spec.md`); all five requirements sit under ADDED Requirements; no capability lives only in tasks.md or design.md.
- **Scenario coverage** — every spec scenario maps to acceptance/component/unit work: navigation + header/tabs (0.3, 1.1, 1.2), unowned-enrollment 404 not-found (1.1), stat row calibrated/uncalibrated + trajectory (2.3), full per-domain breakdown with "no data yet" (2.1, 2.4), suggested next focus with fallback (2.2), recent sessions with accuracy + empty state (2.4), sessions history table + client-side type filter + empty state (3.1, 3.2), exam history with score/pass-fail + empty state (4.1).
- **Design completeness** — module boundaries (page/components/composables/pure helpers), API contracts (each endpoint verified against the named NestJS controllers), error/empty handling (per-panel independent degradation, §2.6), and UI states are all resolved; no entities, migrations, crons, metrics, or codegen are in scope, consistent across all four artifacts.
- **Test boundaries** — design.md Test Boundaries names each real-vs-mocked collaborator (real API + Postgres/Redis via Testcontainers for e2e; HTTP/fetch mock for Vitest); no task invents a mock boundary the design does not name.
- **Reuse claims hold** — `statusColorForScore`, `formatReadiness`, `fetchRecentSessionSummaries`, `dashboardQueryKeys`, and `runnerRoutes` (`sessionRunPath`, `mockExamRunPath`, `reviewRunPath`) all exist in `apps/web/app/composables`; the session-row link target (`/sessions/:id`) is concrete.
- **No-codegen claim holds** — every consumed endpoint is present in the committed client (`user-certifications`, `certifications`, `readiness`, weak-areas via `user-certifications`, `sessions`, `session-summary`, `enrollment-review`, `enrollment-mock-exam`); §0.1 asserts this before building.
- **No contradictions** — proposal, specs, design, and tasks agree on scope, endpoints (including the no-`kind`-param sessions list and the client-side filter resolution), domain-breakdown source (`certification.domains` joined to weak-areas), readiness "not yet calibrated" semantics, and the no-exam-date-countdown decision.

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved. The one issue found was an under-specified generated method name; it has been pinned to the concrete `enrollmentReviewControllerQueue` (`meta.dueCount`) in both owning artifacts. The planning package is internally consistent, traces fully to the IMPLEMENTATION-ORDER `web-cert-detail` roadmap entry and the SPEC cert-detail intent, and every spec scenario has matching outside-in test work. Implementation may proceed.

## Deferred Non-Blocking Notes

- **Mock-exam "review" route vs. runner route.** The spec asks exam-history rows to link "into the mock-exam review route"; `runnerRoutes` currently exposes `mockExamRunPath` → `/mock-exams/:id` (whether that lands a submitted attempt directly in review mode is owned by the not-yet-built `web-mock-exam`). Already deferred in design.md Open Questions; tasks.md §4.3 routes through `runnerRoutes`, so the link target is reconciled in one place when `web-mock-exam` lands. Not blocking — the link is functional today.
- **Canonical artboard `CertDetail.html` not pulled.** DesignSync was unavailable at authoring time, so the visual section is driven by SPEC + DESIGN.md tokens + dashboard patterns rather than a diffed artboard. Explicitly deferred and tracked by tasks.md §7.5 (re-pull + re-diff the reconciliation table when DesignSync is available). Behavioural specs remain authoritative, so this does not block implementation.
