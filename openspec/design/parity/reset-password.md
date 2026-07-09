# Parity — Reset password

3 findings — 1 high · 1 medium · 1 low

- **[high] Confirm password field** — missing/composition
  - design: A second field labeled 'Confirm password' (type password, masked value) with a success-state suffix icon (green circle + checkmark) indicating the confirmation matches the new password.
  - app: absent — the form only renders a single 'New password' input; there is no confirmation field at all.
  - evidence: `design: openspec/design/auth-components.jsx:309-311 (NewPasswordScreen → Field label='Confirm password' suffix=checkmark svg) vs app: apps/web/app/pages/reset-password.vue:49-96 (only one password input, no second field)`
- **[medium] Password match validation** — missing/behavioral
  - design: Confirm-password field's checkmark suffix implies live client-side validation that the two password entries match before allowing submission.
  - app: No mismatch/typo protection exists — handleSubmit only checks password.value.length < 8; a user who mistypes their new password has no way to catch it before submit.
  - evidence: `design: openspec/design/auth-components.jsx:309-311 vs app: apps/web/app/pages/reset-password.vue:140-142 (handleSubmit length check only, no confirm value to compare against)`
- **[low] Password field label** — divergent/composition
  - design: PasswordStrength component labels the field simply 'Password'.
  - app: Field is labeled 'New password'.
  - evidence: `design: openspec/design/auth-components.jsx:120 (label 'Password') vs app: apps/web/app/pages/reset-password.vue:51 (label 'New password')`
