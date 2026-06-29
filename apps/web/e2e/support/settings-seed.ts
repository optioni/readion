import type { BrowserContext, Page, Route } from '@playwright/test'

// Route-mock harness for the web-settings acceptance loop. Mirrors progress-seed.ts and
// session-view-seed.ts: per design.md Test Boundaries this change is frontend-only and drives the
// REAL apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil) so the settings tabs,
// timezone save, study-defaults save, password-reset, and delete-account flows are exercised
// deterministically without a running NestJS backend or Postgres. Every endpoint below is already a
// committed Orval method (GET/PATCH/DELETE /users/me, POST /auth/forgot-password).

const WEB_ORIGIN = 'http://127.0.0.1:3000'

// Cross-origin (web :3000 → api :3001) credentialed fetches require explicit CORS headers; a wildcard
// origin is rejected by the browser when `credentials: 'include'` is used (auth bootstrap + mutator).
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

export const SETTINGS_USER_ID = '77777777-7777-7777-7777-777777777777'

type SessionDefaults = {
  duration: 15 | 30 | 60 | 90
  contentMix: string
  difficulty: string
  focusArea: string
  learningStyle: string
}

type Profile = {
  id: string
  email: string
  role: string
  emailVerified: boolean
  displayTimezone: string
  sessionDefaults: SessionDefaults
}

// The /users/me body satisfies both the auth bootstrap (id/email/emailVerified/displayTimezone) and
// the settings profile read (role + sessionDefaults). Served as { data: <profile> }. Email is
// jamie@org.io because the forgot-password assertion checks that exact address.
export const SETTINGS_PROFILE: Profile = {
  id: SETTINGS_USER_ID,
  email: 'jamie@org.io',
  role: 'user',
  emailVerified: true,
  displayTimezone: 'Europe/Helsinki',
  sessionDefaults: {
    duration: 30,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
  },
}

// Captured request payloads + counts the acceptance test asserts against. Populated by the route
// handlers as the page issues mutations.
export interface SettingsMockHandles {
  profilePatches: Array<Record<string, unknown>>
  forgotPasswordBodies: Array<Record<string, unknown>>
  deletePayloads: Array<Record<string, unknown>>
  // Total PATCH /users/me hits — used to assert the Notifications tab issues no profile mutation.
  profilePatchCount: () => number
}

async function fulfilJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  })
}

async function fulfilNoContent(route: Route): Promise<void> {
  await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
}

type Target = Page | BrowserContext
type Handler = (route: Route) => Promise<void>

// Registers a handler that short-circuits the CORS preflight (custom Authorization / x-csrf-token
// headers trigger one) before delegating the real method to `handler`.
function mock(target: Target, pattern: RegExp, handler: Handler): void {
  void target.route(pattern, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
      return
    }
    await handler(route)
  })
}

function readJsonBody(route: Route): Record<string, unknown> {
  const parsed = route.request().postDataJSON()
  return (parsed ?? {}) as Record<string, unknown>
}

/**
 * Installs the full route-mock surface for the Settings page. Auth-bootstrap endpoints are mocked so
 * the app is authenticated without a real sign-in. A context-level catch-all keeps any unforeseen
 * /api/v1 call from hitting the (absent) backend; page-level mocks always win.
 *
 * `deleteStatus` controls the DELETE /users/me response: 204 (success → logout + redirect) by
 * default, or 401 to exercise the wrong-password path that keeps the modal open.
 */
export function mockSettings(page: Page, deleteStatus = 204): SettingsMockHandles {
  const context = page.context()

  // Mutable profile so PATCH saves are reflected by subsequent GET /users/me reads.
  const profile: Profile = {
    ...SETTINGS_PROFILE,
    sessionDefaults: { ...SETTINGS_PROFILE.sessionDefaults },
  }

  const handles: SettingsMockHandles = {
    profilePatches: [],
    forgotPasswordBodies: [],
    deletePayloads: [],
    profilePatchCount: () => handles.profilePatches.length,
  }

  // Context-level safety net (page routes take precedence over context routes in Playwright).
  mock(context, /\/api\/v1\//, async (route) => {
    if (route.request().method() === 'GET') {
      await fulfilJson(route, 200, { data: [], meta: { total: 0, page: 1, limit: 20 } })
      return
    }
    await fulfilJson(route, 200, { data: {} })
  })

  // --- Auth bootstrap / authenticated state ---
  mock(page, /\/api\/v1\/auth\/refresh$/, async (route) => {
    await fulfilJson(route, 200, { data: { accessToken: 'mock-access-token' } })
  })

  // POST /auth/forgot-password — body-less Orval method; the signed-in email is sent in the body.
  mock(page, /\/api\/v1\/auth\/forgot-password$/, async (route) => {
    handles.forgotPasswordBodies.push(readJsonBody(route))
    await fulfilNoContent(route)
  })

  // GET / PATCH / DELETE /api/v1/users/me — one handler branches by method.
  mock(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
    const method = route.request().method()

    if (method === 'PATCH') {
      const body = readJsonBody(route)
      handles.profilePatches.push(body)
      if (typeof body.displayTimezone === 'string') {
        profile.displayTimezone = body.displayTimezone
      }
      if (body.sessionDefaults && typeof body.sessionDefaults === 'object') {
        Object.assign(profile.sessionDefaults, body.sessionDefaults as Partial<SessionDefaults>)
      }
      await fulfilJson(route, 200, { data: profile })
      return
    }

    if (method === 'DELETE') {
      handles.deletePayloads.push(readJsonBody(route))
      if (deleteStatus === 204) {
        await fulfilNoContent(route)
        return
      }
      await fulfilJson(route, deleteStatus, {
        type: 'about:blank',
        title: 'Unauthorized',
        status: deleteStatus,
        detail: 'Invalid password',
      })
      return
    }

    await fulfilJson(route, 200, { data: profile })
  })

  return handles
}
