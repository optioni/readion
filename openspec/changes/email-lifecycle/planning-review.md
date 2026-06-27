## Reviewed Artifacts

- proposal.md
- specs/lifecycle-email/spec.md
- design.md
- tasks.md

Reviewed as a single contract for cross-artifact consistency, capability/scenario coverage, design completeness, test boundaries, task alignment, and contradictions/stale assumptions.

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | Task 1.2 adds new Zod env keys for `apps/api` and `apps/worker` but does not update the `.env.example` files, which the project conventions require ("Each app has a `.env.example`"). Without this, a fresh checkout cannot boot the new config and the fail-fast Zod validation would reject startup. | Appended an explicit instruction to add every new key to `apps/api/.env.example` and `apps/worker/.env.example`. | tasks.md → Task 1.2 |
| WARNING | design.md | Open Question #1 left "all active enrollments vs. one primary enrollment" unresolved and explicitly permitted collapsing to the most-recently-active enrollment — contradicting the spec, whose `Weekly progress digest content` requirement mandates rendering "from their active enrollments containing, **per enrollment**…". Design and spec disagreed on digest scope. | Marked the question resolved and aligned design.md with the spec: one email per user, one section per active enrollment, no collapse to a single enrollment. | design.md → Open Questions |
| WARNING | proposal.md / tasks.md | Proposal Impact states an emails-sent counter "is emitted opportunistically against the existing observability infra," but no task captured emitting it, so the work would have been silently dropped. | Added a task to emit the opportunistic emails-sent counter on each welcome/digest/nudge send. | tasks.md → Task 9.4 (renumbered prior 9.4 cleanup to 9.5) |

## No Remaining Implementation-Blocking Gaps

After the fixes above, no implementation-blocking planning gaps remain. Verified:

- **Capability coverage** — The single new capability `lifecycle-email` named in proposal.md has a matching `specs/lifecycle-email/spec.md`; all behavior appears under ADDED Requirements (this change owns no entity and modifies no existing capability, consistent with the proposal's empty Modified Capabilities section). No capability exists only in design.md or tasks.md.
- **Scenario coverage** — Every spec requirement maps to outside-in task work: migrations (1.3–1.4), welcome (2.x), digest content + delta (3.x), unsubscribe (4.x), timezone cron (5.x), internal guard (6.x), nudge trigger + follow-up (7.x), survey response (8.x), config validation (1.1–1.2). Each scenario is concrete enough to become an acceptance test and is reflected in the Outer Loop acceptance test (0.2).
- **Design completeness** — design.md resolves the implementation-critical choices: the worker-schedules / API-assembles split along the readiness boundary, the two extension migrations (no new entity), the internal shared-secret channel and its exclusion from the public client + `JwtAuthGuard`, timezone-window evaluation without per-user timers, the per-enrollment snapshot for weekly delta, the stable per-user unsubscribe token, the nudge allowance/follow-up policy, and the fire-and-forget welcome send. UI is an explicit Non-Goal, so no visual-design reconciliation is owed by this change.
- **Test boundaries** — design.md's Test Boundaries table names each collaborator (Postgres via Testcontainers, capturing SMTP transport, real vs. mocked `ReadinessService`/`WeakAreasService`/`ReviewService`, the worker→API channel, schedulers invoked directly, injected clock). No task invents a mock boundary the design does not name.
- **Task alignment** — tasks.md follows outside-in order (acceptance test first at section 0, RED→GREEN→REFACTOR within each unit), and now covers config + `.env.example`, migrations, all endpoints, both worker crons, the Orval client regeneration (9.3), the observability counter (9.4), subagent review (10.x), and the polish/verification gates (11.x).
- **Contradictions and stale assumptions** — The digest-scope contradiction between design and spec is resolved. The remaining design Open Questions are non-blocking: the registration hook point (post-registration vs. post-verification) is defaulted to registration success and is carried as an explicit resolve-during-implementation note in Task 2.4; the "unsubscribe suppresses nudge?" question is settled consistently across spec (unsubscribe ties to the digest only) and design (the nudge is independently dismissible). The `exam_outcome_response` enum (`passed|did_not_pass|not_yet|dismissed`) and the config defaults (`EXAM_READY_THRESHOLD` = 80, `NUDGE_MAX_FOLLOWUPS` = 1) are consistent across proposal, spec, and tasks.

## Deferred Non-Blocking Notes

- **Digest cost / fan-out** — design.md (Risks) intentionally defers batching/queueing of digest assembly; v1 processes the worker's candidate list sequentially in the API, with the note to revisit if the active-user population grows. Not in v1 scope and not implementation-blocking.
- **Unsubscribe link landing page** — design.md (Risks) defers any frontend confirmation page; the v1 unsubscribe endpoint returns a generic confirmation directly and may 302 to a frontend route in a later `web-*` change. UI is a stated Non-Goal here.
