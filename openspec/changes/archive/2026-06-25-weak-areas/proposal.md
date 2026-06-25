## Why

A user's quiz answers now produce scored `QuizResponse` rows (`quiz`), but nothing turns that stream of answers into a per-domain view of where the learner is weak. The study planner, dashboard, readiness score, review queue, and agent all need a ranked, per-domain weak-area signal to personalize what the user studies next — `weak-areas` is the aggregation layer that makes the rest of Phase 6 adaptive instead of generic.

## What Changes

- Introduce `WeakAreasModule` in `apps/api` that aggregates a user's quiz performance per certification domain into `WeakArea` records (one per user-certification per domain).
- Own and create the `WeakArea` entity (table + migration): aggregated score scoped to `UserCertification`, keyed by `domain`, derived from quiz **accuracy combined with confidence ratings**.
- Compute each domain's score as pure, unit-testable logic over the enrollment's `QuizResponse`s, attributing each response to a domain via its source chunk's `primaryDomain`.
- Expose a recomputation service (`WeakAreasService.recompute(userCertificationId)`) that updates the per-domain `WeakArea` map from current `QuizResponse`s. This is the trigger surface downstream changes (`sessions`, `review-srs`, `mock-exam`) will call after recording responses; for now it is driven by quiz answering.
- Expose `GET /api/v1/user-certifications/:id/weak-areas` returning the **ranked** weak-area list (weakest first), ownership-scoped to the enrolling user, and make `weakAreas` includable on the `UserCertification` resource via `?include=weakAreas`.
- Neutral cold start: an enrollment with no quiz data yields an empty weak-area list (no domain bias) rather than fabricated scores. Diagnostic seeding and recency decay are explicitly **out of scope** (owned by downstream `diagnostic`/`readiness`).

## Capabilities

### New Capabilities
- `weak-areas`: Per-user, per-certification, per-domain aggregation of quiz accuracy and confidence into ranked `WeakArea` records, a recompute trigger surface for downstream features, and a read endpoint consumed by the planner and dashboard.

### Modified Capabilities
<!-- None. No existing spec's requirements change; weak-areas only reads QuizResponse/UserCertification owned elsewhere. -->

## Impact

- **New module:** `apps/api/src/weak-areas/` (`WeakAreasModule`, controller, service, scoring unit).
- **Entity owned:** `WeakArea` (`packages/db`) + its creation migration. Reads `QuizResponse`, `UserCertification`, and `ContentChunk.primaryDomain`; owns none of those.
- **API surface:** new `GET /api/v1/user-certifications/:id/weak-areas` collection endpoint and `?include=weakAreas` expansion on `UserCertification`; Orval client regenerated.
- **Dependencies:** `quiz` (provides `QuizResponse` + provenance snapshot) and `user-certifications` (enrollment scope) — both archived.
- **Cross-cutting:** none — no worker cron and no Prometheus metric is attributed to `weak-areas` in the roadmap.
- **Downstream consumers (not built here):** `sessions`, `review-srs`, `mock-exam` call `recompute`; `readiness`, `diagnostic`, dashboard, and agent read the ranked list.
