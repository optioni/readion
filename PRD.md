# Readion — Product Requirements Document

> **Scope of this document.** This PRD covers the *why*, *who*, and *what-success-looks-like*. It deliberately does **not** restate implementation: the technical design, data model, API, and infrastructure live in [`SPEC.md`](./SPEC.md), and the visual design system lives in [`DESIGN.md`](./DESIGN.md). Where a requirement maps to a built feature, it links to the relevant `SPEC.md` section.

---

## 1. Problem

Certification exams (AWS, Azure, Kubernetes, AI/ML) are a primary way for working engineers to prove and grow their skills, but preparing for them is inefficient:

- **Material is scattered.** Official docs, whitepapers, YouTube, Reddit threads, and community guides each hold a piece of the truth. Learners stitch these together manually.
- **Study is generic, not adaptive.** Static courses and question banks don't know what *you* already understand. Time is wasted re-covering strong areas while weak areas stay weak.
- **Feedback is delayed and coarse.** Learners often don't know whether they're actually ready until they sit (and sometimes fail) the real exam.
- **Time is scarce.** The core audience studies in short, irregular blocks around a full-time job and can't afford wasted sessions.

Existing tools (A Cloud Guru, Udemy, official practice exams) provide content or test banks, but none combine *up-to-date multi-source material* + *per-user adaptation* + *an on-demand tutor* + *an honest readiness signal* in one focused loop.

## 2. Target Users

**Primary persona — "The Working Professional"**
An employed engineer, SRE, or ops/cloud practitioner pursuing a certification for career growth, a role requirement, or an internal mandate. Characteristics that drive the product:

- **Time-constrained.** Studies in 15–90 minute blocks on evenings/weekends; can't commit to long courses. → *Session duration is a first-class config; sessions must be productive end-to-end with no mid-session waits.*
- **Has real-world context but gaps.** Knows the job, not necessarily the exam's framing or breadth. → *Adaptation must target genuine weak areas, not re-teach the basics.*
- **Outcome-driven and impatient with fluff.** Wants to know "am I ready?" and "what do I fix next?" → *Readiness score and weak-area surfacing are central, not decorative.*
- **Self-directed.** Studying alone, no instructor. → *The AI tutor is the substitute for "asking the instructor."*

**Secondary (served, not optimized for):** career switchers and students. The product should not actively exclude them, but v1 design tradeoffs favor the time-constrained professional.

## 3. Goals & Success Metrics

### Product goals
1. Help users become — and *know* they are — ready for their target exam, faster than self-directed study.
2. Make every study minute count through adaptation to demonstrated weak areas and confidence.
3. Provide an always-available tutor that removes the "stuck and alone" failure mode.

### Success metrics

**North-star metric:** **Readiness-score improvement per active user over time** — the measured lift in a user's exam readiness score (see [`SPEC.md` → Exam Readiness Score](./SPEC.md#exam-readiness-score)) across their study history. This is chosen because it is directly tied to the core promise, is observable without waiting on real-world exam dates, and moves with genuine effort.

| Tier | Metric | Why it matters |
|---|---|---|
| **North star** | Median readiness-score gain per active user (e.g. per 2-week window) | Core value delivered |
| Supporting | Sessions completed per active user per week | Engagement / habit; readiness can't improve without sessions |
| Supporting | Week-2 and week-4 retention | Sustained value, not one-time curiosity |
| Supporting | Session completion rate (started → end-of-session summary) | Sessions are well-sized and worth finishing |
| Supporting | Agent engagement rate (sessions with ≥1 agent interaction) | The tutor differentiator is actually used |
| Outcome (lagging) | Self-reported real-exam pass rate | Truest signal; slow, self-reported, tracked but not optimized in v1 |

**Guardrail metrics:** LLM cost per active user, agent/SSE error rate, content-ingestion success rate. Improvement must not come at the expense of runaway cost or a degraded knowledge base.

### Definitions & targets (v1)

**Active user** = a user who has completed ≥ 2 study sessions in the trailing 14 days.

These are the initial v1 targets. They are deliberately set as starting bars to be tuned once real data exists — the point is to have a falsifiable definition of "working," not to be precise on day one.

| Metric | v1 target |
|---|---|
| North star — median readiness gain over first 4 weeks of active use | **≥ +15 points** |
| Users completing ≥ 10 sessions who reach "exam-ready" (readiness ≥ 80%) | **≥ 60%** |
| Sessions/week among active users (median) | **≥ 2** |
| Week-4 retention | **≥ 40%** |
| Session completion rate (started → summary) | **≥ 75%** |
| Agent engagement (sessions with ≥ 1 agent interaction) | **≥ 50%** |
| Guardrail — LLM cost per active user / month | within budget (set during implementation) |

### Capturing the lagging outcome (real-exam pass rate)

Pass rate is **self-reported via a post-exam survey nudge**, not inferred. Mechanism:

- When a user crosses the "exam-ready" readiness threshold (≥ 80%) and then has a lull in study activity (a reasonable signal they may have sat the exam), prompt them — in-app and by email — with a one-tap survey: *"Did you take the exam yet? Passed / Didn't pass / Not yet."*
- The nudge is optional, dismissible, and re-asked at most once more after a delay; it never blocks the app.
- Responses feed the lagging pass-rate metric only; they do not affect the readiness score.

## 4. Scope

**v1 is the full feature set described in [`SPEC.md`](./SPEC.md)** — there is no phased deferral. The major capabilities below are all in-scope for the first release.

### In scope (v1)
| Capability | Spec reference |
|---|---|
| Email/password auth, roles, password reset | [Auth](./SPEC.md#authentication--authorisation), [Password Reset](./SPEC.md#password-reset-flow) |
| Multi-source content ingestion pipeline (docs, PDF, YouTube, Reddit, GitHub, Anki/Quizlet, podcasts) | [Content Pipeline](./SPEC.md#content-pipeline--appsworker) |
| Personalized, pre-generated study sessions (reading + quiz + video mix) | [Session Item Generation](./SPEC.md#session-item-generation) |
| Adaptive content selection driven by weak areas & confidence | [Content Architecture](./SPEC.md#content-architecture), [Weak Area Tracking](./SPEC.md#weak-area-tracking) |
| Streaming in-session AI tutor with tools + standalone general tutor | [AgentModule](./SPEC.md#api--appsapi), [Agent Context](./SPEC.md#agent-context) |
| Timed mock exams matching real exam format, with review mode | [MockExamModule](./SPEC.md#api--appsapi) |
| Exam readiness score + weak-area dashboard + progress trends | [Exam Readiness Score](./SPEC.md#exam-readiness-score), [Frontend pages](./SPEC.md#frontend--appsweb) |
| End-of-session summaries with next-session suggestions | [End-of-Session Summary](./SPEC.md#end-of-session-summary) |
| Multi-user with independent progress | [Resource ownership](./SPEC.md#authentication--authorisation) |
| Admin: data-driven certification setup (LLM-assisted), content-source management | [Admin](./SPEC.md#frontend--appsweb), [ContentModule](./SPEC.md#api--appsapi) |

### Certification go-live criteria

A certification stays in a **draft** state (visible to admins, not enrollable by users) until its knowledge base meets a minimum coverage bar, so users never enroll into empty or lopsided content. A cert becomes **live** (enrollable) only when:

- **Every domain** in the cert's domain list has **≥ 20 ingested content chunks** above the quality/similarity threshold — no domain may be empty, since any domain can be a session focus area.
- **Total chunks ≥ 3× the real exam's question count**, so a full mock exam can be generated without recycling the same chunks.
- **At least one enabled, successfully-ingested content source** exists per domain (no domain resting on a single failed fetch).

The admin UI surfaces per-domain coverage so an admin can see exactly what's missing before a cert goes live. These thresholds are configurable and tunable; the intent is "enough material to generate any session and a full mock without obvious gaps."

### Out of scope (v1)
Per [`SPEC.md` → Non-Goals](./SPEC.md#non-goals-v1): native mobile apps, social/community features, paid-content integrations, exam booking, offline mode, and non-English localization.

**Monetization is also explicitly out of scope.** The product is **always free** in v1 — no billing, paywall, plan tiers, or usage metering, and therefore no payment/entitlement data is captured. (A plausible future direction is an internal company tool, which would later imply org accounts / SSO — out of scope for v1, but a reason not to hard-code single-tenant assumptions that would block it.)

> **Note (product risk on full-scope v1):** shipping the entire spec as v1 maximizes the value proposition but enlarges the first release and lengthens time-to-first-user-feedback. If timelines slip, the smallest loop that still delivers the north star is: **one certification → core study session → in-session agent → readiness dashboard**. Mock exams, multi-source ingestion breadth, and LLM-assisted admin setup are the natural trim points. This is recorded as a fallback, not the current plan.

## 5. User Journeys

**J1 — First run (new professional user)**
Register → (first user becomes admin; sets up a certification) → onboarding selects a target cert and default session prefs → optionally take a short **diagnostic exam** to seed weak areas + initial readiness (skippable) → land on dashboard with a real (or "not yet calibrated") baseline → start first session, already adapted if the diagnostic was taken.
*Acceptance:* a new user reaches a running study session without dead-ends, including the no-certifications-yet case ([Onboarding](./SPEC.md#frontend--appsweb)); the first session is adaptive when the diagnostic is completed ([Diagnostic Exam](./SPEC.md#diagnostic-exam)).

**J2 — A study session (the core loop)**
From dashboard, start a session with chosen duration/mix/difficulty/focus → brief "preparing" screen (first 3 items blocking, rest background) → alternating reading blocks and quiz cards, with confidence rating per block → ask the in-session agent when stuck → complete → end-of-session summary (accuracy, domain deltas, readiness change, next-session suggestion).
*Acceptance:* no mid-session waiting; session resumes correctly after refresh; summary reflects updated weak areas and readiness.

**J3 — Checking readiness with a mock exam**
From dashboard, start a mock exam matching real format (count/time limit), no agent access → submit → score breakdown by domain → review mode with correct answers and explanations → readiness score updates with mock weighted higher than session quizzes.
*Acceptance:* exam is timed and agent-free; review mode shows every question; readiness reflects the result.

**J4 — Standalone tutoring**
Open standalone agent chat outside any session → ask general questions → streamed responses from a general-knowledge tutor (no cert-scoped tools/citations).
*Acceptance:* standalone chat works without a session/cert context and does not imply grounding it lacks.

**J5 — Admin onboarding a new certification**
Admin enters a cert name/code → LLM pre-fills domains, weights, exam format, suggested sources → admin reviews/edits/confirms → registers content sources → ingestion runs → cert becomes available for enrollment.
*Acceptance:* a cert can be added and made study-ready entirely through the admin UI, no code changes.

**J6 — A 5-minute review in spare time**
Open the app with a few minutes free → dashboard shows "review due (N)" → tap "5-minute review" → answer a handful of fresh questions on due concepts → readiness ticks up, intervals advance, summary shown.
*Acceptance:* a productive, self-contained study moment is possible in ~5 minutes with zero setup; when nothing is due, the user is gracefully offered a normal session instead ([Spaced Repetition & Review Queue](./SPEC.md#spaced-repetition--review-queue)).

## 6. Functional Requirements (product-level)

Expressed as outcomes; the *how* is in `SPEC.md`.

- **FR1 — Adaptive sessions.** A session's content must be selected based on the user's weak areas, confidence, and chosen config; two users on the same cert get materially different sessions.
- **FR2 — No-wait sessions.** The user must never wait for content mid-session (first items blocking, remainder generated in background).
- **FR3 — Honest readiness signal.** A single 0–100% readiness score, weighted by real-exam domain shares, mock-weighted, and recency-weighted, updated after every session and mock.
- **FR4 — Weak-area transparency.** Users can see which domains are weak and watch them trend over time.
- **FR5 — On-demand tutoring.** An AI tutor is reachable both in-session (cert-grounded, with source citations) and standalone (general).
- **FR6 — Exam-faithful mocks.** Mock exams match the real exam's question count and time limit, with no tutor assistance and a full review afterward.
- **FR7 — Fresh, multi-source knowledge.** Content is ingested from multiple source types and refreshed on a per-source staleness schedule.
- **FR8 — Multi-user isolation.** Every user's progress, sessions, and conversations are private to them.
- **FR9 — Data-driven certifications.** New certs are added via admin without code changes.
- **FR10 — Resumable sessions.** A session survives navigation/refresh and resumes at the last incomplete item.
- **FR11 — Coverage-gated certifications.** A certification is not enrollable by users until its knowledge base meets the go-live coverage bar (§4); admins can see per-domain coverage.
- **FR12 — Post-exam outcome capture.** Users who reach exam-readiness are nudged (in-app + email) to self-report their real-exam result, feeding the lagging pass-rate metric without blocking the app.
- **FR13 — Day-one calibration.** A new enrollment can take an optional short diagnostic exam that seeds weak areas and initial readiness (low weight, fast decay), so the first session is adaptive rather than generic; skippable, with a later re-prompt.
- **FR14 — Spaced-repetition retention.** Shaky concepts (wrong, or correct-but-unsure) enter a per-cert review queue scheduled on a Leitner ladder; due items are consumable both as a standalone "5-minute review" and woven into normal sessions via the spaced-repetition style. Reviews feed weak areas and readiness.
- **FR15 — Skip what you know.** Users can mark a concept or domain as mastered to retire it from review and new-material selection, so study time is never spent re-testing known material.
- **FR16 — Concise-first reading.** Reading blocks default to a short TL;DR with an on-demand "go deeper" expansion, respecting the impatient-with-fluff learner.
- **FR17 — Low-pressure re-engagement.** An opt-out weekly progress digest (readiness, weekly delta, weakest domain, due reviews) re-engages irregular learners with encouragement, never deadline pressure or nagging.
- **FR18 — Fragmented-time access.** The app is responsive and installable as a PWA so study (especially the 5-minute review) works well on a phone in spare moments.
- **FR19 — Passive pacing, no obligation.** A purely informational readiness trajectory ("exam-ready in ~N weeks at your recent pace") is shown on the progress page — no exam-date entry, no reminders — keeping the product a calm tool visited on the user's terms.
- **FR20 — Faithful generated content.** Quiz/exam questions and explanations are grounded in source chunks (extractive) and pass an independent verifier before being shown or cached; unverified items are regenerated or substituted, never displayed. Users can report a bad item, which quarantines it. Reading blocks and the agent stay grounded via citations and abstain-rather-than-guess.
- **FR21 — Trustworthy certification setup.** Exam-format facts are structured, never generated at question time. Primary-target certs ship as verified seed data; for new certs the app discovers the official exam guide via web search, the admin confirms the source, and the agent extracts each field with a per-field citation plus explicit flags on anything ungrounded — so the admin verifies against a recognizable source rather than from memory.

## 7. Assumptions
- The primary user can study online, in English, on the web, in short blocks.
- Public sources provide sufficient coverage and quality per certification to ground useful content.
- LLM generation grounded in retrieved chunks is accurate enough that users trust it; occasional errors are tolerable for study (not for the real exam).
- Users will rate confidence honestly enough for it to inform adaptation.
- A single admin (or small set) curates certifications and sources; this is not self-serve for end users.
- The product is free to use with no monetization in v1; a possible future as an internal company tool means avoiding assumptions that would block org/SSO later, without building for it now.

## 8. Dependencies & Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Ingested content quality/legality** (scraping ToS, stale or wrong material) | Poor or non-compliant study content undermines the core promise | Prefer official/public APIs; per-source review in admin; staleness refresh; content hashing to dedupe |
| **LLM cost at scale** | Per-user economics break | Response + prompt caching, token budgets, tiered model selection ([LLM Cost Optimisation](./SPEC.md#ai--llm-integration)); cost guardrail metric |
| **LLM accuracy / hallucination** | Users study wrong facts | Extractive grounding + independent verifier pass before any question/explanation is shown or cached; regenerate/substitute on failure; in-session citations; abstain-rather-than-guess agent; user report → auto-quarantine ([Grounding & Verification](./SPEC.md#grounding--verification)) |
| **Untrustworthy cert metadata** (admin can't validate exam format from memory) | Wrong readiness weighting, wrong mock format | Verified seed data for primary certs; official-guide-grounded pre-fill with per-field citations and ungrounded-field flags for new certs ([Certification Setup & Grounding](./SPEC.md#certification-setup--grounding)) |
| **Readiness-score credibility** | If the number feels arbitrary, the north-star value evaporates | Formula tunable during implementation; validate score movement against mock outcomes |
| **Scrapper / external-source reliability** | Ingestion stalls | BullMQ retries with backoff, per-source queues, admin visibility into job status |
| **Full-scope v1 size** | Late first release, delayed learning | Documented MVP trim path (§4); build core loop first even within a single-release plan |
| **Cold-start content per new cert** | A newly added cert has thin material | Admin LLM pre-fill of sources + on-demand `fetchMoreMaterial` to fill gaps |

## 9. Resolved Decisions

The product-framing questions that were open during drafting have been decided:

- **North-star targets** — set in §3 (median ≥ +15 readiness points over 4 weeks of active use, ≥ 60% of 10-session users reach exam-ready). Starting bars, tunable on real data.
- **Pass-rate capture** — self-reported via a post-exam survey nudge (in-app + email) triggered after the user reaches exam-readiness and study activity lulls; see §3.
- **Content go-live bar** — per-domain and total-chunk coverage gate before a cert is enrollable; see §4 *Certification go-live criteria*.
- **Free/paid** — always free in v1, no monetization or payment data; possible future internal-company-tool direction noted in §4 / §7.

No product-level open questions remain. Implementation-level tuning values (exact LLM cost budget, readiness formula coefficients) are intentionally deferred to implementation and noted in [`SPEC.md`](./SPEC.md).
