## Why

The product needs three lifecycle emails that the prior changes deliberately deferred to here (the `mail` proposal explicitly leaves "welcome + weekly digest + post-exam nudge" to `email-lifecycle`):

- **Welcome email on registration** — first-touch onboarding (SPEC → Email).
- **Weekly progress digest** — readiness %, weekly delta, weakest domain, and due-review count with a gentle, never-nagging prompt to continue, plus one-click unsubscribe. Send-time is rendered in the user's display timezone, and the digest cron schedules each user's send relative to their stored timezone (SPEC → Email; the timezone-aware weekly-digest cron is the worker deliverable assigned to this change in IMPLEMENTATION-ORDER → Cross-cutting deliverables).
- **Post-exam outcome nudge** — after a user reaches exam-readiness and study activity lulls, a one-tap "Did you take the exam? Passed / Didn't pass / Not yet" survey, optional and dismissible with at most one follow-up, feeding the lagging self-reported pass-rate metric and not the readiness score (SPEC → Email; PRD §3 → Capturing the lagging outcome).

All sending infrastructure (`MailModule`, typed `MailService`, template renderer, SMTP2GO transport, capturing test transport) already exists from `mail`. All read surfaces already exist: `ReadinessService.compute` (named in the readiness spec as the entry point "downstream … digest features call"), `WeakAreasService` (ranked weakest-first), and `ReviewService` (per-enrollment due-review count). This change wires those together into lifecycle triggers and adds the timezone-aware scheduling.

## What Changes

- **Welcome email (`apps/api`)** — register a `welcome` template in the existing mail registry and send it once on successful registration via the existing `MailService`. A send failure is logged but never blocks registration.
- **Weekly progress digest** split across both apps along the "who can compute readiness" line:
  - **Worker cron (`apps/worker`, timezone-aware)** — the cross-cutting deliverable. On a frequent fixed tick it selects users whose *local* time (their stored `displayTimezone`, UTC storage) has reached the configured digest weekday + hour, who are not opted out, and who have not already been sent a digest this local week. It hands the due user IDs to the API over a shared-secret-guarded internal endpoint. Selection is DB-readable only (timezone, opt-out, last-sent) — no readiness math in the worker.
  - **API assembly + send (`apps/api`)** — for each due user, assemble the digest from the user's active enrollments using `ReadinessService.compute`, `WeakAreasService` (weakest domain), and `ReviewService` (due-review count); compute the **weekly delta** against the per-enrollment readiness snapshot stored at the previous send; render the `digest` template (encouraging tone, one-click unsubscribe link); send via `MailService`; then update `lastDigestSentAt` and the per-enrollment readiness snapshot.
  - **Opt-out / one-click unsubscribe** — a public, token-guarded `GET /api/v1/email/unsubscribe?token=…` endpoint that sets the user's digest opt-out flag (idempotent), plus the digest honoring that flag. The unsubscribe token is a stable per-user secret so the link works without an authenticated session.
- **Post-exam outcome nudge** split the same way:
  - **Worker cron (`apps/worker`)** — selects enrollment candidates whose study activity has lulled (last session/answer older than the configured window) and that have not exhausted their nudge allowance, again DB-readable only, and hands them to the API.
  - **API readiness gate + send (`apps/api`)** — for each candidate, gate on the enrollment being *calibrated* and readiness ≥ `EXAM_READY_THRESHOLD`; if it passes, render and send the `exam-nudge` survey email, record the send, and enforce "at most one follow-up" (a single re-ask after a delay when there was no response).
  - **Survey response endpoint (`apps/api`)** — `POST /api/v1/user-certifications/:id/exam-outcome` records `passed` / `did_not_pass` / `not_yet` / `dismissed`, owner-scoped (404 for non-owners). Responses feed the pass-rate metric only and never alter readiness. This also backs the in-app survey surface.
- **Config (Zod, fail-fast)** — `apps/api`: `DIGEST_SEND_WEEKDAY`, `DIGEST_SEND_HOUR`, `EXAM_READY_THRESHOLD` (default 80), `NUDGE_ACTIVITY_LULL_DAYS`, `NUDGE_FOLLOWUP_DELAY_DAYS`, `NUDGE_MAX_FOLLOWUPS` (default 1), `PUBLIC_API_URL` (for the unsubscribe link), `INTERNAL_API_SECRET`. `apps/worker`: `DIGEST_SEND_WEEKDAY`, `DIGEST_SEND_HOUR`, `NUDGE_ACTIVITY_LULL_DAYS`, `INTERNAL_API_BASE_URL`, `INTERNAL_API_SECRET`. SMTP2GO + `MAIL_FROM` are already validated in `apps/api` (from `mail`).

### Migrations (no new entity)

Per the Entity Ownership table this change **owns no entity**; it extends two existing tables via its own migrations (the table permits column extensions by a non-owning change):

- **`users`** (owned by `auth`): add `digest_opt_out` (boolean, default false), `unsubscribe_token` (stable per-user secret), `last_digest_sent_at` (datetime, nullable).
- **`user_certifications`** (owned by `user-certifications`): add `last_digest_readiness` (numeric, nullable — the weekly-delta snapshot), `exam_outcome_nudge_sent_at` (datetime, nullable), `exam_outcome_nudge_count` (int, default 0), `exam_outcome_response` (enum `passed|did_not_pass|not_yet|dismissed`, nullable), `exam_outcome_responded_at` (datetime, nullable). This mirrors the existing precedent of `diagnostic` adding `diagnostic_re_prompted_at` to the same table.

## Capabilities

### New Capabilities
- `lifecycle-email`: Three lifecycle emails on top of the existing `MailModule` — a welcome email on registration; a timezone-aware weekly progress digest (readiness %, weekly delta, weakest domain, due-review count) with one-click unsubscribe scheduled per the user's display timezone by a worker cron and assembled/sent by the API from `ReadinessService`/`WeakAreasService`/`ReviewService`; and an optional, dismissible post-exam outcome survey nudge (≤1 follow-up) triggered when an enrollment is exam-ready and study activity lulls, whose response feeds the pass-rate metric without affecting readiness.

### Modified Capabilities
<!-- None. Welcome/digest/nudge are new templates registered in the existing mail registry; the mail proposal already designated these as authored by this change, so the `transactional-email` capability's requirements are unchanged. Readiness/weak-areas/review are consumed via their existing service entry points, not modified. -->

## Impact

- **apps/api**: new `LifecycleEmailModule` — `lifecycle-email.service.ts` (digest + nudge assembly, reusing `ReadinessService`/`WeakAreasService`/`ReviewService`/`MailService`), `welcome.trigger` wired into the registration path, internal controller (`POST /internal/lifecycle/digest`, `POST /internal/lifecycle/nudge`, shared-secret guard), public `email.controller` (`GET /api/v1/email/unsubscribe`), `exam-outcome.controller` (`POST /api/v1/user-certifications/:id/exam-outcome`). New `welcome`, `digest`, `exam-nudge` templates in `apps/api/src/mail/templates`.
- **apps/worker**: new `LifecycleEmailModule` with two `@nestjs/schedule` crons (digest scheduler, nudge scheduler) that do timezone/lull/throttle selection from the DB and call the API internal endpoints via an HTTP client (existing scrapper-client pattern).
- **packages/db**: two migrations extending `users` and `user_certifications`; no new entity.
- **packages/shared**: DTO/types + constants for the exam-outcome response set and the digest/nudge config defaults; new env-schema keys for api + worker.
- **apps/web**: new endpoints surface in the Orval client (consumed later by `web-dashboard`/`web-progress` for the in-app nudge surface); no UI in this change.
- **Entities owned**: none (per the Entity Ownership table). Extends `User` and `UserCertification` via own migrations.
- **Cross-cutting**: includes the worker-side **timezone-aware weekly progress digest** cron assigned to this change. The post-exam nudge's lull detection is necessarily a second worker cron (a design consequence of "activity lulls"). No SPEC → Observability → Metrics feature metric is attributed to this change; an emails-sent counter is emitted opportunistically against the existing observability infra.
- **Depends on (all archived)**: `mail` (MailModule/service/templates/transport), `users` (display timezone, profile, deletion), `readiness` (`ReadinessService.compute`, calibration, exam-ready notion), `weak-areas` (`WeakAreasService` ranked weakest-first), `review-srs` (`ReviewService` due-review count).
- **Unblocks**: the in-app nudge surface in later `web-*` pages; no further backend change depends on this one.
