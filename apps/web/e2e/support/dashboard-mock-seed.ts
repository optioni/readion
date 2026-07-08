import type { BrowserContext, Page, Route } from '@playwright/test'
import type { CertificationListResponseDto, EnrollmentListResponseDto } from '../../src/api/model'

// Route-mock harness for the fix-learner-surfaces-fidelity outer-loop RED test (task 0.5,
// dashboard anchors). support/dashboard-seed.ts drives the REAL NestJS API + Postgres, which is
// the right harness for the dashboard's data-shape acceptance tests — but this sandbox's ad-hoc
// running API instance has a CORS_ORIGIN mismatch against the Playwright web server's origin
// (a pre-existing local-environment limitation, not something this change introduces or should
// fix), so the design-fidelity anchors below use a fully mocked HTTP API instead, matching the
// route-mock pattern already used by support/progress-seed.ts and support/session-view-seed.ts.

const WEB_ORIGIN = 'http://127.0.0.1:3000'

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

export const DASHBOARD_MOCK_IDS = {
  userId: '11111111-dddd-dddd-dddd-dddddddddddd',
  heroEnrollmentId: '22222222-dddd-dddd-dddd-dddddddddddd',
  heroCertificationId: '33333333-dddd-dddd-dddd-dddddddddddd',
} as const

const { heroEnrollmentId, heroCertificationId } = DASHBOARD_MOCK_IDS

export const HERO_CERT_NAME = 'AWS Certified Solutions Architect — Associate'

const PROFILE = {
  id: DASHBOARD_MOCK_IDS.userId,
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

const CERTIFICATIONS: CertificationListResponseDto = {
  data: [
    {
      id: heroCertificationId,
      name: HERO_CERT_NAME,
      provider: 'AWS',
      code: 'SAA-C03',
      domains: [{ name: 'Secure Architectures', weight: 100 }],
      questionCount: 65,
      passingScore: 72,
      timeLimitMinutes: 130,
      state: 'live',
    },
  ],
  meta: { total: 1, page: 1, limit: 20 },
}

// A single calibrated (42% — low readiness) enrollment: the SPEC-mandated hero.
const ENROLLMENT_LIST: EnrollmentListResponseDto = {
  data: [
    {
      id: heroEnrollmentId,
      certificationId: heroCertificationId,
      status: 'active',
      enrolledAt: '2026-01-15T00:00:00.000Z',
      sessionDefaults: {
        duration: 60,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        focusArea: 'auto',
        learningStyle: 'weak-area-focus',
      },
      readinessScore: 42,
    },
  ],
  meta: { total: 1, page: 1, limit: 20 },
} as unknown as EnrollmentListResponseDto

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

function mock(target: Target, pattern: RegExp, handler: Handler): void {
  void target.route(pattern, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
      return
    }
    await handler(route)
  })
}

/**
 * Installs the route-mock surface for the dashboard with a single calibrated (42%) enrollment,
 * which the SPEC promotes to the hero slot — used to assert the shared PageHeader and the hero
 * card's cert-name-as-heading hierarchy (task 0.5).
 */
export function mockDashboardHero(page: Page): void {
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

  // Onboarding gate + dashboard both read the active enrollment list and the certification catalog.
  mock(page, /\/api\/v1\/user-certifications(\?|$)/, async (route) => {
    await fulfilJson(route, 200, ENROLLMENT_LIST)
  })
  mock(page, /\/api\/v1\/certifications(\?|$)/, async (route) => {
    await fulfilJson(route, 200, CERTIFICATIONS)
  })

  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${heroEnrollmentId}/weak-areas(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, { data: [], meta: { total: 0, page: 1, limit: 20 } })
    },
  )
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${heroEnrollmentId}/review(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, { items: [], meta: { dueCount: 0, total: 0 } })
    },
  )
  mock(page, /\/api\/v1\/sessions(\?|$)/, async (route) => {
    await fulfilJson(route, 200, { data: [], meta: { total: 0, page: 1, limit: 20 } })
  })
}
