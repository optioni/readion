## Reviewed Artifacts

- proposal.md
- specs/content-ingestion/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | proposal.md | Proposal listed `content-source-admin` as a Modified Capability, but no `specs/content-source-admin/spec.md` delta existed — a dangling capability with no spec file. | Determined `content-source-admin`'s "register a content source" requirement is parameterized by "one of the `contentSourceTypes` enum", so narrowing that shared tuple changes no requirement text there. Removed `content-source-admin` from Modified Capabilities and folded the observable "`quizlet` now rejected" behavior into the `content-ingestion` delta. | proposal.md § Capabilities |
| WARNING | specs/content-ingestion/spec.md | The "Unsupported type is not selectable or registrable" scenario was generic, leaving the concrete quizlet-removal behavior without a testable acceptance case. | Added a concrete "Quizlet is removed from the offered source types" scenario (submitting `type: 'quizlet'` → 400, and absent from UI options). | specs/content-ingestion/spec.md § ADDED Requirements |
| SUGGESTION | design.md / tasks.md | Podcast feed-parser dependency was unnamed ("add an RSS/feed parser dependency"), an implementation-critical unknown. | Named `rss-parser` and specified the transcript-vs-show-notes field precedence (`podcast:transcript` → `itunes:summary`/`description`). | design.md § Risks; tasks.md 1.2 |
| SUGGESTION | proposal.md | Per-type build-vs-hide was framed as a reviewer question. | Decisions confirmed by the user (build podcast + anki, hide quizlet) and the conditional language removed across proposal/design/tasks. | proposal.md, design.md § Decision 1, tasks.md § 3 |

## No Remaining Implementation-Blocking Gaps

Confirmed. Reviewed the four artifacts as one contract:

- **Capability coverage** — after the fix, proposal names exactly one modified capability (`content-ingestion`) and its delta spec exists. The MODIFIED "Per-source-type fetch strategies" block copies the full original requirement (header text matches exactly) and preserves its three original scenarios (web, youtube, pdf) while adding podcast, anki, and the "no build-time no-op" scenarios — no detail lost at archive time.
- **Scenario coverage** — every scenario has tasks: podcast RSS → 0.1 + 1.1 + 5.1; anki shared deck → 2.1; "offered type never a build-time no-op" → 0.2 (registry test); "unsupported type not selectable/registrable" + "quizlet removed" → 3.1; "a fetch yielding nothing does not read as success" → 4.1.
- **Design completeness** — the three per-type decisions are settled; the shared-tuple narrowing is flagged BREAKING with the UI/validation/registry `Record` kept atomic (design § Decision 2); existing-`quizlet`-row data handling is covered (task 3.3 + design § Decision 2); the new dependency is named; no new API endpoint or pipeline change.
- **Test boundaries** — design names the faked HTTP client / scrapper for strategy units, the registry test, and the content-pipeline acceptance harness for the podcast end-to-end + metric; tasks introduce no unnamed mock boundary; no live network in CI.
- **Task alignment** — outside-in order holds (acceptance RED → per-strategy RED/GREEN/REFACTOR → quizlet removal → no-silent-success safety net → acceptance GREEN); `stub-strategies.spec.ts` cleanup is explicitly tasked (5.3); worker boot smoke after DI changes is tasked (5.4).
- **Contradictions** — none: proposal, spec, design, and tasks agree on build-podcast+anki / hide-quizlet, the `rss-parser` dependency, the BREAKING tuple change, and the migration-only-if-rows-exist stance.

## Deferred Non-Blocking Notes

- **Existing `quizlet` `ContentSource` rows** — RESOLVED: the target database is confirmed empty (no `ContentSource` rows), so removing `quizlet` cannot orphan any data. Task 3.3 is marked N/A (no migration); proposal Impact and design § Decision 2 updated to state no migration is required.
