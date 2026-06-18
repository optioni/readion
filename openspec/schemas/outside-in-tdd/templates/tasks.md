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
- [ ] N.2 REFACTOR: Clean up test setup and mocks if needed

## N+1. Polish

- [ ] N+1.1 Run linter and fix all errors (`npm run lint`)
- [ ] N+1.2 Run formatter and apply fixes (`npm run format`)
- [ ] N+1.3 Run type checker with zero errors (`npm run typecheck`)
- [ ] N+1.4 Run coverage report and confirm ≥80% lines/branches/functions (`npm run test:coverage`)
