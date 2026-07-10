## Why

The parity diff compared the five study-flow surfaces — Study session, Session start, Session summary, Mock exam, 5-minute review — against their artboards (37 findings across `web-session-view`, `web-mock-exam`, and `web-progress`'s five-minute-review requirements). Many are genuine presentational fixes; several reconcile against speced behavior, and a large cluster on Session summary is **blocked on data the shared DTOs don't carry** and is descoped to a separate contract change. See `design.md` for the full table.

**Study session (`web-session-view`) — fixes:** render the session within the **app shell** (sidebar, Sessions active) per the design + manifest, not the bare `minimal` layout; pass the ReadingBlock **domain label**; interpolate the **topic-specific confidence prompt**; add the collapsed agent-rail icon + "Ask AI" label, the agent header online dot, per-message avatar, and fix the "Q3 of 12" spacing. **Reaffirmed:** the one-item-at-a-time model (the design's paired reading+quiz is a larger interaction redesign, and the spec pre-generates and resumes items by index) and the **confidence-before-submit** gating (the spec makes confidence required; rating before seeing the result is deliberate and avoids hindsight bias) — so the ReadingBlock "Continue" affordance also stays.

> **Scope note:** the ReadingBlock domain label and the topic-specific confidence prompt were initially scoped as no-API-change presentational fixes, but turned out to need data the client cannot see — `SessionItem` (the persisted row) carries no domain column; `session-planner.ts` resolves a per-item domain (`itemPlan.domain`, round-robin across target domains, including in `focusArea: 'auto'` sessions) but the API discarded it before the response reached the client, and the currently-archived `web-session-view` spec already documented this exact gap as deferred. Per an explicit decision, this change **includes that small API/DB addition** rather than descoping the two items: a `SessionItem.domain` column + migration, `itemPlan.domain` persisted at generation time (both the API's synchronous item generation and the worker's async fill-queue generation), and `domain` added to `SessionItemResponse`/`SessionItemResponseDto`. This is the one exception to "No API/DB changes" below — see `design.md` and `tasks.md` for the itemized backend tasks.

**Session start (`web-session-view`) — fixes:** add the **cert identity pill** (code + name) above the start card (the page must surface the cert code/name for the enrollment); humanize the defaults-summary values via the shared label map (raw enum slugs currently); add the minimal-header brand mark.

**Session summary (`web-session-view`) — presentational fixes only:** the readiness-change bar gradient fill + directional arrow; relative "Today at 3:42 PM" timestamp right-aligned; the standard content width; the Drill-my-misses leading icon. **Descoped (needs data):** before/after weak-area values, per-question highlight metadata (chosen/correct/time), domains-covered progress bar + correct/total counts, the next-focus reasoning text, and the pre-click miss-count preview all require enriching the `packages/shared` session-summary DTOs (and the API/worker that populate them) — a separate contract change, not web fidelity. The **streak metric** stays the app's day-streak (speced, real data); the design's "sessions in a row" is a different metric.

**Mock exam (`web-mock-exam`) — fixes:** collapse the **double header** (the `minimal` layout header stacks above `ExamHeader`) to the design's single full-screen exam bar; add **per-question flag state** reflected in the nav grid with a "Flagged" square + legend (client-side, keyed by index); add the header logo mark, the flag/timer icons, and show only the cert **code** in the active header.

**5-minute review (`web-progress`) — fixes:** add the queue hero icon; render the queue as a centered full-bleed hero (not a bordered card); add the live **countdown timer** (currently static, never ticks); restore the "Scheduled by spaced repetition" caption; plain due-count headline; drop the extra "By domain" label. **Reaffirmed:** the "Prefer quiz instead?" mode toggle — the quiz+confidence loop is a speced `web-progress` requirement; the artboard just depicts the flashcard loop.

## What Changes

- **web-session-view** — session runs in the app shell; ReadingBlock domain label; topic-specific confidence prompt; collapsed agent-rail affordances, online dot, per-message avatar, Q-spacing. Session start: cert identity pill, humanized defaults, brand mark. Session summary: readiness-bar gradient/arrow, relative timestamp, standard width, drill-CTA icon. (Item model, confidence-before-submit, and the summary data-carried fields are reaffirmed/descoped.)
- **web-mock-exam** — single full-screen header; per-question flag state + nav "Flagged" square/legend; header logo mark; flag/timer icons; code-only active header.
- **web-progress** — five-minute-review queue hero icon + centered layout + live countdown + SRS caption + plain headline; "By domain" label removed. (Quiz-mode toggle reaffirmed.)

## Capabilities

### Modified Capabilities

- `web-session-view`: app-shell session layout, session-start cert pill + humanized defaults, and presentational session-summary polish (item model + confidence flow reaffirmed).
- `web-mock-exam`: single exam header, per-question flagging in the nav grid, and header brand/icon polish.
- `web-progress`: five-minute-review hero layout, queue icon, live countdown, and copy polish (quiz-mode toggle reaffirmed).

## Impact

- **apps/web** — mostly presentational + two layout changes:
  - Session: `pages/sessions/[id]/index.vue` (app-shell layout, domain prop from the new `SessionItemResponse.domain`), `SessionLayout.vue` (collapsed rail, online dot), `ConfidenceRating.vue` (topic copy), `ReadingBlock.vue`, `AgentBubble.vue`, `QuizCard.vue` (Q-spacing, topic prop for the confidence prompt).
  - Session start: `pages/user-certifications/[id]/session/start.vue` (fetch cert code/name), `SessionStartQuickStart.vue` (pill, humanized defaults), `minimal.vue` (brand mark).
  - Session summary: `SessionSummaryBody.vue` (readiness bar, timestamp, drill icon), `pages/sessions/[id]/summary.vue` (width).
  - Mock exam: `pages/mock-exams/[id]/index.vue` + a bare layout (single header), `ExamHeader.vue` (logo/flag/timer/code), `MockExamNavPanel.vue` + `examNavSquares.ts` (flagged state/legend).
  - Review: `review.vue` (countdown, layout), `ReviewQueueEntry.vue` (icon, headline, caption, label), `ReviewHeader.vue` (timer props).
- **Reused shared label map** for humanized enum labels (from `fix-web-settings-agent-parity`).
- **API/DB change (scoped exception):** `packages/db` — `SessionItem.domain` column + migration; `packages/shared` — `domain` added to `SessionItemResponse`; `apps/api` — `SessionItemResponseDto` + `mapItemToDto` + the synchronous item-generation call sites in `sessions.service.ts` persist `itemPlan.domain`; `apps/worker` — `session-item-generator.service.ts`'s async fill-queue call sites persist it too. `yarn codegen` regenerates the web Orval client. The session-summary data-carried fields remain **descoped to a separate contract change** (`packages/shared` session-summary DTOs + `apps/api`/`apps/worker`) — unlike the domain field, no schema decision for that cluster is made here.
- **Tests** — Playwright e2e per surface + component unit tests; a NestJS integration test (domain persisted + surfaced on `GET /api/v1/sessions/:id`) and unit coverage for the planner→entity domain mapping in both the API and worker generation paths.
- **Descoped/reaffirmed:** session-summary before/after + per-question metadata + domain counts + next-focus reason + miss-count preview (needs DTO enrichment); the paired reading+quiz interaction; confidence-before-submit; the summary day-streak metric; the review quiz-mode toggle.
