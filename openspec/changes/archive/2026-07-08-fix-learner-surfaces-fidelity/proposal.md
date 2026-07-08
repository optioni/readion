## Why

The learner "home" surfaces — the dashboard, the certification-detail page, and the per-enrollment progress page — are the first thing every user sees after signing in, yet a UI walkthrough against the `openspec/design/*.html` mockups (the UI source of truth) found user-visible copy bugs and material design-fidelity gaps on all three:

- **Broken pluralization** on two independent code paths that render the same phrase family. The cert-detail trajectory line hardcodes the plural word — `apps/web/app/composables/certStatRow.ts:29` emits `exam-ready in ~1 weeks` instead of `~1 week` — and the progress activity row hardcodes the streak unit — `apps/web/app/pages/user-certifications/[id]/progress.vue:85` passes `unit="days"`, rendering `CURRENT STREAK 1 days` instead of `1 day`. A third path, `apps/web/app/composables/paceFormatter.ts:18`, already pluralizes correctly; the phrasing must be consolidated on the singular-aware formatter so this class of bug cannot recur.
- **Misleading accuracy on zero data** (cert-detail): the fourth Overview stat renders a red `0%` accuracy beside `QUESTIONS 0` when no questions have been answered, presenting a fabricated failing accuracy where there is simply no data.
- **Design deviations** across all three surfaces: the dashboard is missing the shared PageHeader, inverts the hero card hierarchy, renders weak areas as a bordered text list instead of DomainBadge chips, and mis-places quick-start actions; the cert-detail page is constrained to a narrow centred column with the wrong stat set, no full-bleed cert header bar, no per-domain deltas, and a plain (not rationale-bearing) suggested-focus box, plus mis-cased tab labels; the progress page splits readiness and accuracy into two side-by-side cards (design composes them in one surface with an 80% target line), renders slider-looking flat lines for low-data states, and its session-history table is missing its column-header row and uses locale-formatted dates.

These are the highest-traffic authenticated screens, so the copy bugs and the "0%" accuracy read as product defects to every user, and the layout gaps make the app diverge visibly from its own approved design.

## What Changes

- **Consolidate week/day pluralization on the singular-aware formatter.** The `~N week(s)` trajectory phrasing (cert-detail) and the `N day(s)` streak unit (progress) MUST render the correct singular/plural form for a count of 1, reusing the same singular-aware formatting rule already implemented in `paceFormatter.ts` rather than hardcoding the plural word/unit.
- **Suppress accuracy when no questions have been answered** (cert-detail): when `questionsAnswered === 0`, the Overview fourth stat MUST NOT render a `0%` accuracy figure; it shows a neutral placeholder (no accuracy, or an em dash) instead.
- **Dashboard design fidelity:** add the shared PageHeader (eyebrow + "Your certifications" + active-count indicator); correct the hero card so the certification NAME is the primary heading (with a "NEEDS ATTENTION" eyebrow) rather than the readiness percentage; render weak areas as inline DomainBadge chips; lay out recent sessions as a compact when/duration/delta row; move the Mock exam / Start session actions into the card's bottom row; render the review quick-start as a count + "reviews due" + pill; add the add-cert subtitle; make the diagnostic/welcome banner an accent-tinted callout.
- **Cert-detail design fidelity:** use the full content width with a full-bleed cert header bar (breadcrumb + Mock exam / Start session actions); correct the stats set to Readiness / Sessions / Questions / Avg accuracy; add a per-domain delta to each domain row; render "Suggested next focus" as an accent-tinted box carrying a rationale; correct tab casing to "Exam history".
- **Progress design fidelity:** compose readiness and accuracy into one surface card with an 80% target line; give the readiness and accuracy figures friendlier low-data empty states instead of slider-looking flat lines; add the session-history column-header row (Date / Type / Duration / Questions / Accuracy / Readiness) and format dates in the design's friendly form (e.g. "Today, Jun 23") rather than a raw locale string.

This change is UI-only. It defines corrected behaviour in three capability specs; no backend contract or field changes.

## Capabilities

### Modified Capabilities

- `web-dashboard`: shared PageHeader, corrected hero hierarchy with a "NEEDS ATTENTION" eyebrow, DomainBadge weak-area chips, compact recent-sessions layout, in-card action placement, the review-due row, and the accent-tinted welcome/diagnostic banner.
- `web-cert-detail`: singular-aware `~N week(s)` trajectory phrasing, accuracy suppression when `questionsAnswered === 0`, full-width layout with a cert header bar, the Readiness / Sessions / Questions / Avg accuracy stat set, per-domain deltas, a rationale-bearing suggested-focus box, and "Exam history" tab casing.
- `web-progress`: singular-aware `N day(s)` streak unit, a single readiness+accuracy surface card with an 80% target line, friendlier low-data empty states, and the session-history column-header row with friendly date formatting.

## Impact

- **`apps/web` (UI only):**
  - `apps/web/app/composables/certStatRow.ts` — trajectory label pluralization (currently `:29`).
  - `apps/web/app/pages/user-certifications/[id]/progress.vue` — streak unit pluralization (currently `:85`) and the session-history table header row + date formatting.
  - `apps/web/app/composables/paceFormatter.ts` — the singular-aware formatting rule reused by the above (the consolidation target).
  - Two net-new shared components — `PageHeader` (eyebrow + h1 + active-count indicator) and `DomainBadge` (status dot + label + %) — built once and reused (neither exists today).
  - Dashboard components (PageHeader adoption, hero card, weak-area DomainBadge chips, recent-sessions row, in-card actions, review row, welcome banner).
  - Cert-detail page/components (full-width layout, cert header bar, stat set, per-domain deltas, suggested-focus rationale box, tab casing).
  - Progress page/components (combined readiness+accuracy card with 80% target, low-data empty states).
- **No backend change:** the API contracts (`readinessControllerRead` trajectory, session summaries, weak-areas) are unchanged; all derived values (accuracy, deltas, streak, dates) continue to come from data already loaded for each page.
- **Downstream:** the shared PageHeader, DomainBadge, and the singular-aware formatter become the single sources for these patterns, removing the duplicated hardcoded phrasing.
