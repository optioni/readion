## Reviewed Artifacts

- proposal.md
- specs/web-onboarding/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | specs/web-onboarding/spec.md + tasks.md | The default-prefs scenario said the `PATCH /users/me` body contained "the changed fields" while design.md/Decisions said "the chosen values"; the enroll body said "the same chosen values". Ambiguous and inconsistent — a test could not tell whether to assert a partial or a full body. | Harmonized to the full chosen `sessionDefaults` set (all five fields) for both the `PATCH /users/me` write and the enroll `sessionDefaults`, matching the form (which holds all five values) and design.md's "chosen values". | spec.md → "Default session preferences step" scenario "User adjusts defaults and continues"; tasks.md → 5.3 |
| SUGGESTION | design.md | Endpoint names were at risk of being under-specified for the implementer. | Confirmed every consumed endpoint is already pinned to a concrete Orval client method in design.md → Context and asserted in tasks.md 1.1 (`certificationsControllerList`, `usersControllerGetMe`, `usersControllerUpdateMe`, `userCertificationsControllerEnroll`, `userCertificationsControllerList`, `diagnosticControllerGetOffer`, `diagnosticControllerCreate`, `diagnosticControllerDismissOffer`). No change required. | design.md → Context; tasks.md → 1.1 (verified, no edit) |

## No Remaining Implementation-Blocking Gaps

All planning artifacts are consistent and implementation-ready. Verified during review (no edit required):

- **Capability coverage** — proposal names one new capability `web-onboarding` (the exact roadmap Capabilities name) and zero modified capabilities; the single delta spec `specs/web-onboarding/spec.md` matches; no capability appears only in design/tasks.
- **Scenario coverage** — every spec scenario maps to acceptance-test work in tasks.md: entry gate + no-certs routing → 0.2/0.3, 2, 3; cert select → 4; default prefs → 5; enrollment → 6; diagnostic offer → 6, 7; re-prompt nudge → 7. Each scenario names concrete endpoints, inputs, and observable navigation/HTTP side effects.
- **Backend contract** — every consumed endpoint exists in the implemented NestJS controllers and committed Orval client; `GET /certifications` already filters to live certs (so the picker needs no client-side `state` filter and an empty response is the canonical no-certs signal); `role` and `sessionDefaults` both come from `GET /users/me` (the web `useAuthStore` `AuthUser` type omits `role` — pinned to the endpoint in design.md reconciliation, decisions, and tasks 2.3).
- **Entry-gate precedence** — the `useOnboardingGate` resolver (tasks 2.1) and design.md Decisions order the branches unambiguously: ≥1 active enrollment → dashboard; else 0 certs → role branch (admin → cert-setup, non-admin → empty state); else → onboarding. The two spec requirements compose without conflict.
- **In-flow diagnostic offer values** — at the onboarding step `deriveOffer` can only yield `onboarding` (fresh live enrollment, 0 completed sessions) or `none`; `re-prompt` only arises later and is handled by the dashboard nudge. The spec covers both in-flow values; no `re-prompt`-in-flow path is needed.
- **Test boundaries** — design.md names every real/mocked collaborator (real API + Postgres/Redis in e2e; HTTP-mocked client in unit tests; placeholder downstream routes asserted as navigation). No task invents an unnamed mock boundary.
- **No backend surface** — no new entity, migration, cron, emitted metric, or `yarn codegen`; entity-ownership and cross-cutting-deliverables tables in IMPLEMENTATION-ORDER.md attribute none of these to `web-onboarding`. Consistent across all four artifacts.

## Deferred Non-Blocking Notes

- **Canonical design artboard not pulled.** The `DesignSync` connector is absent from this environment, so `Onboarding.html` (project `4526b72d-50eb-4140-8cf3-39f776743a65`) could not be imported and no placeholder/reconstructed `design/Onboarding.html` was fabricated. The Visual Design section is spec + DESIGN.md-token + archived-component derived and explicitly flags a re-pull + re-diff when DesignSync is available (design.md → Visual Design; tasks 8.3). Behavioral spec is authoritative meanwhile.
- **Downstream placeholder routes.** The diagnostic/mock-exam runner route (`web-mock-exam`) and the admin cert-setup route (`web-admin`) are not yet built; the flow navigates to placeholder route constants asserted by tests, to be reconciled when those changes land (design.md → Open Questions; tasks 6.3, 9.3).
- **Optionally widening the store `AuthUser` type to include `role`** is deferred; this change reads `role` from `GET /users/me` and does not require the store change (design.md → Open Questions).
