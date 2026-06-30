## Why

The Phase-11 `quarantine-review-queue` shipped a functional admin review queue (list + Approve/Reject, audit-logged), but the UI is a stacked list of cards that exposes the **raw JSON verdict** (e.g. `{"pass":false,"score":0.2}`) and renders no question/options (observed 2026-06-30). The design (`openspec/design/AdminContentUsers.html`) is a **two-pane master-detail reviewer**: a list of quarantined items on the left and a detail panel on the right showing the full question, answer key, options, and a human-formatted verdict, with the resolve actions in context. This change brings the implemented review queue up to the design without changing the backend contract.

## What Changes

- Convert the review queue to a **two-pane master-detail** layout: item list (left) + detail panel (right) for the selected item.
- Render the item's **question, options, and answer key** plus a **formatted verdict** (pass/fail + score + reason) instead of raw JSON.
- Keep the existing **Approve / Reject** actions (audit-logged) wired to the Phase-11 endpoints; reflect resolution state and remove resolved items from the pending list.
- Preserve the deliberate Approve/Reject vocabulary (not the artboard's "Edit key/Discard").

## Capabilities

### Modified Capabilities
- `web-admin`: the quarantine review queue is a master-detail reviewer rendering question/options + a formatted verdict, with the existing approve/reject actions.

## Impact

- **Code**: `apps/web/app/components/admin/` review-queue components (list + detail pane + verdict formatter); vitest tests; Playwright e2e (`apps/web/e2e/admin.e2e.ts`). Consumes the existing `GET /admin/quarantine` + approve/reject endpoints — **no API change** unless the list response lacks question/options/verdict fields, in which case STOP and flag (that would be a separate backend delta to `content-quarantine-review`).
- **No new entity/migration.**
- **Dependencies**: archived `quarantine-review-queue`, `web-admin`. Renders inside `web-app-shell-sidebar`.
