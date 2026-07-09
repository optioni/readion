# Parity — Sign in

2 findings — 1 high · 1 medium · 0 low

- **[high] SSO divider + 'Sign in with SSO' button** — missing/composition
  - design: Below the primary submit button, an 'or' divider (OrDivider) followed by a secondary outlined SsoButton labeled 'Sign in with SSO' with a globe icon, giving users an alternate auth path.
  - app: absent — the form ends immediately after the submit button; no divider or SSO affordance exists anywhere in the app (no 'sso' references found in apps/web/app at all).
  - evidence: `design: openspec/design/auth-components.jsx lines 142-158 (OrDivider, SsoButton) used in SignInScreen lines 189-191; app: apps/web/app/pages/login.vue lines 82-90 (form ends at submit button, no further markup)`
- **[medium] Inline field-level error on Email input (error state)** — missing/behavioral
  - design: In the credentials-error state, the Email Field renders both a top-level error banner AND a red-bordered input with an inline message ('No account found with this email') beneath it, per the Field component's error prop (red border + box-shadow + caption).
  - app: Only the global banner (data-testid=login-error) is shown on a failed login; the email/password inputs have no error-conditional styling or per-field message — border and box-shadow stay identical to the success path.
  - evidence: `design: openspec/design/auth-components.jsx lines 79-105 (Field error styling) and line 209 (error='No account found with this email' in SignInErrorScreen); app: apps/web/app/pages/login.vue lines 16-26 (banner only) and lines 35-44 (static input classes, no error binding)`
