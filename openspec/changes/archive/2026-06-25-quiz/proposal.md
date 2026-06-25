## Why

The study loop needs verified quiz questions before any session, weak-area, or review feature can exist. With a cert now able to go live (`cert-go-live`) over an ingested corpus (`content-pipeline`) and a grounding orchestration in place (`grounding-verification`), the `QuizModule` is the first feature that turns that corpus into answerable, scored questions for an enrolled user. It is the foundation the rest of Phase 6 builds on.

## What Changes

- Add **`QuizModule`** to `apps/api` that generates grounded + verified quiz questions for an enrolled user's certification by retrieving content chunks (semantic search) and running them through the existing `grounding-verification` generate → verify → retry → substitute orchestration. Unverified questions are never served.
- Add a deterministic **question-format planner** helper (multiple-choice / true-false / scenario-based) that selects a format from chunk characteristics + session difficulty *before* generation, so `format` is a stable cache-key input computable up front (`{chunkIds, difficulty, format, certification}`).
- Generate grounded + verified **answer explanations** for wrong answers through the same orchestration, deriving citations from stored provenance.
- Accept user **answers**, score correctness against the verified item, and persist a **`QuizResponse`** (correctness, confidence rating 1–5, time taken) scoped to the user's `UserCertification`.
- Expose a **report-this-question** action that delegates to the `grounding-verification` quarantine path (cache eviction + admin surfacing) for any served quiz item or explanation.
- Own the **`QuizResponse` entity** (table + migration). It links to `UserCertification` and carries a self-contained question/provenance snapshot; it does **not** FK to `SessionItem` (owned later by `sessions`) — session linkage is added by the `sessions` change.

## Capabilities

### New Capabilities
- `quiz-generation`: Grounded + verified quiz-question and explanation generation — chunk retrieval, deterministic format planning, the quiz/explanation prompt contracts driven through the grounding orchestration, verified-only response caching keyed on `{chunkIds, difficulty, format, certification}`, and the report → quarantine action.
- `quiz-scoring`: Answer submission, correctness scoring against the verified item, confidence rating (1–5) and time-taken capture, and `QuizResponse` persistence scoped to `UserCertification`.

### Modified Capabilities
<!-- None. The extractive contract, verifier, orchestration loop, provenance shape, quarantine path, and grounding metrics are owned by the archived `grounding-verification` capability and are consumed here unchanged. -->

## Impact

- **New API module:** `apps/api/src/quiz` — controller (generate questions, submit answer, request explanation, report question), service, format planner, DTOs.
- **New entity + migration:** `QuizResponse` in `packages/db`. References `UserCertification`; no `SessionItem` FK yet.
- **Shared contracts:** quiz question / answer-submission / explanation DTOs and the format enum in `packages/shared`.
- **Consumes existing capabilities:** `grounding-verification` (contract, verifier, orchestration, provenance, quarantine, metrics), `content-pipeline` / `semantic-search` (chunk retrieval), `llm-foundation` (gateway, utility-tier models, response cache), `user-certifications` (enrollment + ownership scoping), `cert-go-live` (questions only generated against a `live` cert).
- **No new metrics or worker crons** — verifier pass/fail, regeneration/substitution, and quarantine-rate metrics are emitted by `grounding-verification`; quiz has no scheduled processor.
- **API client:** regenerate the Orval client after the endpoints land.
- **Downstream:** unblocks `weak-areas`, `sessions`, `review-srs`, and `mock-exam`.
