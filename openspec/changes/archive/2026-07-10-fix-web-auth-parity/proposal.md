## Why

A per-view design/implementation parity diff (`openspec/design/parity/`) compared the five auth surfaces — Sign in, Register, Forgot/Reset password, Verify email — against their reference artboards (`SignIn.html`, `Register.html`, `ForgotPassword.html`, `ResetPassword.html`, `VerifyEmail.html` + shared `auth-components.jsx`). Reconciling the 18 raw findings against the existing `web-auth` spec, **most resolve to divergences the product already decided deliberately** — the artboards depict an idealized auth product (SSO, a name field, a strict verify-before-access gate) that the shipped spec intentionally omits. Only two are genuine fidelity gaps worth fixing here; the rest are reaffirmed as divergences or flagged for a product decision. See `design.md` for the full reconciliation table.

**Genuine fidelity gaps (fixed here):**

- **Sign in — no errored-field styling.** On a failed login the app shows only a global banner (`login-error`); the inputs keep their neutral border. The design red-borders the errored field. We add the errored-field styling **while keeping the uniform, non-account-revealing banner message** — the spec's security requirement that the message must not reveal which field was wrong stands, so we adopt the design's field styling but NOT its account-revealing "No account found with this email" copy.
- **Reset password — no confirm-password field.** The app renders a single New-password input; a mistyped password cannot be caught before submit. The design pairs it with a Confirm-password field showing a match check. We add the confirm field + live client-side match validation (client-only; the POST payload is unchanged).

**Reaffirmed deliberate divergences (no change — the spec already records these):**

- **SSO** on Sign in and Register — the `web-auth` spec states SSO "remains omitted and is NOT reintroduced… a separate product decision with its own backend scope." The `or` divider + "Sign in/up with SSO" button stay out.
- **Full name field** on Register — the `User` entity has no name attribute; the artboard's "Full name" row is deliberately not reproduced.
- **The entire verify-before-access flow** on Verify email (7 findings: sent-waiting screen, verification gate, its heading/body/resend/"different email"/spam-callout copy, icon). The spec deliberately **signs the user in immediately on register** and treats `/verify-email` as a token-consumption page (+ resend in the error state), not a gate. Adopting the design's "link sent → account locked until verified" model is a different product+backend flow, not UI fidelity.
- **Forgot-password expiry copy** — here the **implementation is correct and the design is stale**: the app says "expires in 1 hour" (matching the real 3600s backend TTL); the artboard says "15 minutes." No app change; the artboard should be corrected instead.

**Flagged for a product decision (descoped here):**

- **Terms of Service / Privacy consent checkbox + enforcement** on Register — not in the current spec; a required consent gate is a product/legal decision that also implies storing consent server-side. Descoped pending that decision, like SSO. If adopted it becomes its own change with API scope.

**Minor copy (left as-is):** Register's generic "Email" label (the design's "Work email" imposes a B2B framing that is a positioning decision, not fidelity); Reset's "New password" label (clearer than the design's bare "Password" in a reset context).

## What Changes

- **web-auth** — (1) render the errored credential field(s) in the design's error styling on a failed login while preserving the uniform, non-revealing banner message; (2) add a Confirm-password field with live match validation to the reset-password form (client-side only). Reaffirm the SSO, Full-name, and verify-before-access divergences with guard tests; descope the ToS consent gate pending product.

## Capabilities

### Modified Capabilities

- `web-auth`: errored-field styling on login failure (without account-revealing copy); a confirm-password field with client-side match validation on reset-password. Reaffirmed divergences: no SSO, no Full-name field, no verify-before-access gate/sent-screen; ToS consent descoped.

## Impact

- **apps/web** — presentational/behavioral, client-only:
  - `apps/web/app/pages/login.vue` (+ the shared credential-field component): bind an error state to the credential inputs on `401`.
  - `apps/web/app/pages/reset-password.vue`: add the confirm-password field + client-side match check gating submit.
- **No API, DB, `packages/shared`, or generated-client changes.** No new endpoints; login/reset payloads unchanged.
- **Tests** — Playwright e2e for the two surfaces + component unit tests for the errored-field binding and the confirm-match validation. No integration tests (no backend surface touched).
- **Descoped:** ToS/Privacy consent gate (register); SSO controls; the verify-before-access flow (sent-waiting screen + gate). Forgot-password copy needs a **design** correction (15 min → 1 hour), not an app change.
