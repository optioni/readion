import type { BrowserContext, Page, Route } from '@playwright/test'
import type {
  CertificationResponseDto,
  EnrollmentListResponseDto,
  EnrollmentResponseDto,
  MockExamListResponseDto,
  MockExamResponseDto,
  ReadinessDetailResponseDto,
  SessionListResponseDto,
  SessionReadinessChangeDto,
  SessionResponseDto,
  SessionSummaryEnvelopeDto,
  WeakAreaListResponseDto,
} from '../../src/api/model'

// Route-mock harness for the web-progress acceptance loop. Mirrors session-view-seed.ts and
// mock-exam-seed.ts: per design.md Test Boundaries this change drives the REAL apps/web against a
// FULLY MOCKED HTTP API so the progress charts, domain rows, trajectory callout, and session-history
// table are exercised deterministically without a running NestJS backend or Postgres. Everything
// below is served from Playwright `route` fulfil with envelope-shaped fixtures matching the
// committed Orval contract in apps/web/src/api.

const WEB_ORIGIN = 'http://127.0.0.1:3000'

// Cross-origin (web :3000 → api :3001) credentialed fetches require explicit CORS headers; a wildcard
// origin is rejected by the browser when `credentials: 'include'` is used (auth bootstrap + mutator).
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

export const PROGRESS_IDS = {
  userId: '77777777-7777-7777-7777-777777777777',
  // Primary enrollment: AWS SAA — four domains, calibrated. Most assertions target this enrollment.
  enrollmentId: 'a0a0a0a0-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  certificationId: 'c0c0c0c0-cccc-cccc-cccc-cccccccccccc',
  // Secondary enrollment: Azure — two distinct domains. Cert-switcher re-scopes the panels to this.
  enrollmentId2: 'b0b0b0b0-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  certificationId2: 'd0d0d0d0-dddd-dddd-dddd-dddddddddddd',
  // Three completed study sessions for the history table and summary fan-out (trend derivation).
  sessionId1: 'e1e1e1e1-eeee-eeee-eeee-eeeeeeeeeeee',
  sessionId2: 'e2e2e2e2-eeee-eeee-eeee-eeeeeeeeeeee',
  sessionId3: 'e3e3e3e3-eeee-eeee-eeee-eeeeeeeeeeee',
  // One submitted mock exam in the history table.
  mockExamId: '10101010-1010-1010-1010-101010101010',
  // Drill session produced from the "Drill my misses" action off a summary.
  drillSessionId: 'f1f1f1f1-ffff-ffff-ffff-ffffffffffff',
} as const

// A well-formed but non-owned enrollment id — every sub-resource returns 404.
export const NOT_OWNED_ENROLLMENT_ID = '00000000-0000-0000-0000-000000000000'

// The /users/me body satisfies both the auth bootstrap (id/email/emailVerified/displayTimezone)
// and the onboarding gate's profile read (role + sessionDefaults). Served as { data: <profile> }.
const PROFILE = {
  id: PROGRESS_IDS.userId,
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

// Primary certification: four domains so the domain-row count assertion is explicit (count = 4).
const CERTIFICATION1: CertificationResponseDto = {
  id: PROGRESS_IDS.certificationId,
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

// Secondary certification: two distinct domain names so the cert-switcher re-scope changes panel.
const CERTIFICATION2: CertificationResponseDto = {
  id: PROGRESS_IDS.certificationId2,
  name: 'Azure Administrator Associate',
  provider: 'Azure',
  code: 'AZ-104',
  domains: [
    { name: 'Manage Azure identities and governance', weight: 50 },
    { name: 'Implement and manage storage', weight: 50 },
  ],
  questionCount: 60,
  passingScore: 70,
  timeLimitMinutes: 120,
  state: 'live',
}

function buildEnrollmentResponse(
  id: string,
  certificationId: string,
  readinessScore: number | null,
): EnrollmentResponseDto {
  return {
    id,
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
    readinessScore,
  } as unknown as EnrollmentResponseDto
}

const ENROLLMENT1 = buildEnrollmentResponse(
  PROGRESS_IDS.enrollmentId,
  PROGRESS_IDS.certificationId,
  66,
)
const ENROLLMENT2 = buildEnrollmentResponse(
  PROGRESS_IDS.enrollmentId2,
  PROGRESS_IDS.certificationId2,
  54,
)

const ENROLLMENT_LIST: EnrollmentListResponseDto = {
  data: [ENROLLMENT1, ENROLLMENT2],
  meta: { total: 2, page: 1, limit: 20 },
}

// Calibrated readiness: drives the trajectory callout and provides the trend end-point (score=66).
const READINESS_CALIBRATED: ReadinessDetailResponseDto = {
  data: {
    calibrated: true,
    score: 66,
    trajectory: { weeksToReady: 3 },
  },
}

// Not-calibrated: drives the "not yet calibrated" empty state; trajectory callout must be absent.
const READINESS_NOT_CALIBRATED: ReadinessDetailResponseDto = {
  data: {
    calibrated: false,
    score: null,
    trajectory: null,
  },
}

// Two weak areas with data: Secure + Resilient. High-Performing and Cost-Optimized are absent
// (shown as "no data yet" in the domain rows).
// scores and accuracy are already 0-100 integers from the API (SCORE_MAX = 100).
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
    {
      id: 'wa-resilient',
      domain: 'Resilient Architectures',
      score: 68,
      accuracy: 70,
      meanConfidence: 0.65,
      responseCount: 12,
    },
  ],
  meta: { total: 2, page: 1, limit: 20 },
}

function buildSessionResponse(
  id: string,
  kind: string,
  startedAt: string,
  endedAt: string,
): SessionResponseDto {
  return {
    id,
    userCertificationId: PROGRESS_IDS.enrollmentId,
    kind,
    status: 'completed',
    durationMinutes: 60,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
    lastItemIndex: 8,
    startedAt,
    endedAt,
  } as unknown as SessionResponseDto
}

const SESSION1 = buildSessionResponse(
  PROGRESS_IDS.sessionId1,
  'study',
  '2026-06-01T09:00:00.000Z',
  '2026-06-01T10:00:00.000Z',
)
const SESSION2 = buildSessionResponse(
  PROGRESS_IDS.sessionId2,
  'study',
  '2026-06-10T09:00:00.000Z',
  '2026-06-10T10:00:00.000Z',
)
// Latest completed session — its summary carries weakAreaDeltas that drive the delta column.
const SESSION3 = buildSessionResponse(
  PROGRESS_IDS.sessionId3,
  'study',
  '2026-06-20T09:00:00.000Z',
  '2026-06-20T10:00:00.000Z',
)

const SESSION_LIST: SessionListResponseDto = {
  data: [SESSION1, SESSION2, SESSION3],
  meta: { total: 3, page: 1, limit: 20 },
}

function buildSummary(
  readinessAfter: number,
  accuracy: number,
  withDeltas: boolean,
): SessionSummaryEnvelopeDto {
  return {
    data: {
      questionsAnswered: 8,
      accuracy,
      domains: [
        { domain: 'Secure Architectures', accuracy: Number((accuracy + 0.05).toFixed(2)) },
        { domain: 'Resilient Architectures', accuracy: Number((accuracy - 0.05).toFixed(2)) },
      ],
      weakAreaDeltas: withDeltas
        ? [
            { domain: 'Secure Architectures', delta: 12 },
            { domain: 'Resilient Architectures', delta: -4 },
          ]
        : [],
      readiness: {
        before: readinessAfter - 7,
        after: readinessAfter,
        delta: 7,
      } as unknown as SessionReadinessChangeDto,
      strongestQuestion: {
        responseId: 'strong-response-1',
        question: 'Which AWS feature enforces permission guardrails across an OU?',
      },
      weakestQuestion: {
        responseId: 'weak-response-1',
        question: 'Which storage class minimises cost for rarely accessed data?',
      },
      nextFocus: { domain: 'Resilient Architectures' },
    },
  }
}

// Three ascending summaries drive the readiness trend line (55 → 62 → 66) and accuracy bars.
const SUMMARY1 = buildSummary(55, 0.6, false)
const SUMMARY2 = buildSummary(62, 0.7, false)
// The latest summary (session3) carries weakAreaDeltas — only these drive the per-domain delta column.
const SUMMARY3 = buildSummary(66, 0.75, true)

// One submitted mock exam alongside the three sessions (total history rows = 4).
const MOCK_EXAM_LIST: MockExamListResponseDto = {
  data: [
    {
      id: PROGRESS_IDS.mockExamId,
      userCertificationId: PROGRESS_IDS.enrollmentId,
      type: 'mock',
      status: 'submitted',
      generation: 'ready',
      startedAt: '2026-05-15T10:00:00.000Z',
      deadline: '2026-05-15T12:10:00.000Z',
      remainingSeconds: 0,
      score: 73,
      passed: true,
      domainBreakdown: {},
      questions: [],
    } as unknown as MockExamResponseDto,
  ],
  meta: { total: 1, page: 1, limit: 20 },
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

const {
  enrollmentId,
  enrollmentId2,
  certificationId,
  certificationId2,
  sessionId1,
  sessionId2,
  sessionId3,
  drillSessionId,
} = PROGRESS_IDS

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

function installProgressMocks(page: Page, readiness: ReadinessDetailResponseDto): void {
  // Enrollment list for the cert-switcher. Registered before the detail patterns so Playwright's
  // LIFO route ordering tries the more-specific detail patterns first.
  mock(page, /\/api\/v1\/user-certifications(\?|$)/, async (route) => {
    await fulfilJson(route, 200, ENROLLMENT_LIST)
  })

  // Enrollment detail for each enrolled cert (no UUID sub-path, only trailing ? or end).
  mock(page, new RegExp(`/api/v1/user-certifications/${enrollmentId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: ENROLLMENT1, relationships: { weakAreas: { href: '' } } })
  })
  mock(page, new RegExp(`/api/v1/user-certifications/${enrollmentId2}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: ENROLLMENT2, relationships: { weakAreas: { href: '' } } })
  })

  // Readiness (calibrated or not-calibrated, per the `readiness` param).
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/readiness(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, readiness)
    },
  )

  // Weak areas snapshot (drives the per-domain score column).
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/weak-areas(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, WEAK_AREAS)
    },
  )

  // Certification details: name + ordered domain list (drives the domain row list).
  mock(page, new RegExp(`/api/v1/certifications/${certificationId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: CERTIFICATION1, relationships: {} })
  })
  mock(page, new RegExp(`/api/v1/certifications/${certificationId2}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: CERTIFICATION2, relationships: {} })
  })

  // Sessions list for the history table (study/review rows, filtered by certificationId param).
  mock(page, /\/api\/v1\/sessions(\?|$)/, async (route) => {
    await fulfilJson(route, 200, SESSION_LIST)
  })

  // Per-session summary fan-out: readiness.after and accuracy derive the trend + accuracy charts.
  mock(page, new RegExp(`/api/v1/sessions/${sessionId1}/summary$`), async (route) => {
    await fulfilJson(route, 200, SUMMARY1)
  })
  mock(page, new RegExp(`/api/v1/sessions/${sessionId2}/summary$`), async (route) => {
    await fulfilJson(route, 200, SUMMARY2)
  })
  mock(page, new RegExp(`/api/v1/sessions/${sessionId3}/summary$`), async (route) => {
    await fulfilJson(route, 200, SUMMARY3)
  })

  // Drill action (reachable from the session-summary body embedded in the page).
  mock(page, /\/api\/v1\/sessions\/[0-9a-f-]{36}\/drill$/, async (route) => {
    await fulfilJson(route, 201, {
      data: {
        status: 'started',
        session: {
          id: drillSessionId,
          userCertificationId: enrollmentId,
          kind: 'drill',
          status: 'active',
        },
      },
    })
  })

  // Mock exam list: diagnostic/mock rows merged with session rows in the history table.
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/mock-exams(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, MOCK_EXAM_LIST)
    },
  )

  // Suppress-domain mutation: one-way mark-as-mastered for a domain.
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/review/suppress-domain$`),
    async (route) => {
      await fulfilJson(route, 200, { data: { suppressedCount: 5 } })
    },
  )
}

/**
 * Installs the full route-mock surface for the Progress page with a calibrated enrollment.
 * Auth-bootstrap endpoints are mocked so the app is authenticated without a real sign-in.
 * A context-level catch-all keeps any unmocked /api/v1 call from hitting the absent backend.
 */
export function mockProgressLoop(page: Page): void {
  installAuthMocks(page)
  installProgressMocks(page, READINESS_CALIBRATED)
}

/**
 * Installs the route-mock surface for the Progress page with a not-yet-calibrated enrollment.
 * Readiness returns calibrated: false, score: null, trajectory: null.
 */
export function mockProgressNotCalibrated(page: Page): void {
  installAuthMocks(page)
  installProgressMocks(page, READINESS_NOT_CALIBRATED)
}

/**
 * Installs auth bootstrap plus a 404 override for every sub-resource of the non-owned enrollment.
 * Used for the ownership/not-found acceptance test (task 0.5).
 */
export function mockProgressNotFound(page: Page): void {
  installAuthMocks(page)

  // Minimal cert-switcher support so the app shell can render even on the 404 path.
  mock(page, /\/api\/v1\/user-certifications(\?|$)/, async (route) => {
    await fulfilJson(route, 200, ENROLLMENT_LIST)
  })

  // Every sub-resource of the non-owned enrollment id returns 404.
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${NOT_OWNED_ENROLLMENT_ID}`),
    async (route) => {
      await fulfilJson(route, 404, {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'UserCertification not found',
      })
    },
  )
}
