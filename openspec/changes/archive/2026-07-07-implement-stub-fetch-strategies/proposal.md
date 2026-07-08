## Why

The `content-ingestion` spec's "Per-source-type fetch strategies" requirement mandates fetch strategies for every source type, including "Anki/Quizlet via their public API or scrapper; podcasts via RSS feed parsing plus transcript fetch". Three of those — `AnkiFetchStrategy`, `QuizletFetchStrategy`, `PodcastFetchStrategy` — are stubs whose `fetch()` returns `[]` for any URL. Yet all eight source types (including `anki`, `quizlet`, `podcast`) are selectable in the admin "add source" UI (`AdminSources.vue`, `CertSetupSourcesStep.vue`). So an admin can register a podcast/Anki/Quizlet source, the pipeline runs, and **nothing is ever ingested** — silently, with no error and no chunks. This is a spec/implementation gap that was mistaken for "done".

## What Changes

Decided per-type handling:

- **Podcast — implement.** RSS parsing + episode enclosure/transcript fetch is well-trodden and low-risk. Replace the stub with a real `PodcastFetchStrategy` (parse feed, fetch episode transcripts where available, fall back to show-notes/description text), producing `FetchedContent[]`.
- **Anki — implement (scrapper/public deck pages).** Fetch shared-deck text via AnkiWeb's public pages through the existing scrapper. Replace the stub with a real strategy.
- **Quizlet — hide, do not build.** Quizlet actively blocks scraping and has no public content API for sets; a scraper is fragile and ToS-hostile. `quizlet` is **removed from `contentSourceTypes`** (and therefore the UI and registration validation) rather than shipping a strategy that will silently break.

- Regardless of build-vs-hide, **close the silent-no-op**: a registered source of a type with no working strategy MUST NOT complete "successfully" having ingested nothing. Either the type is not offerable (hidden), or an unimplemented/failed fetch surfaces as a visible non-success (error status on the source) so it never masquerades as done.
- Each newly implemented strategy flows through the existing pipeline unchanged (clean → chunk → domain-tag → embed → upsert → reconcile) and increments the per-type ingestion metric.

**Out of scope:**
- The already-working strategies (`web`, `pdf`, `youtube`, `reddit`, `github`) — unchanged.
- The chunking/embedding/dedup pipeline itself — unchanged; these strategies only produce `FetchedContent[]`.

## Capabilities

### New Capabilities
<!-- None — this fulfills existing content-ingestion requirements. -->

### Modified Capabilities
- `content-ingestion`: Makes the "Per-source-type fetch strategies" requirement concrete and testable for `podcast` and `anki` (replacing stubs with real behavior), narrows the offered source-type set to drop `quizlet`, and adds a requirement that a source type with no working fetch strategy is never offered/never reports silent success.

`content-source-admin` is NOT listed as a modified capability: its "register a content source" requirement is parameterized by "one of the `contentSourceTypes` enum", so narrowing that shared tuple makes `quizlet` an invalid type without changing any `content-source-admin` requirement text. The observable "`quizlet` is now rejected at registration" behavior is captured by the content-ingestion delta's "Unsupported type is not selectable or registrable" scenario.

## Impact

- **`apps/worker`** (`src/content-pipeline/strategies/`): real implementations for `podcast.strategy.ts` and `anki.strategy.ts`; `quizlet.strategy.ts` removed (or implemented) per the decision; `strategy.registry.ts` and `stub-strategies.spec.ts` updated accordingly.
- **`packages/shared`** (`src/content-pipeline/`): `contentSourceTypes` tuple narrows if `quizlet` is dropped — a **BREAKING** change to that exported constant consumed by `AdminSources.vue`, `CertSetupSourcesStep.vue`, and source validation. Any existing `quizlet` `ContentSource` rows would need a data decision (disable/delete).
- **New dependencies** likely: an RSS/feed parser for podcasts; Anki reuses the scrapper (no new dep) or a deck-export parser.
- **Depends on** (archived/complete): `content-ingestion`, `content-source-admin`.
- **No new API endpoint and no DB migration** — the database is empty pre-deployment, so removing `quizlet` cannot orphan any existing `ContentSource` rows.
