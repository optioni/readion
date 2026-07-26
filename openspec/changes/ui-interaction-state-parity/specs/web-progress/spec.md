## ADDED Requirements

### Requirement: Progress data has explicit loading, empty, failure, and refresh states

The Progress page SHALL render structural skeletons for all HTTP-backed summary, chart, domain, and history regions during initial loading. It MUST NOT render zero metrics, empty charts, or history empty states until the corresponding requests succeed. A failed region SHALL show a local error with Retry. Successful data SHALL remain visible during a background refresh.

#### Scenario: Progress initial load does not render synthetic zeroes

- **WHEN** Playwright delays the progress summary and trend requests
- **THEN** the affected stat and chart regions expose `aria-busy="true"` and render skeletons
- **AND** no `0`, empty-chart, or no-history result is presented as loaded data

#### Scenario: Trend failure retries without clearing domain scores

- **WHEN** domain scores succeed and the first trend request fails
- **THEN** the trend region renders an error and Retry while domain scores remain visible
- **AND** activating Retry sends exactly one additional trend request

### Requirement: Quick-review entry distinguishes unresolved, empty, and failure

The quick-review entry page SHALL not initialize its due count to a rendered success value. While the due-count request is pending it SHALL show the review loading presentation and expose `aria-busy="true"`. The caught-up state SHALL render only after a successful response explicitly reports zero due items. A failed request SHALL show an error and Retry.

#### Scenario: Delayed due count does not flash caught up

- **WHEN** Playwright delays the quick-review due-count response
- **THEN** the review loading presentation is visible
- **AND** "You're all caught up" and the start-review action are both absent

#### Scenario: Failed due count is retryable

- **WHEN** the first due-count request fails and Retry succeeds with `dueCount: 5`
- **THEN** the page first shows an error and Retry, never the caught-up state
- **AND** after Retry it shows the five-item queue entry and its start action

## MODIFIED Requirements

### Requirement: Readiness-over-time and accuracy trend

The page SHALL show a "Readiness over time" chart for the last six months with projection, derived from readiness history snapshots returned by the progress endpoint (including projection logic per SPEC). The chart SHALL match `openspec/design/Progress.html`: compact plotted points connected by a line, a translucent area fill beneath it, human-readable date labels such as "Apr 3", and a dashed projected segment/point when a projected value exists. Labels MUST use bounded chart typography, remain inside the chart container, and remain legible without clipping at 375px and 1440px viewports.

Below it, the page SHALL show "Recent accuracy" as a compact vertical bar trend using the most recent `accuracyTrend` entries. Matching the design, only the final bar SHALL carry a visible percentage label above it, and every bar SHALL have a compact date caption below it. The chart MUST remain within its content column without creating document-level horizontal overflow.

#### Scenario: Readiness chart shows date labels, area fill, and projection

- **WHEN** progress returns historical snapshots and a projected readiness value
- **THEN** the chart renders connected points with a translucent area fill and human-readable date labels (e.g. "Apr 3"), plus a dashed projected segment and projected point

#### Scenario: Accuracy bars label only the last bar and caption each

- **WHEN** progress returns six accuracy-trend points
- **THEN** six bars render with compact date captions, but only the final bar shows a visible percentage label above it

#### Scenario: Chart labels remain bounded at phone and desktop widths

- **WHEN** Playwright renders the progress charts with six long localized date labels at 375px and 1440px viewports
- **THEN** every visible chart label's bounding box is contained by its chart region
- **AND** no label uses a computed font size larger than the surrounding chart caption style
- **AND** the document has no horizontal overflow
