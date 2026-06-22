## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Set up test harness and mocks for all external dependencies (see design.md Test Boundaries)
- [ ] 0.2 Write failing acceptance test: <!-- scenario name from spec -->
- [ ] 0.3 Confirm it fails for the right reason (not a setup error)

## 1. <!-- Outermost Component -->

- [ ] 1.1 RED: Write unit test for <!-- interface or behaviour -->
- [ ] 1.2 GREEN: Implement <!-- component --> to pass unit test
- [ ] 1.3 REFACTOR: Clean up <!-- component -->

## 2. <!-- Next Component Inward -->

- [ ] 2.1 RED: Write unit test for <!-- interface or behaviour -->
- [ ] 2.2 GREEN: Implement <!-- component --> to pass unit test
- [ ] 2.3 REFACTOR: Clean up if needed

## N. Acceptance Test — Outer Loop GREEN

- [ ] N.1 Confirm acceptance test passes end-to-end
- [ ] N.2 Verify all affected apps start in the local environment (smoke test) — boot each app and confirm no startup/config errors
- [ ] N.3 REFACTOR: Clean up test setup and mocks if needed

## N+1. Change Review — Subagent Verification

- [ ] N+1.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [ ] N+1.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## N+2. Polish

- [ ] N+2.1 Run linter and fix all errors (`npm run lint`)
- [ ] N+2.2 Run formatter and apply fixes (`npm run format`)
- [ ] N+2.3 Run type checker with zero errors (`npm run typecheck`)
- [ ] N+2.4 Run coverage report and confirm ≥80% lines/branches/functions (`npm run test:coverage`)

<!-- Optional group. Include ONLY if this change has durable info to add/correct in a maintained doc (README/AGENTS/SPEC/PRD). Name the doc, section, audience, what to update, and why it stays useful. Omit the whole group otherwise — do not add a generic doc-review task. -->
<!--
## N+3. Documentation

- [ ] N+3.1 Update <doc>: <section> (audience: <who>) — <what to update and why it stays useful>
-->
