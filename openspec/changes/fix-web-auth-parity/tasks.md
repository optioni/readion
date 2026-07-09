## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Write a failing Playwright e2e (`apps/web/e2e`) for **Sign in** error styling: submit bad credentials on `/login`, assert the credential field(s) render the errored (danger-token) styling AND the global banner still shows the uniform "invalid email or password" message — with NO account-revealing per-field copy (e.g. "No account found")
- [x] 0.2 Write a failing Playwright e2e for **Reset password** confirm field: on a valid-token reset form, assert a "Confirm password" field renders, that a mismatch blocks submit with an inline "passwords do not match" message, and that a match shows the success indicator and allows submit
- [x] 0.3 Confirm both specs fail for the right reason (missing markup/behavior), not a selector/harness error

## 1. Sign in — errored-field styling on failed login (`web-auth`)

- [x] 1.1 RED: component test asserting the credential inputs render the errored styling (Readion danger/error token border) when the form is in the login-failed state, and neutral styling otherwise
- [x] 1.2 RED: component test asserting the failure message remains the uniform banner "invalid email or password" and NO per-field, account-revealing message is rendered
- [x] 1.3 GREEN: bind an `error` state to the credential field component on `401` in `login.vue`; style the input border via the Readion error token
- [x] 1.4 REFACTOR: share the errored-field styling with the reset/register credential fields if they use the same primitive; keep the uniform-message behavior intact

## 2. Reset password — confirm field + match validation (`web-auth`)

- [x] 2.1 RED: component test asserting the reset form renders a second "Confirm password" field beneath the new-password field
- [x] 2.2 RED: component test asserting submit is blocked with an inline "passwords do not match" message when the two entries differ, and enabled when they match (in addition to the existing ≥8-char rule)
- [x] 2.3 RED: component test asserting the confirm field shows the success (check) indicator when the values match
- [x] 2.4 GREEN: add the confirm-password field + client-side match check to `reset-password.vue`; gate submit on match; keep the POST payload (token + new password) unchanged
- [x] 2.5 REFACTOR: ensure the strength rule and match rule compose cleanly; tidy validation state

## 3. Reaffirm deliberate divergences — guard tests (`web-auth`)

- [x] 3.1 RED→green: assert `/login` and `/register` render NO SSO control and NO `or` divider (guards the deliberate omission against re-introduction)
- [x] 3.2 assert `/register` renders NO "Full name" field (guards the deliberate omission — the `User` entity has no name attribute)
- [x] 3.3 assert registration still auto-signs-in: the post-register destination is the app home, not a "verify your email" wall (guards against accidentally adding the verify-before-access gate)

## 4. Acceptance Test — Outer Loop GREEN

- [x] 4.1 Confirm the section-0 e2e specs now pass end-to-end
- [x] 4.2 Visually diff `/login` (error state) and `/reset-password` against `SignIn.html` / `ResetPassword.html`; reconcile residual spacing/token drift
- [x] 4.3 REFACTOR: clean up test selectors and shared fixtures

## 5. Change Review — Subagent Verification

- [ ] 5.1 Dispatch a reviewer subagent against `proposal.md`, the `web-auth` spec delta, and the diff plus this task list (reviewer reports findings only, does not edit code)
- [ ] 5.2 Triage: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason each), note SUGGESTIONs; re-run affected tests

## 6. Polish

- [ ] 6.1 Run linter and fix all errors (`yarn lint`)
- [ ] 6.2 Run formatter and apply fixes (`yarn format`)
- [ ] 6.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [ ] 6.4 Run coverage and confirm ≥80% lines/branches for the touched components (`yarn workspace apps/web test:coverage`)
