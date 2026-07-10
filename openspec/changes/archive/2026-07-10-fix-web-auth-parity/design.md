## Context

The parity diff produced 18 raw findings across the five auth surfaces. This change reconciles each against the existing `web-auth` spec before proposing work, because the auth artboards depict an idealized product that the shipped spec deliberately scoped down. Without this reconciliation the "fixes" would re-introduce features (SSO, a name field, a verify-before-access gate) that were explicitly descoped — recreating the parity problem in reverse.

## Reconciliation decisions

| Finding (severity) | Screen | Decision | Rationale |
|---|---|---|---|
| SSO divider + button (high/med) | Sign in, Register | Reaffirm divergence | `web-auth` spec: SSO deliberately omitted, a separate product + backend decision. |
| Full name field (high) | Register | Reaffirm divergence | `User` entity has no name attribute; artboard row deliberately not reproduced. |
| ToS/Privacy consent + enforcement (high/med) | Register | Descope pending product | Not in spec; a required consent gate is a product/legal decision implying server-side consent storage. Its own change if adopted. |
| Verify-before-access: sent screen, gate, heading/body/resend/different-email/spam-callout copy, icon (3H/3M/1L) | Verify email | Reaffirm divergence | Spec signs the user in immediately on register; `/verify-email` is token consumption + error-state resend, not a gate. The design's lock-until-verified model is a different auth flow (UI + backend), not fidelity. |
| Reset-link expiry copy "15 min" vs "1 hour" (low) | Forgot password | No app change — **design is stale** | App's "1 hour" matches the real 3600s TTL; the artboard's "15 minutes" is wrong and should be corrected in the design. |
| Register email label "Work email" (low) | Register | Leave generic | "Work email" imposes a B2B positioning that is a product-copy decision, not fidelity. |
| Reset "New password" vs "Password" label (low) | Reset password | Leave as-is | App's "New password" is clearer than the design's bare "Password" in a reset context. |
| Errored-field styling on failed login (medium) | Sign in | **Fix (partial)** | Adopt the errored-field border; keep the uniform, non-revealing banner message (spec security requirement). |
| Confirm-password field + match validation (high/med) | Reset password | **Fix** | Low-risk client-side safety improvement; matches the design. |

## Net scope

Two genuine, client-only fidelity fixes; everything else is reaffirmed as a deliberate divergence or flagged for a separate product decision. No API/DB/contract changes. Guard tests lock the reaffirmed divergences (no SSO, no Full-name field, no verify-gate) so a future well-meaning "fidelity" pass cannot silently re-introduce them.

## Follow-ups (not this change)

- **Design correction:** forgot-password artboard expiry copy 15 min → 1 hour (the app is authoritative here).
- If product later wants **SSO**, a **ToS consent gate**, or a **verify-before-access flow**, each is its own change with backend scope.
