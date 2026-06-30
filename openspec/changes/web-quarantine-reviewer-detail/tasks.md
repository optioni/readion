## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Extend `apps/web/e2e/admin.e2e.ts`: selecting a queue item shows a detail pane with question/options + a formatted verdict (no raw JSON); Approve/Reject resolves it and removes it from the list.
- [ ] 0.2 Confirm it fails against the current stacked-card / raw-JSON UI.

## 1. Verdict formatter

- [ ] 1.1 RED: unit test — formats `{pass, score, reason}` into a human verdict (pass/fail label + score % + reason).
- [ ] 1.2 GREEN: implement the formatter.
- [ ] 1.3 REFACTOR: single source for verdict labels/colours.

## 2. Master-detail layout

- [ ] 2.1 RED: component test — list selects an item; detail pane renders question/options/answer key + formatted verdict; empty/selection states.
- [ ] 2.2 GREEN: build the two-pane reviewer per `AdminContentUsers.html`. If the API response lacks question/options/verdict, STOP and flag.
- [ ] 2.3 REFACTOR: extract list + detail components.

## 3. Resolve actions

- [ ] 3.1 RED: test Approve/Reject call the existing endpoints, reflect resolution, and drop the item from pending.
- [ ] 3.2 GREEN: wire the actions in the detail pane (keep Approve/Reject vocab + audit).
- [ ] 3.3 REFACTOR: shared resolve handler + optimistic/refetch behavior.

## 4. Verification gates

- [ ] 4.1 `yarn lint`, `yarn typecheck`, web unit tests + e2e green; coverage ≥ 80%.
