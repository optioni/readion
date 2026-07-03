## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Extend `apps/web/e2e/admin.e2e.ts`: selecting a queue item shows a detail pane with question/options + a formatted verdict (no raw JSON); Approve/Reject resolves it and removes it from the list.
- [x] 0.2 Confirm it fails against the current stacked-card / raw-JSON UI.

## 1. Verdict formatter

- [x] 1.1 RED: unit test — formats `{pass, score, reason}` into a human verdict (pass/fail label + score % + reason).
- [x] 1.2 GREEN: implement the formatter.
- [x] 1.3 REFACTOR: single source for verdict labels/colours.

## 2. Master-detail layout

- [x] 2.1 RED: component test — selecting a list item loads its detail via `GET /api/v1/admin/quarantine/:id` and the detail pane renders question/options/answer key + formatted verdict; empty/selection/loading states.
- [x] 2.2 GREEN: build the two-pane reviewer per `AdminContentUsers.html`, fetching the detail from the new endpoint (provided by `admin-quarantine-item-detail`).
- [x] 2.3 REFACTOR: extract list + detail components.

## 3. Resolve actions

- [x] 3.1 RED: test Approve/Reject call the existing endpoints, reflect resolution, and drop the item from pending.
- [x] 3.2 GREEN: wire the actions in the detail pane (keep Approve/Reject vocab + audit).
- [x] 3.3 REFACTOR: shared resolve handler + optimistic/refetch behavior.

## 4. Verification gates

- [x] 4.1 `yarn lint`, `yarn typecheck`, web unit tests + e2e green; coverage ≥ 80%.
