import type { BrowserContext, Page, Route } from '@playwright/test'
import type {
  CertificationResponseDto,
  EnrollmentResponseDto,
  ReadinessDetailResponseDto,
  SessionListResponseDto,
  SessionReadinessChangeDto,
  SessionResponseDto,
  SessionSummaryEnvelopeDto,
  WeakAreaListResponseDto,
} from '../../src/api/model'

// Route-mock harness for the fix-learner-surfaces-fidelity outer-loop RED tests (tasks 0.2 and
// 0.4). Mirrors support/progress-seed.ts: per design.md Test Boundaries, the deterministic
// weeksToReady===1 (singular trajectory copy) and questionsAnswered===0 (accuracy-suppression)
// regression states are hard/flaky to reach through the REAL readiness/summary computation path
// locally (they depend on graded quiz responses the LLM-backed pipeline produces), so this harness
// drives the REAL apps/web cert-detail page against a FULLY MOCKED HTTP API instead. No running
// NestJS API or Postgres is required.

const WEB_ORIGIN = 'http://127.0.0.1:3000'

// Cross-origin (web :3000 → api :3001) credentialed fetches require explicit CORS headers; a wildcard
// origin is rejected by the browser when `credentials: 'include'` is used (auth bootstrap + mutator).
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

export const CERT_DETAIL_MOCK_IDS = {
  userId: '55555555-cccc-cccc-cccc-cccccccccccc',
  enrollmentId: 'aaaaaaaa-cccc-cccc-cccc-cccccccccccc',
  certificationId: 'bbbbbbbb-cccc-cccc-cccc-cccccccccccc',
  sessionId1: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
} as const

const { enrollmentId, certificationId, sessionId1 } = CERT_DETAIL_MOCK_IDS

// The /users/me body satisfies both the auth bootstrap (id/email/emailVerified/displayTimezone)
// and the onboarding gate's profile read (role + sessionDefaults). Served as { data: <profile> }.
const PROFILE = {
  id: CERT_DETAIL_MOCK_IDS.userId,
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
  id: certificationId,
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

const ENROLLMENT: EnrollmentResponseDto = {
  id: enrollmentId,
  certificationId,
  status: 'active',
  enrolledAt: '2026-01-15T00:00:00.000Z',
  sessionDefaults: {
    duration: 60,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
  },
  readinessScore: 66,
} as unknown as EnrollmentResponseDto

const WEAK_AREAS: WeakAreaListResponseDto = {
  data: [
    {
      id: 'wa-secure',
      domain: 'Secure Architectures',
      score: 41,
      accuracy: 44,
      meanConfidence: 0.6,
      responseCount: 18,
    },
  ],
  meta: { total: 1, page: 1, limit: 20 },
}

function buildReadiness(weeksToReady: number | null): ReadinessDetailResponseDto {
  return {
    data: {
      calibrated: true,
      score: 66,
      trajectory: weeksToReady === null ? null : { weeksToReady },
    },
  }
}

function buildSession(): SessionResponseDto {
  return {
    id: sessionId1,
    userCertificationId: enrollmentId,
    kind: 'study',
    status: 'completed',
    durationMinutes: 60,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
    lastItemIndex: 8,
    startedAt: '2026-06-20T09:00:00.000Z',
    endedAt: '2026-06-20T10:00:00.000Z',
  } as unknown as SessionResponseDto
}

const SESSION_LIST: SessionListResponseDto = {
  data: [buildSession()],
  meta: { total: 1, page: 1, limit: 3 },
}

function buildSummary(questionsAnswered: number, accuracy: number): SessionSummaryEnvelopeDto {
  return {
    data: {
      questionsAnswered,
      accuracy,
      domains: [{ domain: 'Secure Architectures', accuracy }],
      weakAreaDeltas: [],
      readiness: { before: 62, after: 66, delta: 4 } as unknown as SessionReadinessChangeDto,
      strongestQuestion: {
        responseId: 'strong-response-1',
        question: 'Which AWS feature enforces permission guardrails across an OU?',
      },
      weakestQuestion: {
        responseId: 'weak-response-1',
        question: 'Which storage class minimises cost for rarely accessed data?',
      },
      nextFocus: { domain: 'Secure Architectures' },
    },
  }
}

async function fulfilJson(route: Route, status: number, body: unknown): Promise<void> {
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
function mock(target: Target, pattern: RegExp, handler: Handler): void {
  void target.route(pattern, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
      return
    }
    await handler(route)
  })
}

function installAuthMocks(page: Page): void {
  const context = page.context()

  // Context-level safety net (page routes take precedence over context routes in Playwright).
  mock(context, /\/api\/v1\//, async (route) => {
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

function installCertDetailMocks(
  page: Page,
  options: { weeksToReady: number | null; questionsAnswered: number; accuracy: number },
): void {
  mock(page, new RegExp(`/api/v1/user-certifications/${enrollmentId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: ENROLLMENT, relationships: { weakAreas: { href: '' } } })
  })

  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/readiness(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, buildReadiness(options.weeksToReady))
    },
  )

  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/weak-areas(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, WEAK_AREAS)
    },
  )

  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/review(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, { items: [], meta: { dueCount: 0, total: 0 } })
    },
  )

  mock(page, new RegExp(`/api/v1/certifications/${certificationId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: CERTIFICATION, relationships: {} })
  })

  // Sessions list feeds both the Overview total-sessions count and the recent-session summary
  // fan-out (limited to RECENT_SESSIONS_LIMIT completed sessions).
  mock(page, /\/api\/v1\/sessions(\?|$)/, async (route) => {
    await fulfilJson(route, 200, SESSION_LIST)
  })

  mock(page, new RegExp(`/api/v1/sessions/${sessionId1}/summary$`), async (route) => {
    await fulfilJson(route, 200, buildSummary(options.questionsAnswered, options.accuracy))
  })
}

/**
 * Installs the route-mock surface for the cert-detail Overview page with a calibrated enrollment
 * whose `trajectory.weeksToReady` is the given count — used to assert the singular/plural
 * "exam-ready in ~N week(s)" trajectory copy (task 0.2).
 */
export function mockCertDetailTrajectory(page: Page, weeksToReady: number): void {
  installAuthMocks(page)
  installCertDetailMocks(page, { weeksToReady, questionsAnswered: 8, accuracy: 0.8 })
}

/**
 * Installs the route-mock surface for the cert-detail Overview page with a completed session whose
 * summary reports `questionsAnswered === 0` alongside a non-null `accuracy` of 0 — the exact shape
 * that reproduces the "0%" fabricated-accuracy bug (task 0.4).
 */
export function mockCertDetailZeroQuestions(page: Page): void {
  installAuthMocks(page)
  installCertDetailMocks(page, { weeksToReady: 3, questionsAnswered: 0, accuracy: 0 })
}
