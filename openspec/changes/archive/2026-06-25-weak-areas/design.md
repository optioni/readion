## Context

`quiz` persists `QuizResponse` rows (answer, correctness, confidence 1–5, time taken, and a provenance snapshot including `sourceChunkIds`) scoped to a `UserCertification`. SPEC → Weak Area Tracking requires that, after each session/review/mock, per-domain `WeakArea` records be (re)computed from quiz **accuracy combined with confidence**, surfaced as a ranked list to the planner and dashboard.

This change owns the `WeakArea` entity and the aggregation logic. The downstream features that fire the "after a session/review/mock" trigger (`sessions`, `review-srs`, `mock-exam`) do not exist yet, so the module must expose a recompute service those changes can call, while being independently exercisable today by answering quizzes. Domain attribution uses the source chunk's `primaryDomain` (SPEC → Domain tagging: "recorded as `primaryDomain` for … weak-area attribution").

This is a non-UI change — no Claude Design views are involved, so the Visual Design section is intentionally omitted.

## Goals / Non-Goals

**Goals:**
- Own and migrate the `WeakArea` entity: per `UserCertification`, per `domain`, an aggregated score plus the sample inputs (accuracy, mean confidence, response count) used to compute it.
- Provide `WeakAreasService.recompute(userCertificationId)`: idempotent recomputation that derives one `WeakArea` row per domain that has responses, attributing each `QuizResponse` to a domain via its source chunk's `primaryDomain`.
- Provide a pure, unit-tested scoring function combining accuracy and confidence into a 0–100 score.
- Expose `GET /api/v1/user-certifications/:id/weak-areas` returning the ranked (weakest-first) list, ownership-scoped, and `?include=weakAreas` on the `UserCertification` resource.
- Neutral cold start: no responses → empty list, no rows.

**Non-Goals:**
- Diagnostic seeding of the initial `WeakArea` map (owned by `diagnostic`).
- Recency/decay weighting and readiness calibration (owned by `readiness`).
- Firing recompute from session/review/mock lifecycles (those changes call `recompute` when they land).
- Any worker cron or Prometheus metric (none attributed to `weak-areas`).

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (`WeakArea`, `QuizResponse`, `UserCertification`, `ContentChunk`) | real (Testcontainers DB) | n/a — scoring unit is pure, no DB |
| Redis | not used by this change | not used |
| LLM / Vercel AI SDK | not called (no generation here) | not called |
| Quiz answering (to produce `QuizResponse`s) | real `quiz` module wired into the Nest test app | n/a |
| Scoring function (accuracy + confidence → score) | exercised indirectly via real DB | pure unit, no mocks |

The Playwright e2e drives the real HTTP surface; the NestJS integration test boots the module against a real test DB and seeds `QuizResponse`s; the unit test covers only the pure scoring/ranking logic.

## Decisions

- **`WeakArea` stores derived inputs, not just the score.** Columns: `accuracy`, `meanConfidence`, `responseCount` alongside `score`. Rationale: makes recompute auditable, lets downstream `readiness` re-weight without re-reading every `QuizResponse`, and keeps the score reproducible. Alternative — store only `score` — was rejected as lossy.
- **Domain attribution via source chunk `primaryDomain`.** A `QuizResponse` does not store a domain; its provenance snapshot carries `sourceChunkIds`. Recompute resolves those chunks' `primaryDomain` and attributes the response there. Alternative — denormalize a `domain` onto `QuizResponse` — was rejected because it would require modifying the `quiz`-owned entity; SPEC explicitly names `primaryDomain` as the attribution key.
- **Score = blended accuracy and confidence-calibration, 0–100, higher = stronger.** A weak area is the inverse (lowest score ranked first). Confidence sharpens the signal: confident-wrong answers depress the score more than unsure-wrong; unsure-correct counts less than confident-correct. The exact blend lives in the pure unit and is specified by scenarios, not hardcoded magic in the controller.
- **Recompute is full-rebuild per enrollment, not incremental.** `recompute(userCertificationId)` reads all current `QuizResponse`s for the enrollment, groups by domain, upserts one row per domain, and deletes rows for domains with no responses. Rationale: simple, idempotent, correct under out-of-order triggers; response volumes per enrollment are small. Alternative — incremental delta updates — adds concurrency hazards for no current benefit.
- **Service-level trigger surface, not an event bus.** Downstream changes call `WeakAreasService.recompute` directly via the module. Rationale: no eventing infra exists yet and the dependency direction (sessions→weak-areas) is already explicit in the roadmap.
- **Read-through recompute until lifecycle triggers exist.** The `sessions`/`review-srs`/`mock-exam` features that fire "after each session/mock" do not exist yet, so the `GET .../weak-areas` endpoint performs a recompute before returning, guaranteeing the ranked list reflects the latest recorded `QuizResponse`s today. Because `recompute` is idempotent and full-rebuild, this is safe and stays correct once downstream features also call it on their lifecycle events (those calls keep the persisted rows fresh for other consumers — `readiness`, dashboard — that read rows directly). Alternative — wire a hook into the archived `quiz` answer flow — was rejected as it would modify an entity/module owned by another change.
- **Ranked read endpoint, ownership-scoped at the repository layer.** Reuses the established enrollment-ownership scoping (`auth`) so a user can never read another user's weak areas. Returns weakest-first; ties broken by larger `responseCount` then domain name for stable ordering.

## Risks / Trade-offs

- **Multi-domain chunks** → a chunk has multiple `{domain, confidence}` tags but a single `primaryDomain`; attribution uses `primaryDomain` only, matching SPEC. Acceptable; cross-domain credit is out of scope.
- **A `QuizResponse` whose source chunk was later superseded/removed** → resolve `primaryDomain` from the snapshot/chunk if present; if the chunk is gone, skip that response from attribution rather than failing recompute. Mitigation: recompute tolerates unresolvable chunks.
- **Full-rebuild cost grows with response count** → bounded per enrollment and triggered on discrete events, not per-request; acceptable at expected volumes. Revisit if profiling shows hotspots.
- **Score formula churn** → encoding the blend in scenario-driven unit tests means tuning the formula later is a spec change, not a silent edit.

## Open Questions

- None blocking. The precise accuracy/confidence blend coefficients are fixed by the scoring scenarios in the spec; downstream `readiness` may re-weight using the stored inputs without changing this entity.
