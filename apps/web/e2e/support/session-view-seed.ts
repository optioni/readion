import type { BrowserContext, Page, Route } from '@playwright/test'
import type {
  AgentConversationDetailResponseDto,
  CertificationResponseDto,
  DrillResultEnvelopeDto,
  DrillResultResponseDtoSession,
  GoDeeperResponseDto,
  SessionDetailResponseDto,
  SessionItemResponseDto,
  SessionReadinessChangeDto,
  SessionResponseDto,
  SessionSummaryEnvelopeDto,
  WeakAreaListResponseDto,
} from '../../src/api/model'

// Route-mock harness for the web-session-view acceptance loop. Unlike onboarding/dashboard/cert-detail
// e2e (which drive the REAL NestJS API at :3001 with Postgres seeding), this change's design.md Test
// Boundaries mandate a fully MOCKED HTTP API so the streaming agent turn and the response-envelope
// shapes are exercised deterministically without a running backend or DB. Everything below is served
// from Playwright `route` fulfil with envelope-shaped fixtures matching the committed Orval contract
// in apps/web/src/api, plus a `text/event-stream` mock for the agent turn endpoint.

const WEB_ORIGIN = 'http://127.0.0.1:3000'

// Cross-origin (web :3000 → api :3001) credentialed fetches require explicit CORS headers; a wildcard
// origin is rejected by the browser when `credentials: 'include'` is used (auth bootstrap + mutator).
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

export const SESSION_IDS = {
  userId: '77777777-7777-7777-7777-777777777777',
  enrollmentId: '11111111-1111-1111-1111-111111111111',
  certificationId: '33333333-3333-3333-3333-333333333333',
  sessionId: '22222222-2222-2222-2222-222222222222',
  drillSessionId: '88888888-8888-8888-8888-888888888888',
  questionId: '44444444-4444-4444-4444-444444444444',
  conversationId: '55555555-5555-5555-5555-555555555555',
  strongestResponseId: '66666666-6666-6666-6666-666666666666',
  weakestResponseId: '99999999-9999-9999-9999-999999999999',
} as const

// The /users/me body must satisfy BOTH the auth bootstrap (id/email/emailVerified/displayTimezone)
// and the onboarding gate's profile read (role + sessionDefaults). Served as { data: <profile> }.
const PROFILE = {
  id: SESSION_IDS.userId,
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

const CERTIFICATION: CertificationResponseDto = {
  id: SESSION_IDS.certificationId,
  name: 'AWS Certified Solutions Architect — Associate',
  provider: 'AWS',
  code: 'SAA-C03',
  domains: [
    { name: 'Secure Architectures', weight: 30 },
    { name: 'Resilient Architectures', weight: 26 },
    { name: 'High-Performing Architectures', weight: 24 },
    { name: 'Cost-Optimized Architectures', weight: 20 },
  ],
  questionCount: 65,
  passingScore: 72,
  timeLimitMinutes: 130,
  state: 'live',
}

const WEAK_AREAS: WeakAreaListResponseDto = {
  data: [
    {
      id: 'wa-secure',
      domain: 'Secure Architectures',
      score: 0.41,
      accuracy: 0.44,
      meanConfidence: 0.6,
      responseCount: 18,
    },
    {
      id: 'wa-resilient',
      domain: 'Resilient Architectures',
      score: 0.68,
      accuracy: 0.7,
      meanConfidence: 0.65,
      responseCount: 12,
    },
  ],
  meta: { total: 2, page: 1, limit: 20 },
}

// A reading item (Markdown content), a multiple-choice quiz item (content is a JSON STRING the
// frontend MUST JSON.parse to obtain the questionId/options), and an insufficient-material quiz item
// (a gracefully skippable card). See design.md "Parse SessionItem.content by type".
const QUIZ_ITEM_CONTENT = JSON.stringify({
  questionId: SESSION_IDS.questionId,
  question:
    'Which AWS Organizations feature enforces permission guardrails across every account in an OU?',
  options: [
    'IAM permissions boundaries',
    'Service Control Policies (SCPs)',
    'Resource-based policies',
    'Session policies',
  ],
  format: 'multiple_choice',
})

const INSUFFICIENT_ITEM_CONTENT = JSON.stringify({
  insufficient: true,
  domain: 'Cost-Optimized Architectures',
})

export const ITEM_DOMAIN = 'IAM & SCPs'

function buildItems(): SessionItemResponseDto[] {
  return [
    {
      index: 0,
      type: 'reading',
      domain: ITEM_DOMAIN,
      content:
        '## Service Control Policies\n\n**TL;DR** — SCPs set the maximum available permissions for accounts in an AWS Organization; they are guardrails, not grants.',
      completed: false,
      sourceChunkIds: ['chunk-scp-001'],
      supportingSpans: ['AWS Organizations User Guide §SCP'],
    },
    {
      index: 1,
      type: 'quiz',
      domain: ITEM_DOMAIN,
      content: QUIZ_ITEM_CONTENT,
      completed: false,
      sourceChunkIds: ['chunk-scp-001'],
      supportingSpans: ['AWS Organizations User Guide §SCP'],
    },
    {
      index: 2,
      type: 'quiz',
      domain: 'Cost-Optimized Architectures',
      content: INSUFFICIENT_ITEM_CONTENT,
      completed: false,
      sourceChunkIds: [],
      supportingSpans: [],
    },
  ]
}

function buildSessionDetail(
  id: string,
  items: SessionItemResponseDto[],
  overrides: {
    status?: string
    lastItemIndex?: number
    startedAt?: string
    endedAt?: string | null
  } = {},
): SessionDetailResponseDto {
  // Orval generates `{ [key: string]: unknown }` for the nullable/enum scalar columns
  // (kind/status/focusArea/endedAt), so the runtime fixture literal is cast to the DTO once.
  const data = {
    id,
    userCertificationId: SESSION_IDS.enrollmentId,
    kind: 'study',
    status: overrides.status ?? 'active',
    durationMinutes: 60,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
    lastItemIndex: overrides.lastItemIndex ?? 0,
    startedAt: overrides.startedAt ?? '2026-06-28T09:00:00.000Z',
    endedAt: overrides.endedAt ?? null,
    items,
  } as unknown as SessionResponseDto
  return {
    data,
    relationships: { items: { data: items.map((item) => ({ index: item.index })) } },
  }
}

const GO_DEEPER: GoDeeperResponseDto = {
  expandedContent:
    'SCPs attach to the organization root, an OU, or an account. They never grant permissions — an action is allowed only if every applicable SCP and IAM policy allows it.',
}

// POST /quiz/:questionId/submit response. Per design.md the contract returns ONLY the chosen-answer
// echo plus `correct`; there is NO correctAnswer field (the UI colours only the chosen option).
const QUIZ_SUBMIT_RESULT = {
  id: 'response-quiz-1',
  correct: true,
  answer: 'Service Control Policies (SCPs)',
  confidence: 4,
  timeTakenMs: 8200,
  userCertificationId: SESSION_IDS.enrollmentId,
}

function buildConversationDetail(messages: unknown[] = []): AgentConversationDetailResponseDto {
  return {
    data: {
      id: SESSION_IDS.conversationId,
      mode: 'study-session',
      studySessionId: SESSION_IDS.sessionId,
      certificationId: SESSION_IDS.certificationId,
      lastActivityAt: '2026-06-28T09:05:00.000Z',
      createdAt: '2026-06-28T09:05:00.000Z',
    },
    relationships: { messages: { data: messages } },
  } as unknown as AgentConversationDetailResponseDto
}

const SUMMARY: SessionSummaryEnvelopeDto = {
  data: {
    questionsAnswered: 8,
    accuracy: 0.75,
    domains: [
      { domain: 'Secure Architectures', accuracy: 0.8 },
      { domain: 'Resilient Architectures', accuracy: 0.6 },
    ],
    weakAreaDeltas: [
      { domain: 'Secure Architectures', delta: 0.12 },
      { domain: 'Resilient Architectures', delta: -0.04 },
    ],
    readiness: { before: 62, after: 66, delta: 4 } as unknown as SessionReadinessChangeDto,
    strongestQuestion: {
      responseId: SESSION_IDS.strongestResponseId,
      question: 'Which feature enforces permission guardrails across an OU?',
    },
    weakestQuestion: {
      responseId: SESSION_IDS.weakestResponseId,
      question: 'Which storage class minimises cost for rarely accessed, long-lived data?',
    },
    nextFocus: { domain: 'Resilient Architectures' },
  },
}

// Raw Vercel AI SDK fullStream parts forwarded by the API, serialised as `data: <json>\n\n` lines.
// The harness can emit every event type the loop and later negative tests need: text-delta,
// tool-result, job-event, [DONE], and error.
export const SESSION_AGENT_STREAM_EVENTS: unknown[] = [
  { type: 'text-delta', textDelta: 'Service Control Policies (SCPs) ' },
  { type: 'text-delta', textDelta: 'are organization-wide permission guardrails.' },
  {
    type: 'tool-result',
    toolName: 'explainAnswer',
    output: {
      correctOption: 'b',
      explanation: 'SCPs cap the permissions available to accounts; they never grant access.',
      citations: ['AWS Organizations User Guide'],
    },
  },
  { type: 'job-event', status: 'ready' },
]

export const SESSION_AGENT_ERROR_EVENTS: unknown[] = [
  { type: 'text-delta', textDelta: 'Let me look that up' },
  { type: 'error', error: 'upstream model timeout' },
]

export function buildEventStream(events: unknown[]): string {
  const lines = events.map((event) => `data: ${JSON.stringify(event)}\n\n`)
  lines.push('data: [DONE]\n\n')
  return lines.join('')
}

async function fulfilJson(
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
function mock(target: Target, pattern: RegExp, handler: Handler): void {
  void target.route(pattern, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
      return
    }
    await handler(route)
  })
}

const { enrollmentId, certificationId, sessionId, drillSessionId, questionId, conversationId } =
  SESSION_IDS

// Shared by the lifecycle/citation/zero-state fixtures below: authenticates the client and installs
// a context-level catch-all so any unmocked /api/v1 read (e.g. the header's cert/enrollment lookups)
// degrades to empty data instead of hitting the absent backend.
function installBaseMocks(page: Page): void {
  mock(page.context(), /\/api\/v1\//, async (route) => {
    if (route.request().method() === 'GET') {
      await fulfilJson(route, 200, { data: [], meta: { total: 0, page: 1, limit: 20 } })
      return
    }
    await fulfilJson(route, 200, { data: {} })
  })
  mock(page, /\/api\/v1\/auth\/refresh$/, async (route) => {
    await fulfilJson(route, 200, { data: { accessToken: 'mock-access-token' } })
  })
  mock(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
    await fulfilJson(route, 200, { data: PROFILE })
  })
}

/**
 * Installs the route surface for opening a session that has already ENDED (`status: "completed"`)
 * at `/sessions/:id`: `startedAt` is ~49h before now and `endedAt` is 20 minutes later, reproducing
 * the "2910:42" free-running-timer repro from proposal.md while giving the correct frozen value
 * (~"20:00"). `POST /sessions/:id/end` is stubbed but its call count is exposed so the acceptance
 * test can assert it is never invoked for an already-ended session.
 */
export function mockCompletedSessionView(
  page: Page,
  options: { id?: string } = {},
): { startedAt: string; endedAt: string; endCallCount: () => number } {
  const id = options.id ?? sessionId
  const startedAt = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString()
  const endedAt = new Date(new Date(startedAt).getTime() + 20 * 60 * 1000).toISOString()
  const items = buildItems()
  let endCalls = 0

  installBaseMocks(page)

  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}(\?|$)/, async (route) => {
    await fulfilJson(
      route,
      200,
      buildSessionDetail(id, items, {
        status: 'completed',
        startedAt,
        endedAt,
        lastItemIndex: items.length,
      }),
    )
  })
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/end$/, async (route) => {
    endCalls += 1
    await fulfilJson(
      route,
      200,
      buildSessionDetail(id, items, {
        status: 'completed',
        startedAt,
        endedAt,
        lastItemIndex: items.length,
      }),
    )
  })
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/summary$/, async (route) => {
    await fulfilJson(route, 200, SUMMARY)
  })

  return { startedAt, endedAt, endCallCount: () => endCalls }
}

/**
 * Installs the route surface for an ACTIVE session whose sole reading item carries a raw
 * content-chunk UUID in `sourceChunkIds` (plus a human `supportingSpans` entry), exercising the
 * citation-label fidelity fix independently of the ended-session lifecycle branch (an ended
 * session would not render the reading block at all).
 */
export function mockActiveSessionWithCitationFixture(page: Page): {
  id: string
  citationId: string
} {
  const id = sessionId
  const citationId = 'bb9dd4b7-e3e5-44e6-b006-1b6fd247e14b'
  const items: SessionItemResponseDto[] = [
    {
      index: 0,
      type: 'reading',
      domain: ITEM_DOMAIN,
      content:
        '## Service Control Policies\n\n**TL;DR** — SCPs set the maximum available permissions for accounts in an AWS Organization.',
      completed: false,
      sourceChunkIds: [citationId],
      supportingSpans: ['AWS Organizations User Guide §SCP'],
    },
  ]

  installBaseMocks(page)

  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}(\?|$)/, async (route) => {
    await fulfilJson(route, 200, buildSessionDetail(id, items))
  })

  return { id, citationId }
}

/**
 * Installs the route surface for a completed session whose summary reports
 * `questionsAnswered: 0` — the misleading-zeros repro from proposal.md ("ACCURACY 0% · 0/0",
 * "READINESS +0% 19%→19%", weak areas "↑0%", an empty "Domains covered" box).
 */
export function mockZeroAnsweredSummary(page: Page, options: { id?: string } = {}): { id: string } {
  const id = options.id ?? sessionId
  const startedAt = '2026-06-28T09:00:00.000Z'
  const endedAt = '2026-06-28T09:20:00.000Z'

  installBaseMocks(page)

  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/summary$/, async (route) => {
    await fulfilJson(route, 200, {
      data: {
        questionsAnswered: 0,
        accuracy: 0,
        domains: [],
        weakAreaDeltas: [],
        readiness: { before: 19, after: 19, delta: 0 },
        strongestQuestion: null,
        weakestQuestion: null,
        nextFocus: null,
      },
    } as unknown as SessionSummaryEnvelopeDto)
  })
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}(\?|$)/, async (route) => {
    await fulfilJson(
      route,
      200,
      buildSessionDetail(id, [], { status: 'completed', startedAt, endedAt, lastItemIndex: 0 }),
    )
  })

  return { id }
}

/**
 * Installs the full route-mock surface for the session loop and returns the fixtures. Auth-bootstrap
 * endpoints are mocked so the app is authenticated without a real sign-in. A context-level catch-all
 * keeps any unforeseen /api/v1 call from hitting the (absent) backend; page-level mocks always win.
 */
export function mockSessionLoop(page: Page): {
  ids: typeof SESSION_IDS
  summary: SessionSummaryEnvelopeDto
  streamEvents: unknown[]
} {
  const context = page.context()
  const items = buildItems()
  const completed = new Set<number>()

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

  // --- Start screen reads ---
  mock(page, new RegExp(`/api/v1/certifications/${certificationId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: CERTIFICATION, relationships: {} })
  })
  // Enrollment → certification hop for useCertDetail (session-start cert pill, app-shell session
  // header/sidebar lookups).
  mock(page, new RegExp(`/api/v1/user-certifications/${enrollmentId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: { id: enrollmentId, certificationId }, relationships: {} })
  })
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/weak-areas(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, WEAK_AREAS)
    },
  )

  // --- Create session (quick start = empty body → 201 with the session) ---
  mock(page, new RegExp(`/api/v1/user-certifications/${enrollmentId}/sessions$`), async (route) => {
    await fulfilJson(route, 201, buildSessionDetail(sessionId, items))
  })

  // --- Session detail w/ items (matches both the main session and the drill session) ---
  mock(page, /\/api\/v1\/sessions\/([0-9a-f-]{36})(\?|$)/, async (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[4] ?? sessionId
    const reflected = items.map((item) => ({ ...item, completed: completed.has(item.index) }))
    await fulfilJson(
      route,
      200,
      buildSessionDetail(id, reflected, { lastItemIndex: completed.size }),
    )
  })

  // --- Item completion / go-deeper ---
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/items\/(\d+)\/complete$/, async (route) => {
    const index = Number(new URL(route.request().url()).pathname.split('/')[6])
    completed.add(index)
    const reflected = items.map((item) => ({ ...item, completed: completed.has(item.index) }))
    await fulfilJson(
      route,
      200,
      buildSessionDetail(sessionId, reflected, { lastItemIndex: completed.size }),
    )
  })
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/items\/\d+\/go-deeper$/, async (route) => {
    await fulfilJson(route, 200, GO_DEEPER)
  })

  // --- End session ---
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/end$/, async (route) => {
    const reflected = items.map((item) => ({ ...item, completed: true }))
    await fulfilJson(
      route,
      200,
      buildSessionDetail(sessionId, reflected, {
        status: 'completed',
        lastItemIndex: items.length,
        endedAt: '2026-06-28T09:20:00.000Z',
      }),
    )
  })

  // --- Quiz submit / report / explanation ---
  mock(page, new RegExp(`/api/v1/quiz/${questionId}/submit$`), async (route) => {
    await fulfilJson(route, 201, { data: QUIZ_SUBMIT_RESULT })
  })
  mock(page, new RegExp(`/api/v1/quiz/${questionId}/report$`), async (route) => {
    await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
  })
  mock(page, new RegExp(`/api/v1/quiz/${questionId}/explanation$`), async (route) => {
    await fulfilJson(route, 201, {
      data: {
        correctOption: 'b',
        explanation: 'SCPs are organization-level guardrails; they cap, not grant, permissions.',
        citations: ['AWS Organizations User Guide'],
      },
    })
  })

  // --- In-session agent conversation: create, hydrate, stream a turn ---
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/agent-conversations$/, async (route) => {
    await fulfilJson(route, 201, buildConversationDetail())
  })
  mock(
    page,
    new RegExp(`/api/v1/agent-conversations/${conversationId}/messages$`),
    async (route) => {
      await fulfilJson(
        route,
        200,
        buildEventStream(SESSION_AGENT_STREAM_EVENTS),
        'text/event-stream',
      )
    },
  )
  mock(page, new RegExp(`/api/v1/agent-conversations/${conversationId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, buildConversationDetail())
  })

  // --- Summary + drill ---
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/summary$/, async (route) => {
    await fulfilJson(route, 200, SUMMARY)
  })
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/drill$/, async (route) => {
    const body: DrillResultEnvelopeDto = {
      data: {
        status: 'started',
        session: buildSessionDetail(drillSessionId, buildItems())
          .data as unknown as DrillResultResponseDtoSession,
      },
    }
    await fulfilJson(route, 201, body)
  })

  return { ids: SESSION_IDS, summary: SUMMARY, streamEvents: SESSION_AGENT_STREAM_EVENTS }
}

/**
 * Establishes the mocked authenticated state on a public route (no onboarding gate, no auth
 * redirect), then performs an in-app client-side navigation to `path`. A full page load of a
 * protected route is bounced to /login by SSR middleware because auth lives only in the client
 * (see cert-detail.e2e.ts / onboarding.e2e.ts), so the loop reaches its screens client-side.
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
