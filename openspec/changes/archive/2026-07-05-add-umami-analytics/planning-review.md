## Reviewed Artifacts

- proposal.md
- specs/web-analytics/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | tasks.md | Type-check task used `yarn workspace apps/web typecheck`, but the Yarn workspace is named `@readion/web` (verified in `apps/web/package.json`); the command would fail. | Corrected command to `yarn workspace @readion/web typecheck`. | tasks.md § 10.3 |
| WARNING | tasks.md / design.md | Group 7 and the CSP risk assumed `apps/web` has a CSP to loosen, but there is no CSP, security module, or `routeRules` header config in `apps/web` source (verified). Task would send an implementer hunting for config that doesn't exist. | Reworked group 7 to verify-first ("no CSP today; add allowance only if one exists/is added, else record no-change and skip"); updated design Risk and Open Question to state the verified current state. | tasks.md § 7; design.md Risks, Open Questions |
| WARNING | specs/web-analytics/spec.md ↔ tasks.md | The "Automatic page-view tracking across SPA navigation" requirement had a scenario but no explicit task asserting a page view is recorded on route change; only custom events were covered. | Added task 2.3 to assert the stub captures a page view on initial load and on a client-side route change. | tasks.md § 2.3 |
| SUGGESTION | proposal.md / design.md | Both said "~22 custom events" while the spec catalog defines 25, an internal contradiction. | Recounted the catalog (25 events) and updated both figures to 25. | proposal.md § What Changes; design.md Goals |

## No Remaining Implementation-Blocking Gaps

Capability coverage is complete: the single new capability `web-analytics` named in proposal.md has a matching `specs/web-analytics/spec.md`; there are no modified/removed capabilities. Every spec scenario (bootstrap gating, SSR no-op, page views, typed track, UUID-only identify, PII absence, and the per-event catalog scenarios) has corresponding acceptance/unit work in tasks.md, ordered outside-in. Design Test Boundaries name every collaborator the tests touch (tracker stub, config, auth store, existing composable mocks), and no task invents a boundary the design does not list. No implementation-blocking gaps remain.

## Deferred Non-Blocking Notes

- Auth-failure events (`login_failed`, `signup_failed`) and DNT/consent gating are intentionally out of scope for v1; both are recorded in design.md Open Questions as easy additive follow-ups.
- CSP origin allowance is conditional on a CSP being introduced before this ships; handled as the verify-first task 7 rather than an assumed edit.
