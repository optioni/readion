# Parity — 5-minute review

0 active findings — 0 high · 0 medium · 0 low

## Reconciliation — ui-interaction-state-parity

This report keeps 7 snapshot observations as evidence. Counts and the parity index include only the 0 entries still marked `open`; `resolved` and `superseded` entries below are historical.

- Static Claude frames remain the visual hierarchy reference. Live loading/content/empty/error+Retry/background-refresh states, operation-specific busy labels and duplicate guards, semantic dark/light modes, accessibility/focus behavior, and tested 375px containment are intentional product contracts even when no static frame depicts them.
- Busy identity belongs only to the initiating action; adjacent disabled actions do not display its spinner or progressive label. Dimensions remain stable and reduced-motion preferences are honored.
- Resolved snapshot findings: “Queue icon (document/quiz glyph in accent square)”; “Review countdown timer”; “Queue-entry vertical centering / full-bleed hero layout”; “'Scheduled by spaced repetition · ~5 minutes' caption”; “Due-count headline treatment”; “'By domain' section label”.
- Superseded by product contract: “Self-grade vs quiz review-mode toggle”.

- **[high · resolved] Queue icon (document/quiz glyph in accent square)** — missing/composition
  - design: A 52x52 rounded-xl accent-tinted box with a document/quiz outline SVG icon sits above the due-count headline, anchoring the hero composition (QueueEntry, openspec/design/QuickReview.html lines 198-204).
  - app: absent — ReviewQueueEntry renders only a circular avatar containing the due-count number; no icon/glyph element exists anywhere in the component.
  - evidence: `design: openspec/design/QuickReview.html:198-204 (QueueEntry icon block); app: apps/web/app/components/ReviewQueueEntry.vue:48-66 (no svg/icon present)`
- **[high · resolved] Review countdown timer** — divergent/behavioral
  - design: ReviewHeader's timer is a live countdown starting at 5:00 that decrements across the session and turns urgent/red near expiry (timeStr varies 5:00→4:12→3:58→3:41 across states; timeUrgent flag drives red styling) — the artboard subtitle frames this as a timed '~5 minute' loop.
  - app: The page never passes timeStr/timeUrgent props to ReviewHeader, so the component's defaults ('5:00', timeUrgent=false) are shown statically forever — there is no ticking timer or urgency state anywhere in review.vue.
  - evidence: `design: openspec/design/QuickReview.html:196,242,265,305 (varying timeStr/timeUrgent per state); app: apps/web/app/pages/user-certifications/[id]/review.vue:202-206 (ReviewHeader invoked with no timeStr/timeUrgent) and apps/web/app/components/ReviewHeader.vue:5-17 (static defaults '5:00'/false)`
- **[medium · resolved] Queue-entry vertical centering / full-bleed hero layout** — divergent/layout
  - design: QueueEntry fills the entire area below the header with `flex:1, alignItems:center, justifyContent:center` — icon, headline, chips, CTAs and caveat are vertically and horizontally centered as one open hero block with no card border (QuickReview.html:194-236).
  - app: The content sits in normal top-aligned document flow inside a bordered/backgrounded card (`rounded-xl border ... bg-readion-background-surface`) within a `max-w-2xl` column — no vertical centering, and the card chrome itself isn't in the design.
  - evidence: `design: openspec/design/QuickReview.html:195-197 (flex:1 center/center, no border); app: apps/web/app/pages/user-certifications/[id]/review.vue:208-211 (plain flow container) and apps/web/app/components/ReviewQueueEntry.vue:48-51 (bordered card wrapper)`
- **[medium · resolved] 'Scheduled by spaced repetition · ~5 minutes' caption** — simplified/composition
  - design: Subtext under the headline reads 'Scheduled by spaced repetition · ~5 minutes', explaining the SRS provenance of the queue (QuickReview.html:209).
  - app: Only '~5 minutes' is rendered; the 'Scheduled by spaced repetition' clause is dropped entirely.
  - evidence: `design: openspec/design/QuickReview.html:209; app: apps/web/app/components/ReviewQueueEntry.vue:64`
- **[medium · superseded] Self-grade vs quiz review-mode toggle** — divergent/behavioral
  - design: The artboard's description states a single SRS flashcard loop ('Front shows question, reveal shows answer, SRS rating schedules next repetition') triggered by one 'Start review' CTA with no alternate mode selection on the queue screen (QuickReview.html:373-374, 224-230).
  - app: Below the queue card the app renders an additional 'Prefer quiz instead?' toggle letting the user switch between a self-grade flow and an entirely different quiz+confidence run loop before starting — a bifurcated entry flow not present in the design.
  - evidence: `design: openspec/design/QuickReview.html:194-236 (single Start review CTA only); app: apps/web/app/pages/user-certifications/[id]/review.vue:220-254 (review-mode-toggle block)`
- **[low · resolved] Due-count headline treatment** — simplified/composition
  - design: The count is a standalone 22px bold number sitting above the 'items due for review' line, separate from any icon/badge (QuickReview.html:207).
  - app: The same number is instead embedded inside a 14x14 circular primary-tinted avatar, merging the count with an icon-like badge rather than a plain headline figure.
  - evidence: `design: openspec/design/QuickReview.html:206-210; app: apps/web/app/components/ReviewQueueEntry.vue:53-59`
- **[low · resolved] 'By domain' section label** — divergent/composition
  - design: Domain breakdown chips are shown directly with no preceding section label (QuickReview.html:213-220).
  - app: An uppercase 'By domain' label is inserted above the chip row, which the design does not include.
  - evidence: `design: openspec/design/QuickReview.html:213-220; app: apps/web/app/components/ReviewQueueEntry.vue:68-72`
