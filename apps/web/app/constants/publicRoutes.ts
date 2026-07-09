// Routes reachable while logged out. Shared by the auth middleware (which routes that require a
// session redirect to /login) and the robots config (which allows link-unfurl crawlers to fetch
// these while the rest of the app stays disallowed) so the two lists cannot drift apart.
export const PUBLIC_AUTH_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const
