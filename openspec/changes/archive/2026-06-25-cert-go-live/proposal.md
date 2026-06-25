## Why

A `Certification` is seeded in `draft` and is invisible to learners (the public list returns only `live` certs), but nothing yet promotes a cert to `live`. Without an automatic, coverage-gated promotion, either certs never become enrollable or they go live with empty/lopsided content and produce broken study sessions and mock exams. This change closes that gap: it measures per-domain content coverage and flips `draft → live` on its own once the knowledge base is provably deep enough to generate any session and a full mock without gaps.

## What Changes

- Add a **coverage evaluation** for a certification that computes, from the shared knowledge base, whether all three go-live thresholds hold (PRD §4):
  - every domain in the cert's domain list has **≥ 20 active content chunks** tagged to it,
  - **total active chunks ≥ 3× `questionCount`**,
  - **≥ 1 enabled, successfully-ingested `ContentSource`** per domain.
- Recompute coverage **on ingestion completion** in `apps/worker` (after each source finishes ingesting + reconciling) and **automatically flip `Certification.state` from `draft` to `live`** when the bar is met — no manual publish step. The flip is one-way (a cert that has gone live is not demoted here).
- Make the three thresholds **configurable** (per-domain chunk minimum, total-chunk multiple) via worker/api env config rather than hard-coded.
- Expose an **admin-facing per-domain coverage read model** so the gap to go-live is visible: per domain, the active-chunk count and ingested-source count against their thresholds, the total-chunk figure against its threshold, and overall `met`/`unmet` state.
- Emit the go-live coverage as a derived read model only — **no new entity, no migration**. The flip mutates the existing `Certification.state` column owned by `certifications`.

## Capabilities

### New Capabilities
- `cert-go-live`: coverage-bar evaluation against the PRD §4 thresholds, the automatic `draft → live` promotion triggered on ingestion completion, and the admin per-domain coverage read model that exposes the gap to go-live.

### Modified Capabilities
<!-- None. `Certification.state` (draft/live), its default of `draft`, and live-only public listing are already specified by the `certifications` capability; this change adds the promotion behavior as a new capability rather than altering those requirements. -->

## Impact

- **Entities:** none created or migrated. Reads `ContentChunk` (`certificationId`, `domainTags`, `state`) and `ContentSource` (`certificationId`, `enabled`); writes `Certification.state` (existing column).
- **Worker (`apps/worker`):** ingestion-completion hook in the content pipeline evaluates coverage for the affected certification and performs the promotion.
- **API (`apps/api`):** new admin-only (RolesGuard) read endpoint returning the per-domain coverage report; Orval client regenerated. The newly-`live` cert immediately satisfies the existing `GET /api/v1/certifications` live-only filter, unblocking enrollment and the study loop.
- **Shared (`packages/shared`):** coverage-report DTO/types and threshold constants.
- **Config:** new env vars for the per-domain chunk minimum and total-chunk multiple (Zod-validated in both worker and api).
- **Depends on:** `content-pipeline` and `certifications` (both archived).
