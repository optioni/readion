## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Extend the agent-chat Playwright e2e: a fresh standalone chat shows no expiry banner (and ~full TTL); a near-expiry conversation shows the banner with correct remaining time.
- [ ] 0.2 Confirm it fails against the current "Expires in 0m" pill.

## 1. TTL computation

- [ ] 1.1 RED: unit test for a TTL helper/composable — given `lastActivityAt` + 4h window, returns remaining ms and a near-expiry flag; resets on activity.
- [ ] 1.2 GREEN: implement it from the conversation's activity timestamp.
- [ ] 1.3 REFACTOR: single source for the 4h window + near-expiry threshold.

## 2. Banner display

- [ ] 2.1 RED: component test — banner hidden when not near expiry; visible with correct copy when near expiry.
- [ ] 2.2 GREEN: replace the persistent pill with the conditional banner per `AgentChat.html`.
- [ ] 2.3 REFACTOR: remove the dead pill code.

## 3. Verification gates

- [ ] 3.1 `yarn lint`, `yarn typecheck`, web unit tests, and the e2e all green; coverage ≥ 80%. (If the API lacks `lastActivityAt`/expiry on the conversation read model, STOP and flag — do not add backend scope here.)
