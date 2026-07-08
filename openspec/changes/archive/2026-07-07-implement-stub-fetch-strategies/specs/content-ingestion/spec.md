## MODIFIED Requirements

### Requirement: Per-source-type fetch strategies

The worker SHALL fetch raw content using the strategy appropriate to a source's `type`: official docs/web pages and PDFs via the scrapper sidecar (PDFs falling back to `pdf-parse`); YouTube via the `youtube-transcript` package; Reddit via the public JSON API; GitHub community guides via the GitHub API for discovery plus raw Markdown fetch; Anki via its public shared-deck pages through the scrapper; podcasts via RSS feed parsing plus per-episode transcript/description fetch. Every source type that the system offers for registration SHALL have a fetch strategy that performs a real fetch — no offered type may be backed by a strategy that unconditionally returns no content. A strategy MAY legitimately return an empty result for a specific URL (nothing found, disallowed by robots, transient upstream failure), but a source type MUST NOT be wired to a strategy that returns empty for all inputs by construction.

#### Scenario: Web source fetched via scrapper

- **WHEN** a `web`-type source is processed
- **THEN** the worker calls the scrapper sidecar over HTTP and receives cleaned text/markdown
- **THEN** no browser/Playwright dependency is loaded inside the worker process

#### Scenario: YouTube transcript segments capture timestamps

- **WHEN** a `youtube`-type source is processed
- **THEN** each transcript segment's start offset is captured and stored in the chunk's `metadata` as `startOffsetSeconds`

#### Scenario: PDF falls back to pdf-parse

- **WHEN** a `pdf`-type source is processed and the scrapper cannot return PDF text
- **THEN** the worker extracts text via `pdf-parse` and continues the pipeline

#### Scenario: Podcast RSS feed yields per-episode content

- **WHEN** a `podcast`-type source pointing at an RSS feed with two episodes is processed
- **THEN** the strategy parses the feed and produces at least one `FetchedContent` entry per episode that carries text (transcript when available, otherwise the episode description/show notes)
- **AND** each entry's `url` attributes the content to its episode/source

#### Scenario: Anki shared deck fetched via scrapper

- **WHEN** an `anki`-type source pointing at a public AnkiWeb shared-deck page is processed
- **THEN** the strategy fetches the deck's public text through the scrapper and produces `FetchedContent` with the card text
- **AND** no authentication or paywall bypass is attempted

#### Scenario: An offered source type is never a build-time no-op

- **WHEN** a source is registered for any type present in the offered source-type set and is processed against valid, reachable content
- **THEN** the strategy is capable of returning non-empty `FetchedContent` for that content
- **AND** no offered type is backed by a strategy that returns `[]` for every possible input

## ADDED Requirements

### Requirement: A source type with no working fetch strategy is not offered and never reports silent success

The set of source types offered for registration (the shared `contentSourceTypes`) SHALL contain only types with a working fetch strategy. If a source type is not (yet) supported, it SHALL NOT be selectable in the admin UI nor accepted by source registration validation. Should a registered source ever be processed by a strategy that cannot fetch (unsupported or hard-failing), the pipeline SHALL surface the outcome as a visible non-success on that source (e.g. an error/disabled status), and SHALL NOT mark the source as successfully ingested with zero chunks — a completed run that silently produced nothing is not permitted for an unsupported type.

#### Scenario: Unsupported type is not selectable or registrable

- **WHEN** the admin "add source" UI renders the source-type options, and the source-registration endpoint validates a submitted `type`
- **THEN** only types with a working fetch strategy are offered
- **AND** submitting a `type` that is not in the offered set is rejected as an invalid source type

#### Scenario: Quizlet is removed from the offered source types

- **WHEN** `quizlet` has been dropped from `contentSourceTypes` and an admin `POST`s a content source with `type: 'quizlet'`
- **THEN** the registration is rejected as an invalid source type (`400` RFC 7807 Problem Details) and no source is created
- **AND** `quizlet` does not appear among the admin "add source" type options

#### Scenario: A fetch that yields nothing for an offered type does not read as success

- **WHEN** a source of an offered type is processed and the fetch returns no content (upstream error or nothing found)
- **THEN** the source is not recorded as a successful ingestion of zero chunks
- **AND** the failure is visible on the source's status and/or the pipeline's error metrics
