## Why

The product's north star is *readiness-score improvement per active user* (PRD §3), and the dashboard's whole information hierarchy is sorted by it — yet nothing computes a readiness number today. Weak areas give a per-domain picture, but the SPEC (Exam Readiness Score) calls for a single honest 0–100% number that is **domain-weighted by the real exam's domain shares**, **recency-weighted**, **mock-weighted**, and that refuses to show a misleading figure before there is enough signal ("not yet calibrated"). It also calls for a passive, no-pressure trajectory ("exam-ready in ~N weeks at your recent pace"). This change turns the accumulated quiz/weak-area/mock signal into that number and exposes it where downstream features (dashboard, session summary, agent, weekly digest, diagnostic) read it.

## What Changes

- New `ReadinessModule` in `apps/api` that computes a per-enrollment exam readiness score. **No new entity and no migration** — readiness is a derived, read-through value over data other changes already persist (`WeakArea`, `Certification` domain weights, `MockExam`, `QuizResponse` counts), exactly mirroring how `weak-areas` resolved its own read-through endpoint. (Entity-ownership table assigns readiness no entity; `readinessScore` lives on `UserCertification`, which `user-certifications` owns.)
- **Pure `ReadinessCalculator`** (no I/O): given per-domain weak-area scores, the certification's domain weights, the enrollment's mock results, and timing, it produces a 0–100 score that (a) weights each domain by its real-exam share, (b) reflects recent improvement quickly, and (c) folds mock-exam results in at a higher weight than session-quiz results. Exact coefficients are tunable (SPEC: "formula left flexible").
- **Calibration gate / not-yet-calibrated.** The score is withheld and reported as *not yet calibrated* until there is honest signal: a completed diagnostic, **or** at least `READINESS_CALIBRATION_MIN_ANSWERS` graded answers (default 10, configurable) accumulated across sessions, reviews, and mocks. Below that bar the API returns the calibration state, not a number.
- **`ReadinessService.compute(userCertificationId)`** as the entry point downstream features call (session/review/mock completion, summary, agent `getUserProgress`, weekly digest, diagnostic seeding). Recording quiz answers is sufficient to drive a meaningful score today without those downstream features existing.
- **Read endpoint** `GET /api/v1/user-certifications/:id/readiness` returning the score (or calibration state) plus the passive trajectory, in the standard `{ data }` envelope, repository-scoped to the owning user (cross-user access → `404`).
- **`readinessScore` on the `UserCertification` resource.** The single-resource representation gains the flat `readinessScore` attribute (a number when calibrated, otherwise the not-yet-calibrated sentinel), computed read-through so the dashboard can sort certs by it without a second request.
- **Passive readiness trajectory** ("exam-ready in ~N weeks at your recent pace") — derived from the recent rate of readiness gain over the response/mock timeline, hidden until there is enough history, purely informational: no exam date, no reminders.

## Capabilities

### New Capabilities
- `exam-readiness`: the domain-weighted + recency-weighted + mock-weighted readiness computation, the calibration gate / not-yet-calibrated state, the `ReadinessService.compute` entry point, the owner-scoped readiness read endpoint, the `readinessScore` attribute on the `UserCertification` resource, and the passive trajectory projection.

### Modified Capabilities
<!-- None. The `readinessScore` attribute and trajectory are added under the new `exam-readiness` capability (mirroring how `weak-areas` added its `UserCertification` include under its own capability), so no `enrollment`/`weak-areas` requirement changes. -->

## Impact

- **Entities owned (new table + migration):** none. Readiness introduces **no** entity and **no** migration — it is a derived read-through value. `readinessScore` is a computed attribute on `UserCertification` (owned by `user-certifications`); no column is added.
- **API:** new `GET /api/v1/user-certifications/:id/readiness`; the existing `UserCertification` single-resource representation gains the read-through `readinessScore` attribute. Orval client regenerated and committed.
- **Reads (no writes to others' tables):** `WeakArea` per-domain scores (`weak-areas`), `Certification` domain weights (`certifications`), submitted/expired `MockExam` results (`mock-exam`, soft input), graded `QuizResponse` count + `createdAt` for the calibration gate and recency/trajectory (`quiz`).
- **Config:** `READINESS_CALIBRATION_MIN_ANSWERS` (Zod-validated `@nestjs/config`, default 10) — the SPEC "readiness calibration threshold" default.
- **Depends on:** `weak-areas` (per-domain scores + `WeakAreasService.recompute` path). Archived. Soft input: `mock-exam` (higher-weighted mock signal) — already archived but **not a hard prerequisite**; the calculator degrades gracefully to quiz/diagnostic-only when no mocks exist.
- **Consumed downstream by:** `diagnostic` (low-weight initial seeding + flips calibration), `end-of-session-summary` (readiness-change line), `agent` (`getUserProgress`), `web-dashboard` (sort-by-readiness + hero), `web-progress` (trajectory), `email-lifecycle` (digest readiness %), `product-analytics` (north-star readiness-gain).
- **Crons:** none attributed to `readiness` in the cross-cutting table.
- **Metrics:** none attributed to `readiness` in SPEC → Observability → Metrics (north-star readiness-gain instrumentation is owned by `product-analytics`); none invented here.
- **Boundaries kept out of scope:** the diagnostic create flow / low-weight seeding (`diagnostic`), the end-of-session summary screen (`end-of-session-summary`), and all frontend rendering of the score and trajectory (`web-dashboard`, `web-progress`).
