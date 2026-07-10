## Context

Five parity findings on the onboarding cert-select step. All are genuine presentational fidelity gaps — the flow's behavior already matches the `web-onboarding` spec — so there is one small reconciliation and no product descopes.

## Reconciliation decisions

| Finding (severity) | Decision | Rationale |
|---|---|---|
| Vendor-grouped cert list (high) | Fix | The spec says each option shows "name and provider"; grouping moves the provider to an uppercase vendor group header and shows name + code on the row. The spec wording is updated accordingly. Client-side over the loaded catalog. |
| Search count suffix "N available" (medium) | Fix | Reflects total loaded count, not the filtered subset. |
| Footer divider + right-aligned "Continue →" (medium) | Fix | Layout fidelity. |
| Search magnifying-glass icon (low) | Fix | Fidelity. |
| Continue arrow glyph (low) | Fix | Fidelity. |

## Net scope

Presentational only, entirely client-side over the already-loaded `GET /certifications` catalog (grouping keys on each cert's `provider`). No API/DB/contract change. Selection, client-side filtering (name/provider/code), and Continue-disabled-until-chosen behavior are unchanged and re-asserted in the tasks.

## Follow-ups

- None. Self-contained fidelity work.
