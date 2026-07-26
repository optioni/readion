## Reviewed Artifacts

- `proposal.md`
- `specs/web-interaction-states/spec.md`
- `specs/web-shell/spec.md`
- `specs/web-dashboard/spec.md`
- `specs/web-cert-detail/spec.md`
- `specs/web-session-view/spec.md`
- `specs/web-progress/spec.md`
- `specs/web-agent-chat/spec.md`
- `specs/web-settings/spec.md`
- `specs/web-admin/spec.md`
- `design.md`
- `tasks.md`
- Twelve imported `design/*.html` Claude Design snapshots

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | `design.md` → Visual Design | The first import set omitted artboards for certification detail, in-session reading expansion, certification re-verification, and certification draft creation even though those views are in scope | Imported the four checked-in Claude Design snapshots, added their page/component mappings, and updated the implementation tasks to cite them | `design/cert-detail.html`, `design/session.html`, `design/admin-certifications.html`, `design/admin-cert-setup.html`; `design.md` → Visual Design; `tasks.md` §§ 4, 5, 9 |
| WARNING | Generated OpenSpec context vs `SPEC.md` / current `web-agent-chat` contract | Generated context describes a seven-day standalone-agent TTL, while the repository product contract and existing capability require a sliding four-hour TTL; changing the duration would silently broaden this UI-only change | Kept TTL duration unchanged at four hours, scoped the delta to presentation, and made the behavioral contract win over the persistent artboard chip | `design.md` → Design ↔ contract reconciliation; `specs/web-agent-chat/spec.md` → Surface the sliding 4-hour inactivity TTL |
| WARNING | `proposal.md` scope vs acceptance-test plan | A broad "UI parity" scope could have left individual audit findings represented only in prose | Mapped every finding to a named capability and explicit acceptance-test slice: interaction/focus, async lifecycle, tokens/theme, overflow, chart bounds, TTL, contrast/reduced motion, and parity-document drift | `proposal.md` → Capabilities; all `specs/**/spec.md`; `tasks.md` §§ 0–13 |

## No Remaining Implementation-Blocking Gaps

Every capability named in the proposal has a matching delta spec. Every requirement has at least one concrete four-hash scenario, and every scenario family is represented in the outer-loop RED tasks before implementation work begins. The design defines the HTTP mock boundary, real browser responsibilities, shared component boundaries, error/retry behavior, accessibility semantics, motion behavior, and visual-source reconciliation. Tasks proceed outside-in, preserve the no-backend-change scope, include independent review, and end with the required quality gates.

`openspec validate ui-interaction-state-parity --strict` passes. No implementation-blocking planning gaps remain.

## Deferred Non-Blocking Notes

- DesignSync was not exposed in this session. The twelve affected, previously imported Claude Design HTML snapshots were copied from `openspec/design/` and are the checked-in source for this change. `design.md` records that only these owned snapshots should be refreshed before acceptance-test implementation if DesignSync becomes available.
