# Parity — Register

5 findings — 2 high · 2 medium · 1 low

- **[high] Full name field** — missing/composition
  - design: First form field on the Register screen: label 'Full name', placeholder/value 'Jamie Delacroix' — collects the user's name at signup.
  - app: absent — form only collects Email and Password; no name input anywhere in the template or useCredentialForm composable, and the register payload sent to /api/v1/auth/register omits it entirely.
  - evidence: `design: openspec/design/auth-components.jsx:231 (Field label="Full name"); app: apps/web/app/pages/register.vue:17-63 (only email-field then password-field), payload at apps/web/app/pages/register.vue:146`
- **[high] Terms of Service / Privacy Policy checkbox** — missing/composition
  - design: Required consent row with custom checkbox: 'I agree to the Terms of Service and Privacy Policy', both as links, positioned directly above the submit button. Artboard subtitle explicitly calls out 'terms' as part of the flow.
  - app: absent — no checkbox, no ToS/Privacy links, and handleSubmit performs no consent validation before calling the register endpoint.
  - evidence: `design: openspec/design/auth-components.jsx:235-242 and Register.html:63 ("...password strength, terms"); app: apps/web/app/pages/register.vue:79-89 (goes straight from password error text to submit button), handleSubmit at apps/web/app/pages/register.vue:130-172`
- **[medium] 'Or' divider + SSO sign-up button** — missing/composition
  - design: OrDivider ('or') followed by SsoButton labeled 'Sign up with SSO', present on every auth screen including Register, giving an alternate signup path.
  - app: absent — form ends at the submit button with no divider or SSO affordance.
  - evidence: `design: openspec/design/auth-components.jsx:245-246 (OrDivider + SsoButton label="Sign up with SSO"); app: apps/web/app/pages/register.vue:81-89 (form closes right after submit button)`
- **[medium] Terms consent enforcement** — missing/behavioral
  - design: Design implies the checked ToS/Privacy checkbox is a precondition of account creation (checkbox rendered pre-checked/required next to the submit action).
  - app: handleSubmit only validates password length (>= 8 chars) before calling the register API; no consent flag exists to gate or send.
  - evidence: `design: openspec/design/auth-components.jsx:235-242; app: apps/web/app/pages/register.vue:130-147`
- **[low] Email field label/placeholder** — divergent/composition
  - design: Field labeled 'Work email' with placeholder 'you@company.com', signaling a B2B/work-email framing.
  - app: Labeled 'Email' with placeholder 'you@example.com', matching the generic Sign-in field rather than the Register-specific copy.
  - evidence: `design: openspec/design/auth-components.jsx:232; app: apps/web/app/pages/register.vue:19-29`
