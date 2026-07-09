## Context

The parity diff produced 30 findings across Dashboard, Cert detail, and Progress. This change reconciles each against the existing `web-dashboard` / `web-cert-detail` / `web-progress` specs and the real data contracts before proposing work — several artboard details are already-decided divergences or depend on data the app doesn't surface.

## Reconciliation decisions

| Finding (severity) | Screen | Decision | Rationale |
|---|---|---|---|
| ReadinessBar missing (high) | Dashboard | Fix | Genuine composition gap on every cert card. |
| Content width `max-w-[720px]` (high/low) | Dashboard, Progress | Fix → manifest `standard` (~1100 centered) | Reconcile to the manifest `contentWidths` intent, **not** the artboard's literal uncapped `flex:1`. |
| Reviews-due row always shown (low) | Dashboard | **Reaffirm** | `web-dashboard`: "when `dueCount` is zero the row MUST NOT be rendered." App is correct. |
| Diagnostic re-prompt nudge present (low) | Dashboard | **Reaffirm** | Speced conditional feature; the two-certs artboard doesn't depict that state. |
| Cert code pill (medium) | Dashboard | Fix (verify data) | Needs the enrollment card to surface cert `code`; minor include if missing. |
| Card sections boxed 2-col vs flat divided (medium) | Dashboard | Fix | Fidelity: flat hairline-divided full-width sections. |
| Recent-sessions list vs multi-column (medium) | Dashboard | Fix | Fidelity. |
| Button icon/copy, review row (low) | Dashboard | Fix | Fidelity (play icon, sentence-case). |
| Readiness sub-label: WoW delta vs trajectory (high) | Cert detail | **Reaffirm app** | `web-cert-detail` specs a "readiness **and trajectory** stat row"; the trajectory label is intentional. The design's WoW delta is a different metric. |
| Per-row session delta badges (high) | Cert detail | Fix (verify data) | Panel supports it; `OverviewTab` never passes the delta prop. Verify per-session delta data exists. |
| Stat cards borderless / no sub-captions / right-column / dividers / accuracy color / View-all link / row content / domain label (medium/low) | Cert detail | Fix | Fidelity. |
| Extra "View progress" link (low) | Cert detail | Fix (remove) | Not in the design; header→tabs are adjacent. |
| TrajectoryCallout placement (high) | Progress | Fix (move to bottom) | It renders first, before the chart it concludes from. |
| Mastered — "Unretire" button (part of high) | Progress | **Reaffirm omission** | `web-progress`: mastering is one-way (no un-master endpoint); the artboard's Unretire is deliberately omitted. |
| Mastered — persistence (part of high) | Progress | **Fix (behavioral)** | Spec requires `enrollmentReviewControllerSuppressDomain` + query invalidation; the app's local-only `mastered` ref that resets on reload is a bug. |
| Mastered — visual treatment: divider group, strikethrough, dimmed bar, pill (part of high) | Progress | Fix | Fidelity, on top of the persistent state. |
| Chart X labels / area fill / projection line / This-month cards / section counters / history time-of-day / accuracy-bar polish / section labels (medium/low) | Progress | Fix | Fidelity. |

## Net scope

Fidelity fixes across three surfaces plus **one behavioral correction** (persist mastering via the suppress-domain endpoint). Reaffirmed divergences are locked with guard assertions (reviews-row hidden at 0; no Unretire control; trajectory sub-label kept). Two data dependencies (cert `code`, per-session delta) are verified before the pill/badge work — if a field is missing it becomes a small include rather than silently rendering nothing.

## Follow-ups (not this change)

- If product wants the **week-over-week readiness delta** on cert detail, it needs a distinct metric and is its own change (the app keeps the trajectory label here).
- If product wants a reversible **un-master**, it requires a backend un-suppress endpoint first.
