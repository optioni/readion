import type { BrowserContext, Page, Route } from '@playwright/test'
import type { AgentConversationDetailResponseDto } from '../../src/api/model'

// Route-mock harness for the web-agent-chat acceptance loop. Unlike other e2e suites that drive
// the REAL NestJS API at :3001, this change's design.md Test Boundaries mandate a fully MOCKED HTTP
// API so the streaming agent turn and the response-envelope shapes are exercised deterministically
// without a running backend or DB. Everything below is served from Playwright `route` fulfil with
// envelope-shaped fixtures matching the committed Orval contract in apps/web/src/api, plus a
// `text/event-stream` mock for the agent turn endpoint.

const WEB_ORIGIN = 'http://127.0.0.1:3000'

// Cross-origin (web :3000 → api :3001) credentialed fetches require explicit CORS headers; a wildcard
// origin is rejected by the browser when `credentials: 'include'` is used (auth bootstrap + mutator).
export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

export const AGENT_IDS = {
  userId: 'cccccccc-1111-1111-1111-111111111111',
  conversationId: 'cccccccc-2222-2222-2222-222222222222',
} as const

// The /users/me body must satisfy BOTH the auth bootstrap (id/email/emailVerified/displayTimezone)
// and the onboarding gate's profile read (role + sessionDefaults). Served as { data: <profile> }.
const PROFILE = {
  id: AGENT_IDS.userId,
  email: 'learner@example.com',
  role: 'user',
  emailVerified: true,
  displayTimezone: 'Europe/Helsinki',
  createdAt: '2026-01-01T00:00:00.000Z',
  sessionDefaults: {
    duration: 60,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
  },
}

export const SUGGESTIONS = [
  "What's the difference between TCP and UDP?",
  'Explain eventual consistency in plain language',
  'How does TLS handshake work?',
  'When would I use a queue vs a topic?',
]

// Raw Vercel AI SDK fullStream parts forwarded by the API, serialised as `data: <json>\n\n` lines.
// For STANDALONE mode the tool set is EMPTY — only text-delta events occur. No tool-result, no
// job-event, no citation chips. The concatenation of textDelta values is "TCP is connection-oriented
// while UDP is connectionless." — a recognisable phrase the acceptance test asserts on.
export const AGENT_STANDALONE_STREAM_EVENTS: unknown[] = [
  { type: 'text-delta', textDelta: 'TCP is connection-oriented ' },
  { type: 'text-delta', textDelta: 'while UDP is connectionless.' },
]

export function buildEventStream(events: unknown[]): string {
  const lines = events.map((event) => `data: ${JSON.stringify(event)}\n\n`)
  lines.push('data: [DONE]\n\n')
  return lines.join('')
}

export async function fulfilJson(
  route: Route,
  status: number,
  body: unknown,
  contentType = 'application/json',
): Promise<void> {
  await route.fulfill({
    status,
    contentType,
    headers: CORS_HEADERS,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

type Target = Page | BrowserContext
type Handler = (route: Route) => Promise<void>

// Registers a handler that short-circuits the CORS preflight (custom Authorization / x-csrf-token
// headers trigger one) before delegating the real method to `handler`.
export function mock(target: Target, pattern: RegExp, handler: Handler): void {
  void target.route(pattern, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
      return
    }
    await handler(route)
  })
}

function buildConversationDetail(messages: unknown[] = []): AgentConversationDetailResponseDto {
  return {
    data: {
      id: AGENT_IDS.conversationId,
      mode: 'standalone',
      studySessionId: null,
      certificationId: null,
      lastActivityAt: '2026-06-29T09:05:00.000Z',
      createdAt: '2026-06-29T09:05:00.000Z',
    },
    relationships: { messages: { data: messages } },
  } as unknown as AgentConversationDetailResponseDto
}

/**
 * Installs the full route-mock surface for the standalone /agent chat page and returns fixtures.
 * Auth-bootstrap endpoints are mocked so the app is authenticated without a real sign-in. A
 * context-level catch-all keeps any unforeseen /api/v1 call from hitting the (absent) backend;
 * page-level mocks always win over context-level mocks in Playwright.
 */
export function mockAgentChat(page: Page): {
  ids: typeof AGENT_IDS
  streamEvents: unknown[]
} {
  const context = page.context()

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
  mock(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
    await fulfilJson(route, 200, { data: PROFILE })
  })

  // --- Standalone conversation create (POST /api/v1/agent-conversations, no body) ---
  mock(page, /\/api\/v1\/agent-conversations$/, async (route) => {
    await fulfilJson(route, 201, buildConversationDetail())
  })

  // --- Agent turn stream: registered BEFORE the detail GET so the /messages$ pattern is
  //     evaluated first (Playwright handlers are called in LIFO order for overlapping patterns).
  mock(
    page,
    new RegExp(`/api/v1/agent-conversations/${AGENT_IDS.conversationId}/messages$`),
    async (route) => {
      await fulfilJson(
        route,
        200,
        buildEventStream(AGENT_STANDALONE_STREAM_EVENTS),
        'text/event-stream',
      )
    },
  )

  // --- Conversation hydrate (GET /api/v1/agent-conversations/:id?include=messages) ---
  mock(
    page,
    new RegExp(`/api/v1/agent-conversations/${AGENT_IDS.conversationId}(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, buildConversationDetail())
    },
  )

  return { ids: AGENT_IDS, streamEvents: AGENT_STANDALONE_STREAM_EVENTS }
}

/**
 * Establishes the mocked authenticated state on a public route (no onboarding gate, no auth
 * redirect), then performs an in-app client-side navigation to `path`. A full page load of a
 * protected route is bounced to /login by SSR middleware because auth lives only in the client
 * (see session-view.e2e.ts / cert-detail.e2e.ts), so the loop reaches its screens client-side.
 */
export async function gotoAuthenticated(page: Page, path: string): Promise<void> {
  await page.goto('/forgot-password')
  await page.waitForLoadState('networkidle')
  await page.evaluate((target) => {
    // Vue Router reads `history.state.current`/`.position` when a later programmatic push()
    // saves the current entry; a bare `pushState({}, ...)` wipes those and makes the next
    // navigateTo() build a `<origin>undefined` URL. Preserve the well-formed state the real
    // /forgot-password load installed so the in-app client-side navigation stays coherent.
    const previous = (window.history.state ?? {}) as { current?: string; position?: number }
    window.history.pushState(
      {
        back: previous.current ?? null,
        current: target,
        forward: null,
        replaced: false,
        position: (previous.position ?? 0) + 1,
        scroll: null,
      },
      '',
      target,
    )
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
  }, path)
}
