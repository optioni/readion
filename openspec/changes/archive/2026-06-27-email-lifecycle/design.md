## Context

`mail` stood up the `MailModule` in `apps/api`: a typed `MailService` that sends a registered template by name with a typed payload, a `text`+`html` renderer with a shared base layout, an SMTP2GO transport built from validated config, and a capturing test transport. It explicitly deferred the welcome, weekly-digest, and post-exam-nudge templates and their triggers to `email-lifecycle`. The read surfaces this change needs already exist as injectable services in `apps/api`: `ReadinessService.compute(userCertificationId)` (the readiness spec names the digest as a caller), `WeakAreasService` (ranked weakest-first), and `ReviewService` (per-enrollment due-review count, `dueAt <= now`, `state: active`).

The central architectural tension: **the timezone-aware weekly-digest cron is a worker deliverable, but readiness/weak-area/review computation lives only in `apps/api`.** Readiness in particular is a *read-through* value with no persisted column (the readiness spec forbids a readiness table), so the worker cannot derive it from SQL the way the existing `session-abandonment` and `user-purge` crons read their state. Duplicating three scoring algorithms into `apps/worker` would create a divergent second source of truth — a clear anti-pattern given the single-source-of-truth conventions.

## Goals / Non-Goals

**Goals:**
- Welcome email sent once on successful registration, non-blocking.
- Timezone-aware weekly digest (readiness %, weekly delta, weakest domain, due-review count) scheduled per the user's stored `displayTimezone`, with one-click unsubscribe and opt-out.
- Post-exam outcome nudge gated on exam-ready + study lull, optional/dismissible, ≤1 follow-up, with an owner-scoped survey-response endpoint that feeds the pass-rate metric only.
- Validated config for send-time, exam-ready threshold, lull window, follow-up policy, and the internal worker→api channel.
- Two extension migrations (`users`, `user_certifications`); no new entity.

**Non-Goals:**
- Any frontend/UI for the in-app nudge surface or unsubscribe confirmation page (later `web-*` pages); this change only exposes the endpoints.
- Modifying the `transactional-email`, `exam-readiness`, `weak-areas`, or `spaced-repetition` spec requirements — those are consumed, not changed.
- Computing or persisting readiness in the worker; readiness stays canonical in `apps/api`.
- The lagging pass-rate read model / product dashboard (belongs to `product-analytics`); this change only captures the raw survey response.
- Deadline reminders or exam-date prompts — the readiness trajectory explicitly forbids them; the digest and nudge are the only sanctioned lifecycle emails and both respect opt-out/dismiss.

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (`users`, `user_certifications`, weak/review/mock tables) | real (Testcontainers) | real (Testcontainers) for migration/repo; n/a for pure logic |
| SMTP | capturing test transport (from `mail`) — assert what was sent | n/a; rendering tested as a pure function |
| `MailService` / template renderer | real, with capturing transport | renderer is a pure `{subject,text,html}` function |
| `ReadinessService` / `WeakAreasService` / `ReviewService` | real services against test DB | mocked at the service interface for assembly logic |
| Worker→API internal channel | real HTTP (Supertest target) or in-process call with the shared secret | selection/eligibility logic unit-tested without HTTP |
| Worker schedulers (`@nestjs/schedule`) | cron method invoked directly (not waiting on the timer) | pure timezone-window / lull / throttle logic unit-tested with an injected clock |
| Timezone / week-boundary / lull boundary | seeded `displayTimezone` + timestamps, injected fixed clock | injected fixed clock; table-driven across zones |
| Playwright e2e | drives real API; register → welcome captured; trigger digest/nudge via internal endpoint; assert captured mail + unsubscribe + survey response | n/a |

## Decisions

- **Split along the readiness boundary: worker schedules, API assembles + sends.** The two worker crons own *timing* — they select due users (digest: local weekday+hour, not opted out, not yet sent this week) and lull candidates (nudge: last activity older than the window, allowance not exhausted) using DB-readable fields only, then POST the candidate IDs to shared-secret-guarded internal API endpoints. The API owns *content* — it computes readiness (and the readiness-≥-threshold nudge gate), assembles the metrics via the existing services, renders via `MailService`, sends, and persists the snapshots/counters. This keeps readiness single-sourced in `apps/api` while still satisfying "the timezone-aware digest cron is a worker deliverable."
  - *Alternative rejected — worker computes everything locally:* would duplicate readiness/weak-area/review scoring into `apps/worker` and risk divergence; readiness has no persisted value to read.
  - *Alternative rejected — cron in `apps/api`:* the roadmap (Cross-cutting deliverables → worker-side crons; SPEC → Content Pipeline → Scheduling) places scheduled processors in `apps/worker`.
- **Internal worker→API channel guarded by a shared secret.** The worker reuses its existing HTTP-client pattern (`scrapper.client`) to call `POST /internal/lifecycle/digest` and `POST /internal/lifecycle/nudge`. Both require a header carrying `INTERNAL_API_SECRET` and are excluded from the public OpenAPI/Orval surface and from `JwtAuthGuard` (a dedicated guard). This is a new but minimal seam; it avoids running BullMQ consumers in `apps/api`.
- **Timezone-aware scheduling without per-user timers.** The digest cron ticks frequently (e.g. hourly) and, for each non-opted-out user, converts "now" into the user's `displayTimezone` and fires when the local weekday equals `DIGEST_SEND_WEEKDAY` and the local hour equals `DIGEST_SEND_HOUR`, provided `last_digest_sent_at` is before the start of the current local week. All timestamps stay in UTC; only the comparison is timezone-rendered (`Intl`/`date-fns-tz`). This makes two users in different zones receive their digest at their own local send-time from one cron.
- **Weekly delta via a per-enrollment snapshot.** Readiness is read-through with no history table, so the digest stores `last_digest_readiness` per enrollment at send time and computes next week's delta as `current − snapshot`. The first-ever digest for an enrollment has no prior snapshot and renders without a delta. Uncalibrated enrollments render an encouraging "keep going to unlock your score" variant instead of a number, and seed no delta.
  - *Alternative rejected — an as-of-timestamp readiness query:* would expand `ReadinessService`'s contract (out of scope) and re-run scoring over historical answers.
- **One-click unsubscribe via a stable per-user token.** `unsubscribe_token` is generated per user (lazily on first digest if absent) so the email link works with no session. The endpoint is public, idempotent, and sets `digest_opt_out = true`. Opt-out only affects the digest; the nudge is governed by its own dismiss/allowance rules.
- **Nudge allowance and "at most one follow-up."** `exam_outcome_nudge_count` enforces ≤ `NUDGE_MAX_FOLLOWUPS` re-asks: the first nudge sets count to 1; a single follow-up is sent only after `NUDGE_FOLLOWUP_DELAY_DAYS` when there is still no response; any recorded response (including `dismissed`) stops further nudges. The survey response is per-enrollment because exam-readiness is per-enrollment.
- **No new entity; extend two owned tables.** Following the `diagnostic` precedent (which added `diagnostic_re_prompted_at` to `user_certifications`), this change adds digest/opt-out columns to `users` and snapshot/nudge columns to `user_certifications` via its own migrations, never claiming ownership of either entity.
- **Welcome send is fire-and-forget.** Triggered on the registration success path; a transport rejection is caught and logged so it never fails registration (the `mail` service still surfaces errors to direct callers — the welcome trigger is the one that swallows-and-logs).

## Risks / Trade-offs

- **Internal endpoint as a new attack surface** → restrict to a constant-time shared-secret header check, exclude from the public client, and bind to the internal network in deployment; integration-test that a missing/wrong secret is rejected (`401/403`).
- **Timezone correctness (DST, half-hour zones, week start)** → unit-test the local-window predicate table-driven across multiple zones and a DST transition with an injected clock; define "week" explicitly (local-time week containing `now`) so `last_digest_sent_at` throttling can't double-send or skip.
- **Digest cost / fan-out** → the API assembles per active enrollment and calls `ReadinessService.compute` (which recomputes weak areas). For v1 the active-user population is small; batch the worker's candidate list and let the API process sequentially. Revisit batching/queueing if volume grows (not in v1 scope).
- **Nudge false positives (lull ≠ took-the-exam)** → accepted by design: the nudge is optional, dismissible, capped at one follow-up, and feeds a lagging self-reported metric only (PRD §3). Readiness is never affected.
- **Frontend link base URLs** → unsubscribe must hit the API directly (`PUBLIC_API_URL`); only `CORS_ORIGIN` exists today as a web origin. If a nudge link should land on a frontend route, reuse `CORS_ORIGIN`; the unsubscribe endpoint may 302 to a frontend confirmation later.

## Open Questions

- ~~Does the digest summarize *all* active enrollments in one email (one section per cert) or only a primary enrollment?~~ **Resolved by the spec.** The `Weekly progress digest content` requirement renders the digest "from their active enrollments containing, **per enrollment**, the current readiness percentage, the weekly readiness delta, the weakest domain, and the count of due review items." The digest is therefore one email per user with one section per active enrollment; it does not collapse to a single primary enrollment.
- Should global unsubscribe also suppress the nudge, or only the digest? Default: unsubscribe = digest opt-out only (SPEC ties one-click unsubscribe to the digest); the nudge is independently dismissible. Revisit if product wants a single "all lifecycle email" off switch.
- Exact registration hook point for the welcome email (post-registration vs. post-verification). Default: on successful registration; resolve by reading the `auth` registration path during task 2.
