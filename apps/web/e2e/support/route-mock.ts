import type { BrowserContext, Page, Route } from '@playwright/test'

// Shared route-mock scaffolding for e2e seeds that drive the real apps/web against a fully mocked
// HTTP API (no running NestJS API or Postgres required) — used by cert-detail-mock-seed.ts and
// dashboard-mock-seed.ts. See each seed's file-level comment for why its suite needs this instead
// of the real-API harness in seed-helpers.ts.

const WEB_ORIGIN = 'http://127.0.0.1:3000'

// Cross-origin (web :3000 → api :3001) credentialed fetches require explicit CORS headers; a wildcard
// origin is rejected by the browser when `credentials: 'include'` is used (auth bootstrap + mutator).
export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

export async function fulfilJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  })
}

type Target = Page | BrowserContext
type Handler = (route: Route) => Promise<void>

// Registers a handler that short-circuits the CORS preflight (custom headers trigger one) before
// delegating to `handler`.
export function mock(target: Target, pattern: RegExp, handler: Handler): void {
  void target.route(pattern, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
      return
    }
    await handler(route)
  })
}
