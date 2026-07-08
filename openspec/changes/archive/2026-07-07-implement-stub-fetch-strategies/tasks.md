## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 In the content-pipeline acceptance harness, add a `podcast` source pointing at a local RSS fixture (served by the existing stub HTTP server) and write a failing acceptance test: processing it persists content chunks and increments the `type="podcast"` ingestion metric
- [x] 0.2 Write a failing registry test: every type in the offered `contentSourceTypes` resolves to a strategy that is not the empty-returning stub
- [x] 0.3 Confirm both fail for the right reason against the current stubs (podcast ingests nothing; registry still maps to stubs)

## 1. Podcast fetch strategy

- [x] 1.1 RED: unit test `PodcastFetchStrategy` with a captured RSS fixture — parses the feed, yields ≥1 `FetchedContent` per episode (transcript when present, else description/show-notes), each with episode-attributing `url`; returns `[]` (not throw) on an unreachable feed
- [x] 1.2 GREEN: implement real `PodcastFetchStrategy` using `rss-parser` (read `podcast:transcript` where advertised, fall back to `itunes:summary`/`description`); respect fetch-etiquette (User-Agent, per-domain throttle)
- [x] 1.3 REFACTOR: isolate feed parsing from HTTP; clean up types

## 2. Anki fetch strategy

- [x] 2.1 RED: unit test `AnkiFetchStrategy` with an AnkiWeb shared-deck HTML fixture (faked scrapper) — produces `FetchedContent` with card text; no auth/paywall bypass; returns `[]` on scrapper failure
- [x] 2.2 GREEN: implement real `AnkiFetchStrategy` over the existing scrapper client (reuse `SCRAPPER_CLIENT`); parse public deck text
- [x] 2.3 REFACTOR: isolate the AnkiWeb parsing so a markup change fails that source loudly rather than emitting garbage

## 3. Quizlet — hide (remove from offered types)

- [x] 3.1 RED: web/validation test asserting `quizlet` is NOT among the offered source-type options and that source registration rejects `type: 'quizlet'` as invalid
- [x] 3.2 GREEN: remove `quizlet` from `contentSourceTypes` in `@readion/shared`; delete `quizlet.strategy.ts`, drop it from `StrategyRegistry` and `stub-strategies.spec.ts`; fix the `Record<ContentSourceType, FetchStrategy>` shape
- [x] 3.3 N/A: no data migration needed — the database is empty (no `ContentSource` rows exist), so no `quizlet` rows can be orphaned by removing the type
- [x] 3.4 REFACTOR: verify UI dropdowns (`AdminSources.vue`, `CertSetupSourcesStep.vue`) and DB enum expectations stay in sync via the type-driven tests

## 4. No-silent-success safety net

- [x] 4.1 RED: integration test — an offered-type source whose fetch fails/returns nothing due to error is marked with a non-success (error) status, not a clean completion of zero chunks
- [x] 4.2 GREEN: surface fetch failure onto the source status / error metric in the ingestion-completion handling
- [x] 4.3 REFACTOR: align status/metric naming with existing conventions

## 5. Acceptance Test — Outer Loop GREEN

- [x] 5.1 Podcast acceptance test passes end-to-end (chunks persisted, `type="podcast"` metric increments)
- [x] 5.2 Registry test passes: no offered type maps to an empty-returning stub
- [x] 5.3 `stub-strategies.spec.ts` no longer describes offered types as returning `[]` (updated or deleted)
- [x] 5.4 Smoke: boot the worker and confirm no startup/DI error after registry changes
