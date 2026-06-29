# Lifecycle Email Spec

## Purpose

Three lifecycle emails layered on the existing `MailModule`: a welcome email on registration, a timezone-aware weekly progress digest with one-click unsubscribe, and an optional post-exam outcome survey nudge. The digest and nudge reuse the existing `ReadinessService`, `WeakAreasService`, and `ReviewService` read surfaces; the weekly-digest schedule is driven by a timezone-aware worker cron. This capability owns no entity and extends the `users` and `user_certifications` tables via its own migrations.

## Requirements

### Requirement: No new entity; extend existing tables via migration

The system SHALL NOT introduce a new entity for lifecycle email. It SHALL extend the `users` table (owned by `auth`) with `digest_opt_out` (boolean, default false), `unsubscribe_token`, and `last_digest_sent_at` (nullable), and the `user_certifications` table (owned by `user-certifications`) with `last_digest_readiness` (nullable), `exam_outcome_nudge_sent_at` (nullable), `exam_outcome_nudge_count` (integer, default 0), `exam_outcome_response` (nullable enum `passed|did_not_pass|not_yet|dismissed`), and `exam_outcome_responded_at` (nullable). It SHALL NOT create or alter any other table.

#### Scenario: Migrations add columns without a new table

- **WHEN** the database migrations for this change are run
- **THEN** the `users` table has `digest_opt_out`, `unsubscribe_token`, and `last_digest_sent_at` columns
- **AND** the `user_certifications` table has `last_digest_readiness`, `exam_outcome_nudge_sent_at`, `exam_outcome_nudge_count`, `exam_outcome_response`, and `exam_outcome_responded_at` columns
- **AND** no new table is created and no other existing table is altered

#### Scenario: Defaults apply on existing rows

- **WHEN** the migration runs against a database with existing `users` and `user_certifications` rows
- **THEN** every existing user row has `digest_opt_out = false` and `exam_outcome_nudge_count = 0` on the relevant enrollment rows, with the nullable columns null

### Requirement: Welcome email on registration

The system SHALL send exactly one welcome email to a user when their registration succeeds, using the existing `MailService` and a registered `welcome` template. The send SHALL NOT block or fail registration: a transport error SHALL be caught and logged, leaving the registration result unchanged.

#### Scenario: Successful registration sends one welcome email

- **WHEN** a new user completes registration
- **THEN** exactly one welcome email is recorded by the capturing transport, addressed to the registered user, with the configured `MAIL_FROM` and a non-empty subject, text, and html body

#### Scenario: A welcome send failure does not break registration

- **WHEN** the mail transport rejects the welcome send
- **THEN** the registration still completes successfully and the failure is logged rather than surfaced to the registering user

### Requirement: Weekly progress digest content

The system SHALL render a weekly progress digest for a user from their active enrollments containing, per enrollment, the current readiness percentage, the weekly readiness delta, the weakest domain, and the count of due review items, in an encouraging, non-nagging tone, and SHALL include a one-click unsubscribe link. When an enrollment is not yet calibrated, the digest SHALL render an encouraging "keep going" variant in place of a numeric readiness score and SHALL omit a delta for that enrollment. Rendering SHALL be a pure function of its assembled inputs, independently testable without sending.

#### Scenario: Digest includes the four metrics and an unsubscribe link

- **WHEN** the digest is rendered for a calibrated enrollment with readiness 72, a +6 weekly delta, weakest domain "Security", and 3 due review items
- **THEN** the rendered text and html contain the readiness value, the weekly delta, "Security" as the weakest domain, the due-review count, and an unsubscribe link

#### Scenario: Uncalibrated enrollment renders the keep-going variant

- **WHEN** the digest is rendered for an enrollment below the readiness calibration bar
- **THEN** no numeric readiness score and no delta are shown for that enrollment, and an encouraging keep-going message is present instead

### Requirement: Weekly delta from the prior digest snapshot

The system SHALL compute the digest's weekly readiness delta as the current readiness minus the readiness snapshot recorded at the previous digest send for that enrollment, and SHALL persist the current readiness as the new snapshot after a successful send. The first digest for an enrollment (no prior snapshot) SHALL render without a delta.

#### Scenario: Delta reflects change since the last digest

- **WHEN** an enrollment's snapshot from the previous digest was 60 and its current readiness is 68 at send time
- **THEN** the rendered delta is +8
- **AND** after the send the enrollment's stored snapshot is 68

#### Scenario: First digest has no delta

- **WHEN** a digest is sent for an enrollment that has no prior readiness snapshot
- **THEN** the digest renders without a weekly delta
- **AND** the enrollment's snapshot is set to the current readiness after the send

### Requirement: Timezone-aware weekly digest scheduling

The system SHALL run a worker cron that schedules each user's weekly digest relative to their stored `displayTimezone`. All timestamps SHALL remain stored in UTC; the send decision SHALL be evaluated in the user's local time. The cron SHALL select a user for a digest when the user's local time has reached the configured digest weekday and hour, the user is not opted out, and no digest has been sent for the user during the current local week. Selection SHALL rely only on database-readable fields (timezone, opt-out flag, last-sent timestamp) and SHALL NOT compute readiness in the worker.

#### Scenario: Two users in different timezones each fire at their local send-time

- **WHEN** the configured send-time is Monday 09:00 local, and user A is in `Europe/Helsinki` and user B is in `America/New_York`
- **THEN** user A is selected when it is Monday 09:00 in Helsinki and user B is selected when it is Monday 09:00 in New York, from the same cron

#### Scenario: Opted-out users are excluded

- **WHEN** a user has `digest_opt_out = true` and their local send-time arrives
- **THEN** the cron does not select them and no digest is sent

#### Scenario: No second digest within the same local week

- **WHEN** a user has already been sent a digest earlier in their current local week
- **THEN** the cron does not select them again until the next local week

### Requirement: One-click unsubscribe

The system SHALL expose a public, token-guarded endpoint `GET /api/v1/email/unsubscribe?token=…` that sets the matching user's digest opt-out flag, using a stable per-user unsubscribe token so the link works without an authenticated session. The endpoint SHALL be idempotent and SHALL NOT reveal whether a token matched a real user beyond a generic confirmation. A subsequent weekly-digest evaluation for that user SHALL NOT send a digest.

#### Scenario: Valid token opts the user out

- **WHEN** a request hits `GET /api/v1/email/unsubscribe` with a user's valid unsubscribe token
- **THEN** the user's `digest_opt_out` becomes true and the response confirms unsubscription
- **AND** the next digest evaluation for that user sends no digest

#### Scenario: Unsubscribe is idempotent

- **WHEN** the same valid unsubscribe token is used twice
- **THEN** both requests succeed and the user remains opted out, with no error on the second call

#### Scenario: Invalid token does not error-leak

- **WHEN** a request uses a token that matches no user
- **THEN** the response is a generic confirmation and no user state changes

### Requirement: Weekly digest opt-out

`User.digestOptOut` SHALL be mutable through **two** paths that write the same field: the existing public tokenized one-click `GET /api/v1/email/unsubscribe?token=...` link in the digest email (opt-out only), and the authenticated `PATCH /api/v1/users/me { digestOptOut }` two-way toggle. Digest send-eligibility logic is unchanged — the weekly-digest cron continues to skip any user whose `digestOptOut` is `true`, regardless of which path set it.

#### Scenario: Both paths converge on the same field

- **WHEN** a user opts out via the email unsubscribe link and later opts back in via authenticated Settings (`PATCH /users/me { digestOptOut: false }`)
- **THEN** the weekly-digest cron treats them as eligible again
- **AND** the tokenized unsubscribe link continues to function unchanged for users who only have the email

### Requirement: Post-exam outcome nudge trigger

The system SHALL send a post-exam outcome nudge for an enrollment only when the enrollment is calibrated, its readiness is greater than or equal to `EXAM_READY_THRESHOLD`, its study activity has lulled (no session or graded answer within `NUDGE_ACTIVITY_LULL_DAYS`), and its nudge allowance is not exhausted. A worker cron SHALL select lull candidates from database-readable activity timestamps and allowance counters; the API SHALL apply the calibrated-and-ready gate (computing readiness via `ReadinessService`) before sending. The nudge email SHALL present the one-tap survey "Did you take the exam yet? Passed / Didn't pass / Not yet."

#### Scenario: Exam-ready enrollment with lulled activity is nudged

- **WHEN** an enrollment is calibrated with readiness ≥ `EXAM_READY_THRESHOLD`, has had no study activity within the lull window, and has not yet been nudged
- **THEN** a nudge email is sent and the enrollment's nudge send is recorded

#### Scenario: Not-yet-ready enrollment is not nudged

- **WHEN** an enrollment's readiness is below `EXAM_READY_THRESHOLD` (or it is not calibrated) even though its activity has lulled
- **THEN** no nudge is sent

#### Scenario: Recently active enrollment is not nudged

- **WHEN** an enrollment is exam-ready but had study activity within the lull window
- **THEN** no nudge is sent

### Requirement: At most one nudge follow-up

The system SHALL send at most `NUDGE_MAX_FOLLOWUPS` follow-up nudge(s) (default 1) after the first nudge. A single follow-up SHALL be sent only after `NUDGE_FOLLOWUP_DELAY_DAYS` have elapsed since the first nudge and only while no survey response has been recorded. Once a response is recorded (including a dismissal), no further nudge SHALL be sent.

#### Scenario: One follow-up after the delay with no response

- **WHEN** an enrollment was nudged once, `NUDGE_FOLLOWUP_DELAY_DAYS` have passed, and no response has been recorded
- **THEN** exactly one follow-up nudge is sent and the nudge count reflects the follow-up

#### Scenario: No third nudge

- **WHEN** an enrollment has already received the first nudge and its one allowed follow-up
- **THEN** no further nudge is ever sent for that enrollment

#### Scenario: A recorded response stops follow-ups

- **WHEN** an enrollment has been nudged once and the user records any survey response before the follow-up delay elapses
- **THEN** no follow-up nudge is sent

### Requirement: Exam-outcome survey response capture

The system SHALL expose `POST /api/v1/user-certifications/:id/exam-outcome` that records the owning user's survey response (`passed`, `did_not_pass`, `not_yet`, or `dismissed`) for that enrollment. The response SHALL feed the self-reported pass-rate metric only and SHALL NOT alter the enrollment's readiness score. Access SHALL be restricted to the owning user; a request for an enrollment the user does not own SHALL return `404`.

#### Scenario: Owner records an outcome

- **WHEN** the owning user POSTs `exam-outcome` with `passed` for their enrollment
- **THEN** the response is recorded with a response timestamp and the call succeeds

#### Scenario: Recording an outcome does not change readiness

- **WHEN** a user records any exam-outcome response and readiness is computed again for that enrollment
- **THEN** the readiness score is unchanged by the recorded response

#### Scenario: Another user cannot record an outcome

- **WHEN** a user POSTs `exam-outcome` for an enrollment they do not own
- **THEN** the response is `404` and no state changes

### Requirement: Internal lifecycle-email trigger endpoints are guarded

The system SHALL expose internal endpoints `POST /internal/lifecycle/digest` and `POST /internal/lifecycle/nudge`, called by the worker crons with the candidate identifiers, that require a valid `INTERNAL_API_SECRET` and are excluded from the public OpenAPI/Orval client and from the user `JwtAuthGuard`. A request without a valid secret SHALL be rejected and SHALL perform no sending.

#### Scenario: Valid secret triggers assembly and send

- **WHEN** the worker calls `POST /internal/lifecycle/digest` with the configured secret and a list of due user IDs
- **THEN** the API assembles and sends a digest for each eligible user and updates their snapshots

#### Scenario: Missing or wrong secret is rejected

- **WHEN** an internal lifecycle endpoint is called without a valid `INTERNAL_API_SECRET`
- **THEN** the request is rejected (`401`/`403`) and no email is sent

### Requirement: Lifecycle email configuration is validated at boot

The system SHALL validate, in the relevant app's Zod env schema, the lifecycle-email configuration and fail fast naming the offending variable if a required value is missing or malformed. `apps/api` SHALL validate `DIGEST_SEND_WEEKDAY`, `DIGEST_SEND_HOUR`, `EXAM_READY_THRESHOLD` (default 80), `NUDGE_ACTIVITY_LULL_DAYS`, `NUDGE_FOLLOWUP_DELAY_DAYS`, `NUDGE_MAX_FOLLOWUPS` (default 1), `PUBLIC_API_URL`, and `INTERNAL_API_SECRET`. `apps/worker` SHALL validate `DIGEST_SEND_WEEKDAY`, `DIGEST_SEND_HOUR`, `NUDGE_ACTIVITY_LULL_DAYS`, `INTERNAL_API_BASE_URL`, and `INTERNAL_API_SECRET`. SMTP2GO and `MAIL_FROM` remain validated by the `mail` change.

#### Scenario: Valid config exposes typed values

- **WHEN** the env schema parses a valid lifecycle-email configuration
- **THEN** parsing succeeds and exposes `EXAM_READY_THRESHOLD` and `DIGEST_SEND_HOUR` as numbers and `INTERNAL_API_SECRET` as a non-empty string

#### Scenario: Boot fails when a required value is malformed

- **WHEN** the env schema parses a configuration with `DIGEST_SEND_HOUR=not-a-number`
- **THEN** parsing throws an error whose message names `DIGEST_SEND_HOUR`
