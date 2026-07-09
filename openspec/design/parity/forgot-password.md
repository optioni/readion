# Parity — Forgot password

1 findings — 0 high · 0 medium · 1 low

- **[low] Reset-link expiry copy** — divergent/behavioral
  - design: Subtext under the heading reads: "Enter your account email and we'll send a reset link. It expires in 15 minutes."
  - app: Subtext reads: "Enter your account email and we'll send a reset link. It expires in 1 hour." (matches the actual backend TTL of 3600s, but not the design's stated 15 minutes)
  - evidence: `design: openspec/design/auth-components.jsx:257-259 (ForgotScreen); app: apps/web/app/pages/forgot-password.vue:28-30; backend TTL: apps/api/src/auth/token-redis.helpers.ts:3 (PASSWORD_RESET_TOKEN_TTL_SECONDS = 3_600)`
