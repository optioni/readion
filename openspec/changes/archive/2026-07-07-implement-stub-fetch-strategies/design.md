## Context

`StrategyRegistry` maps each `ContentSourceType` to a `FetchStrategy`. Five are real (`web`, `pdf`, `youtube`, `reddit`, `github`); three are stubs returning `[]` (`podcast`, `anki`, `quizlet`). The admin UIs iterate `contentSourceTypes` to build the type dropdown, so all eight are registrable. A stubbed type therefore produces a source that ingests nothing while the run reports normally.

The `FetchStrategy` contract is narrow — `fetch(url) => Promise<FetchedContent[]>` — and everything downstream (chunk → tag → embed → upsert → reconcile → metric) is type-agnostic. So each strategy is an isolated unit: implementing one does not touch the pipeline.

## Goals / Non-Goals

**Goals**
- No offered source type silently ingests nothing.
- Real ingestion for the types worth supporting.
- Keep each strategy independently testable, faked at the network boundary.

**Non-Goals**
- Changing the chunking/embedding/dedup pipeline.
- Building fragile, ToS-hostile scrapers just to fill the enum.

## Decisions

### Decision 1: Per-type build-vs-hide (decided)

| Type | Decision | Rationale |
|------|----------|-----------|
| `podcast` | **Build** | RSS is a stable, public, well-supported format; transcripts increasingly available, description as fallback. Low risk, high value. |
| `anki` | **Build** (via scrapper) | AnkiWeb shared-deck pages are public and scrapper-fetchable; reuses existing infra, no new dependency, no auth bypass. |
| `quizlet` | **Hide / remove** | Quizlet blocks scraping, has no public set-content API, and its ToS forbids it. A strategy here would be brittle and legally dubious — shipping it is worse than not offering it. Removed from the offered type set. |

### Decision 2: Removing `quizlet` is a breaking change to a shared constant

`contentSourceTypes` is exported from `@readion/shared` and consumed by the DB enum expectations, source validation, and two Vue components. Narrowing it:
- drops `quizlet` from the UI dropdown and validation automatically (both iterate the tuple),
- required deciding what happens to any **existing `quizlet` `ContentSource` rows** — confirmed none exist (the database is empty pre-deployment), so no data migration is needed.

Removal is the chosen path (cleaner than keeping a loud-failing placeholder). The change stays atomic so the shared tuple, UI dropdowns, registration validation, and the registry `Record` shape all move together.

### Decision 3: "No silent success" enforced at the source-status layer

The pipeline already tracks source state and per-type metrics. The added requirement is satisfied by: (a) not offering unsupported types, and (b) for an offered type whose fetch throws or yields nothing due to failure, marking the source with an error status instead of a clean completion. This is the safety net that stops a future stub from regressing to today's silent behavior.

## Risks / Trade-offs

- **Feed parser choice:** use `rss-parser` (widely used, zero-config, handles RSS + Atom, supports custom fields for the `podcast:transcript` namespace). It is the only new runtime dependency; Anki reuses the scrapper.
- **Podcast transcripts are inconsistent:** many feeds lack transcripts. Read the `podcast:transcript` element (with a `<link>`/`enclosure` transcript when advertised) and fall back to `itunes:summary`/`description` show-notes. This keeps ingestion useful without over-promising; chunk volume will vary.
- **Anki scraping brittleness:** AnkiWeb markup can change; isolate parsing so a markup shift fails that source loudly (per the new requirement) rather than corrupting chunks.
- **Breaking the shared tuple:** touches web + validation; covered by the existing type-driven tests. Keep the change atomic so UI, validation, and registry stay in sync.

## Test Boundaries

- **Unit per strategy:** feed a captured RSS fixture / AnkiWeb HTML fixture (no live network — fake the HTTP client / scrapper) → assert `FetchedContent[]` shape, attribution `url`, and empty-on-failure behavior.
- **Registry:** every type in the offered `contentSourceTypes` resolves to a non-stub strategy.
- **Integration (content-pipeline acceptance harness):** a `podcast` source processed end-to-end persists chunks and increments the `type="podcast"` ingestion metric; an offered-type fetch failure marks the source non-successful.
- **If quizlet removed:** a web-component/validation test asserts `quizlet` is absent from the offered options and rejected by registration.
