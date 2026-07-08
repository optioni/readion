## Reviewed Artifacts

- proposal.md
- specs/web-settings/spec.md
- specs/web-agent-chat/spec.md
- specs/web-auth/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | design.md's Design↔contract reconciliation keeps the Account "Full name" field deliberately dropped (the artboard shows it, but the `User` entity has no name attribute), yet section 2 refactors the Account tab fields into horizontal FieldRows with no task guarding that decision — an implementer copying `Settings.html` could reintroduce "Full name". | Added a RED task (`2.4`) asserting the Account tab renders no "Full name" field after the FieldRow refactor; renumbered the former `2.3 GREEN`/`2.4 REFACTOR` to `2.4`/`2.5`. | tasks.md § "2. Settings — horizontal FieldRow label pattern + tokenized label" |

## No Remaining Implementation-Blocking Gaps

Confirmed. Verified across the checklist:

- **Capability coverage** — proposal.md names exactly three Modified Capabilities (`web-settings`, `web-agent-chat`, `web-auth`); each has a spec delta. Every changed requirement uses an exact existing header under `## MODIFIED Requirements`, except the genuinely new `web-auth` "Auth brand panel presents product framing" which correctly sits under `## ADDED Requirements`. No capability appears only in tasks.md or design.md.
- **Scenario coverage** — every scenario introduced by this change is concrete and has acceptance-test work: settings left-aligned column / FieldRow / indigo underline / "Update password" (tasks 0.1, 1.1–1.2, 2.1–2.4, 3.1); agent star-avatar header + empty-state avatar + vertical arrow chips (tasks 0.2, 4.1–4.2, 5.1); login full-height surface pane + no-SSO + 3 green-badge checks + bordered testimonial (tasks 0.3, 6.1–6.3, 7.1–7.2). Carried-over unchanged scenarios (existing auth/tab/password flows) retain their existing implementation and test coverage — see Deferred Non-Blocking Notes.
- **Design completeness** — design.md resolves the UI-only choices that matter here: component boundaries (Visual Design mapping table), UI states, shared-layout reuse (AuthLayout / SettingsLayout / FieldRow), and the two reconciliation decisions (SSO omitted; "Full name" dropped). No data model, migration, API contract, async/job, or rollback concerns apply (no backend surface is touched), and design.md states this explicitly.
- **Test boundaries** — design.md's required table names every collaborator (login `POST /auth/login`, agent create/detail, `GET`/`PATCH /users/me` all mocked at the browser network layer; auth store + component rendering real). No task invents a mock boundary design.md does not name.
- **Task alignment** — tasks.md is outside-in: § 0 outer-loop acceptance RED, per-surface RED/GREEN/REFACTOR (§ 1–7), outer-loop GREEN (§ 8, incl. visual reconciliation diff 8.2), subagent review (§ 9), and polish/lint/type/coverage (§ 10). No generated-client task is required — no API change, consistent with proposal.md.
- **Contradictions / stale assumptions** — none. SSO is recorded consistently as a descope/open question across proposal.md (## Why + Impact), design.md (Non-Goals + reconciliation + Open Questions), the `web-auth` delta (reaffirmed no-SSO / no divider), and tasks.md (6.3 guards it). The `web-agent-chat` requirement's "Ask AI" refers to the sidebar nav item while "Study assistant" is the in-page header title — distinct elements, not a conflict. Endpoints and domain names match across artifacts.

## Deferred Non-Blocking Notes

- **Carried-over unchanged scenarios are not re-tasked.** The MODIFIED requirements restate their full text, which includes scenarios this change does not alter (e.g. settings tab switching / unauthenticated redirect / right-aligned actions / in-session password change; agent conversation creation / auth gate / suggestion-chip send; successful login / uniform 401). These describe already-implemented behavior with existing coverage; this fidelity change adds only the new fidelity scenarios, and re-tasking the unchanged ones would be scope creep. tasks.md 5.1 does re-assert the one carried scenario at regression risk (chip activation still sends).
- **SSO remains an open product question** (design.md Open Questions). It is intentionally deferred, not a planning gap: the change keeps SSO omitted and task 6.3 guards against accidental reintroduction. If product later decides to ship SSO it becomes a separate change with its own backend scope.
