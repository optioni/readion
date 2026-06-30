## 0. Acceptance Test — Outer Loop RED

- [x] 0.0 Inspect the current `ReviewModule` controller to decide: new `POST /review-items/:id/grade` vs. extending the existing review-answer action. Record the choice.
- [x] 0.1 Add a NestJS integration test (Supertest + Testcontainers) for the self-grade endpoint as the outer loop.
- [x] 0.2 Write failing scenarios: good promotes, again resets, hard keeps, easy/top-box masters + leaves queue, not-owned/not-due rejected, invalid grade → `422`.
- [x] 0.3 Confirm failure is "endpoint/grade not handled", not a harness error.

## 1. Shared contract

- [ ] 1.1 RED: unit test for the `ReviewGrade` enum (`again|hard|good|easy`) + request DTO in `@readion/shared`.
- [ ] 1.2 GREEN: add the enum + schema/type.
- [ ] 1.3 REFACTOR: ensure no parallel grade definition.

## 2. Grade → Leitner mapping (pure logic)

- [ ] 2.1 RED: table-driven unit test over the configured box intervals for every grade × box, including top-box mastery and `lastReviewedAt` update; assert no interval is hardcoded.
- [ ] 2.2 GREEN: implement the mapping reusing the existing Leitner box-interval config + promotion/mastery helpers (no scheduler fork).
- [ ] 2.3 REFACTOR: extract a single shared transition function used by both the self-grade and quiz+confidence paths if practical.

## 3. Endpoint + guards

- [ ] 3.1 RED: integration test — ownership (`403`/`404`), not-due (`409`), invalid grade (`422`); successful grade persists `box`/`dueAt`/`lastReviewedAt`/`state` and updates the due queue.
- [ ] 3.2 GREEN: implement the controller action + DTO under auth, with swagger DTOs for Orval.
- [ ] 3.3 REFACTOR: align with the existing review-answer handler conventions.

## 4. Codegen + client

- [ ] 4.1 Run `yarn codegen` and commit the regenerated client (self-grade method).

## 5. web-progress review loop

- [ ] 5.1 RED: unit test — reveal-step Again/Hard/Good/Easy buttons call the self-grade endpoint with the right grade, advance to the next due item, and count the item in the completion breakdown.
- [ ] 5.2 GREEN: wire the buttons to the endpoint (decide self-grade vs. quiz+confidence mode per design open question).
- [ ] 5.3 REFACTOR: clean up loop state.

## 6. e2e + close the outer loop

- [ ] 6.1 Add/extend the review-loop Playwright e2e: reveal → grade → advance → completion (endpoint mocked).
- [ ] 6.2 Make the Section 0 acceptance test green.

## 7. Verification gates

- [ ] 7.1 `yarn lint`, `yarn typecheck`, `yarn test` (≥80% coverage), `yarn build` green; generated client committed.
