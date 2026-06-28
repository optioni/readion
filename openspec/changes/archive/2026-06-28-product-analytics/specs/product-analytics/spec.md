# Product Analytics Spec

## Purpose

An admin-only product-metrics dashboard read model layered over existing study, agent, and readiness data. It defines the active-user population and derives the PRD §3 success metrics — north-star readiness gain, sessions/week, week-2/week-4 retention, session completion rate, agent engagement rate, the LLM-cost-per-active-user guardrail, and the lagging self-reported pass rate — each compared against a configured v1 target. This capability owns no entity, adds no migration, and consumes every input read-only.

## ADDED Requirements

### Requirement: No new entity; derived read models only

The system SHALL compute all product-analytics metrics as derived, read-through read models over data owned by other changes (`StudySession`, `QuizResponse`, `MockExam`, `AgentConversation`/`AgentMessage`, `User`, `UserCertification`, and the `exam_outcome_response` columns on `user_certifications`). It SHALL NOT introduce a new entity and SHALL NOT add a migration; in particular it SHALL NOT create or alter any of those tables.

#### Scenario: No schema change is introduced

- **WHEN** this change is applied and the database migrations are listed
- **THEN** no migration belongs to this change and no new table or column is created or altered by it

### Requirement: Active-user population definition

The system SHALL define an active user as a user who has at least `ANALYTICS_ACTIVE_MIN_SESSIONS` (default 2) `StudySession`s that reached a terminal completed state (ended via the end-of-session flow, not `abandoned`) with `endedAt` within the trailing `ANALYTICS_ACTIVE_WINDOW_DAYS` (default 14) of the reporting instant. This active-user set SHALL be the shared population for every per-active-user metric. Both `study`- and `review`-kind sessions SHALL count.

#### Scenario: User meeting the bar is active

- **WHEN** a user has 2 completed sessions ended within the trailing 14 days
- **THEN** the user is counted in the active-user population

#### Scenario: One completed session is not enough

- **WHEN** a user has exactly 1 completed session within the window (the rest abandoned or older)
- **THEN** the user is not counted as active

#### Scenario: Abandoned sessions do not count

- **WHEN** a user has 2 `abandoned` sessions in the window and no completed ones
- **THEN** the user is not counted as active

### Requirement: North-star median readiness gain per active user

The system SHALL report, as the north-star metric, the median over active users of each active user's readiness gain — readiness at the reporting instant minus readiness as of the start of the trailing `ANALYTICS_NORTHSTAR_WINDOW_DAYS` (default 28) window — and SHALL pair it with the configured target `ANALYTICS_TARGET_NORTHSTAR_GAIN` (default 15). The as-of window-start readiness SHALL be derived from the timestamped `QuizResponse`/`MockExam` rows that drive readiness, not from any persisted readiness snapshot. An enrollment that is not yet calibrated at a boundary SHALL contribute no gain (excluded from the median rather than counted as zero).

#### Scenario: Gain reflects readiness improvement over the window

- **WHEN** an active user's readiness was 50 at the window start and is 65 now
- **THEN** that user's contributed readiness gain is +15

#### Scenario: Median is reported with the target

- **WHEN** the overview is computed over a population of active users with known per-user gains
- **THEN** the north-star value equals the median of those gains and is returned alongside the configured target

#### Scenario: Uncalibrated boundary is excluded

- **WHEN** an active user is not yet calibrated at the window start
- **THEN** that user contributes no gain to the median rather than a zero

### Requirement: Sessions per active user per week

The system SHALL report the median number of completed sessions per active user per week over the reporting window, paired with the configured target `ANALYTICS_TARGET_SESSIONS_PER_WEEK` (default 2).

#### Scenario: Median sessions/week is reported with target

- **WHEN** the overview is computed over the active-user population
- **THEN** it returns the median completed-sessions-per-week across active users and the configured target

### Requirement: Week-2 and week-4 retention cohorts

The system SHALL group users into registration-week cohorts by `User.createdAt` and report, per cohort, the fraction of the cohort that still meets the active-user definition in the 2nd week and in the 4th week after registration, pairing the week-4 figure with the configured target `ANALYTICS_TARGET_W4_RETENTION` (default 0.40). Each cohort's size SHALL be reported alongside its retention fractions.

#### Scenario: Retention is computed per registration cohort

- **WHEN** a registration cohort has N users and a known subset is active in week 2 and in week 4
- **THEN** the cohort's W2 and W4 retention are those subset fractions and the cohort size N is reported

### Requirement: Session completion rate

The system SHALL report the session completion rate over the window as the number of sessions that reached the end-of-session summary (ended with a terminal non-`abandoned` status) divided by the number of sessions started, paired with the configured target `ANALYTICS_TARGET_COMPLETION_RATE` (default 0.75).

#### Scenario: Completion rate counts only sessions that reached summary

- **WHEN** 100 sessions were started in the window, 80 reached the end-of-session summary and 20 were abandoned
- **THEN** the completion rate is 0.80 and the configured target is returned with it

### Requirement: Agent engagement rate

The system SHALL report the agent engagement rate as the fraction of sessions in the window that have at least one agent interaction — a session-linked `AgentConversation` carrying at least one `role: user` `AgentMessage` — paired with the configured target `ANALYTICS_TARGET_AGENT_ENGAGEMENT` (default 0.50).

#### Scenario: Sessions with an agent interaction are counted

- **WHEN** of the sessions in the window, half have a linked conversation with at least one user message
- **THEN** the agent engagement rate is 0.50 and the configured target is returned with it

#### Scenario: A linked conversation with no user message does not count

- **WHEN** a session has a linked `AgentConversation` but no `role: user` message
- **THEN** that session is not counted as engaged

### Requirement: LLM-cost-per-active-user guardrail (derived proxy)

The system SHALL report an estimated LLM cost per active user over the window as a derived proxy: the sum across the active population of countable LLM-driven artifacts (`QuizResponse` rows, `MockExam` question counts, session-item generations, and assistant/tool `AgentMessage` rows) each multiplied by its configured per-task cost coefficient (`ANALYTICS_COST_*`), divided by the active-user count, paired with the configured budget `ANALYTICS_LLM_COST_BUDGET`. The value SHALL be labelled as an estimate, since no per-user token cost is persisted. The agent/SSE error-rate and content-ingestion-success guardrails SHALL NOT be re-derived here — they remain the operational Prometheus series emitted by their owning changes.

#### Scenario: Cost proxy is the coefficient-weighted artifact sum per active user

- **WHEN** the active population has known counts of quiz responses, mock questions, session items, and agent messages
- **THEN** the reported cost per active user equals the coefficient-weighted sum of those counts divided by the active-user count, returned with the configured budget

### Requirement: Lagging self-reported pass rate

The system SHALL report the lagging self-reported real-exam outcome as a breakdown of `exam_outcome_response` values (`passed`, `did_not_pass`, `not_yet`, `dismissed`) recorded on enrollments. This metric SHALL be display-only and SHALL NOT feed any other metric or the readiness score. When no outcome responses exist, the breakdown SHALL report zeros rather than failing.

#### Scenario: Pass-rate breakdown reflects recorded outcomes

- **WHEN** enrollments have recorded a mix of `passed` and `did_not_pass` outcomes
- **THEN** the overview returns the count breakdown across the four outcome values

#### Scenario: No recorded outcomes yields zeros

- **WHEN** no enrollment has recorded an exam outcome
- **THEN** the breakdown reports zeros and the request still succeeds

### Requirement: Admin-only product-analytics overview endpoint

The system SHALL expose `GET /api/v1/admin/analytics/overview`, protected by the global `JwtAuthGuard` and restricted to the `admin` role via `RolesGuard` (`@Roles('admin')`), returning in the standard `{ data }` envelope the full product dashboard read model over the reporting window: active-user count, north-star median readiness gain, median sessions/week, W2/W4 retention cohorts, session completion rate, agent engagement rate, the LLM-cost-per-active-user proxy, and the lagging pass-rate breakdown — each metric paired with its configured v1 target where one exists. A non-admin caller SHALL receive `403`; an unauthenticated caller SHALL receive `401`.

#### Scenario: Admin receives the full overview with targets

- **WHEN** an authenticated `admin` requests `GET /api/v1/admin/analytics/overview`
- **THEN** the response is `200` with a `{ data }` envelope containing every metric section and, for each metric that has one, its configured target

#### Scenario: Non-admin is forbidden

- **WHEN** an authenticated user with role `user` requests the overview
- **THEN** the response is `403` and no analytics data is returned

#### Scenario: Unauthenticated request is rejected

- **WHEN** an unauthenticated request hits the overview endpoint
- **THEN** the response is `401`

### Requirement: Product-analytics configuration is validated at boot

The `apps/api` Zod env schema SHALL validate the product-analytics configuration group and fail fast naming the offending variable if a required value is missing or malformed: the window and population settings `ANALYTICS_ACTIVE_WINDOW_DAYS` (default 14), `ANALYTICS_ACTIVE_MIN_SESSIONS` (default 2), `ANALYTICS_NORTHSTAR_WINDOW_DAYS` (default 28); the per-task cost coefficients `ANALYTICS_COST_QUIZ`, `ANALYTICS_COST_MOCK_QUESTION`, `ANALYTICS_COST_SESSION_ITEM`, `ANALYTICS_COST_AGENT_MESSAGE`; and the targets `ANALYTICS_TARGET_NORTHSTAR_GAIN` (15), `ANALYTICS_TARGET_SESSIONS_PER_WEEK` (2), `ANALYTICS_TARGET_W4_RETENTION` (0.40), `ANALYTICS_TARGET_COMPLETION_RATE` (0.75), `ANALYTICS_TARGET_AGENT_ENGAGEMENT` (0.50), and `ANALYTICS_LLM_COST_BUDGET`. Every key SHALL be present in `apps/api/.env.example`.

#### Scenario: Valid config exposes typed values

- **WHEN** the env schema parses a valid product-analytics configuration
- **THEN** parsing succeeds and exposes `ANALYTICS_ACTIVE_MIN_SESSIONS` and `ANALYTICS_NORTHSTAR_WINDOW_DAYS` as numbers and the targets as numbers

#### Scenario: Boot fails when a required value is malformed

- **WHEN** the env schema parses a configuration with `ANALYTICS_ACTIVE_WINDOW_DAYS=not-a-number`
- **THEN** parsing throws an error whose message names `ANALYTICS_ACTIVE_WINDOW_DAYS`
