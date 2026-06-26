## Context

SPEC → Exam Readiness Score defines a single 0–100% number "representing how prepared the user is", computed from per-domain weak-area scores weighted by the real exam's domain shares, with mock exams weighted higher than session quizzes, recency-weighted, and seeded (low weight, fast decay) by an optional diagnostic. Before there is honest signal it must read "not yet calibrated" rather than a misleading number; it flips to a real percentage at a completed diagnostic **or** N graded answers (default 10). A separate passive trajectory ("exam-ready in ~N weeks at your recent pace") lives on the progress page — informational only, no exam date, no reminders. The SPEC explicitly leaves the exact formula flexible for tuning during implementation.

The roadmap row (`readiness`) depends only on `weak-areas`; `mock-exam` is a soft input ("folds in once mock-exam lands — not a hard prerequisite"). The entity-ownership table assigns readiness **no** entity, and `readinessScore` is documented as living on `UserCertification` (owned by `user-certifications`, which deliberately left the field to this change).

## Goals / Non-Goals

**Goals**
- A pure, tunable readiness calculator: domain-weighted, recency-weighted, mock-weighted, with a calibration gate.
- A `ReadinessService.compute(userCertificationId)` entry point downstream features call.
- An owner-scoped read endpoint and the `readinessScore` attribute on the `UserCertification` resource.
- A passive trajectory projection, hidden until enough history.

**Non-Goals**
- No new entity, table, or migration (readiness is derived; mirrors `weak-areas` read-through).
- No diagnostic create flow / seeding mechanics (owned by `diagnostic`; this change only honors the calibration-by-diagnostic gate and a low-weight, fast-decay mock/diagnostic input so seeding works once `diagnostic` lands).
- No frontend, no end-of-session summary screen, no cron, no Prometheus metric.

## Test Boundaries

Backend-only change (like `quiz`, `weak-areas`, `sessions`, `mock-exam`) — the outer acceptance test is a full-app **API-level** `*.acceptance.spec.ts` (Supertest through the booted Nest app on Testcontainers), **not** Playwright e2e; the dashboard/progress UI that renders the score belongs to `web-dashboard`/`web-progress`. The pure `ReadinessCalculator` is unit-tested for its properties (monotonicity, domain-weighting, calibration, mock-weighting). Integration tests hit real Postgres/Redis; the LLM is not involved in readiness (no generation), so no provider mock is needed beyond what the answer-recording harness already requires.

## Decisions

- **No entity, no migration — readiness is a read-through derivation.** The score is recomputed on demand from `WeakArea` scores, `Certification` domain weights, `MockExam` results, and the graded-`QuizResponse` count. This matches the entity-ownership table (readiness owns nothing) and how `weak-areas` resolved its endpoint. *Alternative: a cached `readinessScore` column on `UserCertification` (or a `ReadinessSnapshot` history entity) — rejected: it extends/adds an entity the roadmap doesn't assign to readiness, and data volumes per enrollment are small enough that read-through is cheap. The "delta since last session" and trajectory are computed point-in-time from the response/mock timeline rather than from stored snapshots.*
- **Base = domain-weighted blend of `WeakArea` scores; mocks blended in at higher weight.** Readiness reads the enrollment's per-domain `WeakArea.score` (already 0–100, higher = stronger) and combines them by the `Certification` domain weights. Submitted/expired `MockExam` results (overall + domain breakdown) are blended in as a separate, higher-weighted, recency-decayed signal. *Alternative: add an origin discriminator column to `QuizResponse` so mock-emitted responses can be up-weighted in-place — rejected: it extends `quiz`'s entity (owned elsewhere) for a weighting concern readiness can satisfy by reading `MockExam` directly. The minor overlap (a mock's finalize-emitted `QuizResponse`s also feed `WeakArea`) is acceptable because the formula is explicitly tunable and the SPEC asks only that mocks weigh "higher".*
- **Mock is a soft input.** The calculator produces a valid score with zero `MockExam` rows (quiz/diagnostic-only), so the change does not hard-depend on `mock-exam`; when mocks exist they raise/lower the number with extra weight.
- **Calibration gate before any number.** `compute` first checks: a submitted diagnostic `MockExam` for the enrollment **OR** graded-answer count ≥ `READINESS_CALIBRATION_MIN_ANSWERS` (config, default 10). Until then it returns `{ calibrated: false, score: null }`; the `UserCertification.readinessScore` attribute is the not-yet-calibrated sentinel (`null`). The graded-answer count is the sum of `WeakArea.responseCount` (already aggregated by `weak-areas`), avoiding a parallel count path.
- **Recency.** `compute` recomputes from current `WeakArea` + recent mocks on every call, and applies a recency decay over the response/mock timeline (`createdAt` from `BaseEntity`) so recent improvement moves the number quickly, per SPEC. Coefficients are config-free constants in the calculator, tunable in code.
- **`readinessScore` on the resource via read-through serialization.** `ReadinessModule` extends the `UserCertification` single-resource representation to populate `readinessScore` by calling `ReadinessService.compute`, so the dashboard can sort by it without a second request. The dedicated endpoint additionally returns the trajectory.
- **Trajectory is point-in-time and gated on history.** Computed from the recent rate of readiness gain (readiness evaluated over time windows of the response/mock timeline). Hidden (`null`) until there is enough history to estimate a trend; never returns a date or triggers a reminder. Output shape: `{ weeksToReady: number } | null`.

## Risks / Trade-offs

- **Read-through cost / point-in-time recompute.** Computing trajectory requires evaluating readiness at past windows. Mitigated by small per-enrollment data volumes and by reusing the in-memory `WeakArea` rows already loaded; can be memoized per request. If this ever proves hot, a cached snapshot column is the documented escape hatch.
- **Mock double-counting.** A mock's results influence both `WeakArea` (via finalize-emitted `QuizResponse`s) and the explicit mock-weighting term. Accepted: the SPEC asks only for "higher weight", and the formula is tunable.
- **Formula credibility (PRD risk).** The number must move meaningfully with effort and track mock outcomes. Mitigated by keeping the calculator pure and property-tested, with coefficients tunable in code.

## Open Questions

- Exact readiness coefficients (domain blend vs. mock weight, recency half-life) and the trajectory formula are intentionally deferred to implementation/tuning (SPEC: "formula left flexible"); the specs assert behavioral properties, not constants.
