# Parity — Verify email

7 findings — 3 high · 3 medium · 1 low

- **[high] "Link sent" waiting screen (EmailVerifySentScreen)** — missing/behavioral
  - design: After registration the user lands on /verify-email in a 'sent' state: accent-tinted envelope icon, heading 'Verify your email', body 'We sent a link to {email}. Click it to activate your account before continuing.', with 'Resend link' / 'Use a different email' actions and a 24h-expiry callout — the account is not usable until the link is clicked.
  - app: No such state exists. apps/web/app/pages/register.vue calls handleSubmit(), immediately sets the session (auth.setSession) and router.push('/') on success — the user is dropped straight into the app. /verify-email only exists as the landing page for the emailed link itself (token in the query string), rendering a 'loading' spinner then 'success'/'error' — there is no screen shown while waiting for the user to click the email.
  - evidence: `openspec/design/auth-components.jsx:318-339 (EmailVerifySentScreen) vs apps/web/app/pages/register.vue:159-162 (track+router.push('/') on success) and apps/web/app/pages/verify-email.vue:74-89 (state defaults to 'loading', driven by route.query.token)`
- **[high] Email-verification gate on account access** — missing/behavioral
  - design: Design's screen subtitle states the flow is 'link-sent, then verified/activated', implying an unverified account can't proceed until the link is confirmed (EmailVerifiedScreen shows 'Account activated' as a distinct follow-up step).
  - app: auth.global.ts treats the user as fully authenticated the moment register.vue completes, with no verified-status check gating any route; PUBLIC_ROUTES only exempts anonymous auth pages, and there is no redirect to a pending-verification screen for authenticated-but-unverified users.
  - evidence: `openspec/design/VerifyEmail.html:63 (subtitle) vs apps/web/app/middleware/auth.global.ts:16-30`
- **[high] Verify-email heading + body copy ("Verify your email" / "We sent a link to {email}…")** — missing/composition
  - design: Centered heading 'Verify your email' and body text naming the destination email inline in bold, explaining the link must be clicked before continuing.
  - app: absent — the closest text in apps/web/app/pages/verify-email.vue is the loading state's 'Verifying your email…' (line 53) or error state's 'Link invalid or expired' (line 29); neither addresses a freshly-registered user waiting for the email.
  - evidence: `openspec/design/auth-components.jsx:326-329 vs apps/web/app/pages/verify-email.vue:46-55`
- **[medium] "Resend link" action (unconditional, sent-state)** — missing/composition
  - design: Accent-colored 'Resend link' text action always shown alongside 'Use a different email' in the sent state.
  - app: A resend button exists only in the 'error' (link invalid/expired) state, gated behind `v-if="isAuthenticated"`, labeled 'Resend verification email' — never shown for the actual sent/waiting scenario the design depicts.
  - evidence: `openspec/design/auth-components.jsx:330-332 vs apps/web/app/pages/verify-email.vue:33-41`
- **[medium] "Use a different email" action** — missing/composition
  - design: Secondary muted-text action next to Resend link, letting the user back out and re-register with a different address.
  - app: No equivalent control exists anywhere on the /verify-email page or register flow.
  - evidence: `openspec/design/auth-components.jsx:332 vs apps/web/app/pages/verify-email.vue (entire file)`
- **[medium] Info callout — "Didn't receive it? Check spam folder. Link expires in 24 hours."** — missing/composition
  - design: Elevated-surface callout box under the actions, with '24 hours' emphasized in a secondary text color, shown proactively in the sent state.
  - app: Equivalent copy ('Links expire after 24 hours') only appears reactively in the error state after a failed/expired verification attempt, not as a proactive callout while awaiting the email.
  - evidence: `openspec/design/auth-components.jsx:334-336 vs apps/web/app/pages/verify-email.vue:30-32`
- **[low] Verify icon tint (accent/indigo envelope, rXl radius, sent context)** — missing/composition
  - design: 52x52 rXl icon tile with indigo/accent tint (rgba(124,140,248,0.1) bg, matching border) housing an envelope glyph, specifically representing the 'awaiting click' state.
  - app: A visually similar indigo-tinted envelope tile exists in the app (w-13 h-13 bg-indigo-500/10, apps/web/app/pages/verify-email.vue:47-52) but it represents the transient 'Verifying your email…' spinner state (token being checked), not the post-registration waiting state — same visual token repurposed for a different behavioral moment, and unreachable from the registration flow.
  - evidence: `openspec/design/auth-components.jsx:321-325 vs apps/web/app/pages/verify-email.vue:47-52`
