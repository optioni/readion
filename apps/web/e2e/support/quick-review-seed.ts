import type { BrowserContext, Page, Route } from '@playwright/test'
import type {
  CertificationResponseDto,
  DrillResultEnvelopeDto,
  DrillResultResponseDtoSession,
  SessionDetailResponseDto,
  SessionItemResponseDto,
  SessionReadinessChangeDto,
  SessionResponseDto,
  SessionSummaryEnvelopeDto,
} from '../../src/api/model'

// Route-mock harness for the web-progress quick-review acceptance loop. Mirrors the pattern in
// session-view-seed.ts and mock-exam-seed.ts: per design.md Test Boundaries this change drives the
// REAL apps/web against a FULLY MOCKED HTTP API. The review loop at /user-certifications/:id/review
// renders queue entry → quiz/confidence loop → completion breakdown — all on the same page, with
// no SSE (the session items are fetched once after review/start via sessionsControllerDetail).

const WEB_ORIGIN = 'http://127.0.0.1:3000'

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

// Reference "now" for the deterministic overdue-note math (fix-review-page-fidelity). The e2e
// pins the browser clock to this instant via `page.clock.setFixedTime()` before navigating, so the
// GREEN ReviewHeader/ReviewQueueEntry's client-side `dueAt` vs "now" overdue calculation is stable
// across runs. See REVIEW_QUEUE_RESPONSE below for how the seeded `dueAt` values line up against it.
export const REVIEW_REFERENCE_NOW = '2026-07-01T09:00:00.000Z'

export const REVIEW_IDS = {
  userId: '77777777-7777-7777-7777-777777777777',
  enrollmentId: 'a0a0a0a0-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  certificationId: 'c0c0c0c0-cccc-cccc-cccc-cccccccccccc',
  reviewSessionId: 'f0f0f0f0-ffff-ffff-ffff-ffffffffffff',
  drillSessionId: 'f2f2f2f2-ffff-ffff-ffff-ffffffffffff',
  questionId: '20202020-2020-2020-2020-202020202020',
  reviewItemId1: '31313131-3131-3131-3131-313131313131',
  reviewItemId2: '32323232-3232-3232-3232-323232323232',
  reviewItemId3: '33333333-3333-3333-3333-333333333333',
  reviewItemId4: '34343434-3434-3434-3434-343434343434',
  reviewItemId5: '35353535-3535-3535-3535-353535353535',
} as const

const PROFILE = {
  id: REVIEW_IDS.userId,
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
  id: REVIEW_IDS.certificationId,
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

// Five due review items across two domains (Secure: 3, Resilient: 2). Drives the queue-entry
// scene: review-due-count = "5" and two domain rows in review-domain-breakdown.
//
// Overdue math (fix-review-page-fidelity): against REVIEW_REFERENCE_NOW (2026-07-01T09:00:00Z),
// items 1/2/5 are dueAt 2026-06-29T00:00:00Z — 57h earlier, floor(57/24) = 2 whole days overdue.
// Items 3/4 are dueAt 2026-07-01T00:00:00Z — only 9h earlier, floor(9/24) = 0 days, i.e. NOT
// overdue (< 1 day). So 3 of the 5 items are overdue by exactly 2 days, matching the spec
// scenario's "some overdue by 2 days" and producing the deterministic note
// "3 items overdue by 2 days".
const REVIEW_QUEUE_RESPONSE = {
  items: [
    {
      id: REVIEW_IDS.reviewItemId1,
      userCertificationId: REVIEW_IDS.enrollmentId,
      anchorChunkId: 'chunk-scp-001',
      domain: 'Secure Architectures',
      box: 1,
      state: 'due',
      dueAt: '2026-06-29T00:00:00.000Z',
      lastReviewedAt: null,
    },
    {
      id: REVIEW_IDS.reviewItemId2,
      userCertificationId: REVIEW_IDS.enrollmentId,
      anchorChunkId: 'chunk-iam-001',
      domain: 'Secure Architectures',
      box: 2,
      state: 'due',
      dueAt: '2026-06-29T00:00:00.000Z',
      lastReviewedAt: '2026-06-22T09:00:00.000Z',
    },
    {
      id: REVIEW_IDS.reviewItemId3,
      userCertificationId: REVIEW_IDS.enrollmentId,
      anchorChunkId: 'chunk-vpc-001',
      domain: 'Secure Architectures',
      box: 1,
      state: 'due',
      dueAt: '2026-07-01T00:00:00.000Z',
      lastReviewedAt: null,
    },
    {
      id: REVIEW_IDS.reviewItemId4,
      userCertificationId: REVIEW_IDS.enrollmentId,
      anchorChunkId: 'chunk-rds-001',
      domain: 'Resilient Architectures',
      box: 1,
      state: 'due',
      dueAt: '2026-07-01T00:00:00.000Z',
      lastReviewedAt: null,
    },
    {
      id: REVIEW_IDS.reviewItemId5,
      userCertificationId: REVIEW_IDS.enrollmentId,
      anchorChunkId: 'chunk-elb-001',
      domain: 'Resilient Architectures',
      box: 2,
      state: 'due',
      dueAt: '2026-06-29T00:00:00.000Z',
      lastReviewedAt: '2026-06-21T09:00:00.000Z',
    },
  ],
  meta: { dueCount: 5, total: 8 },
}

// Enrollment detail — needed by the GREEN ReviewHeader to resolve enrollmentId → certificationId
// so it can fetch /api/v1/certifications/:certificationId for the cert-code chip ("SAA-C03").
const ENROLLMENT_DETAIL = {
  id: REVIEW_IDS.enrollmentId,
  userId: REVIEW_IDS.userId,
  certificationId: REVIEW_IDS.certificationId,
  targetDate: null,
  readinessScore: 62,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
}

// The single quiz item in the review session. One item keeps the test loop minimal: answer once,
// continue, and the completion summary appears.
const REVIEW_QUIZ_CONTENT = JSON.stringify({
  questionId: REVIEW_IDS.questionId,
  question: 'Which S3 storage class minimises cost for long-lived, infrequently accessed objects?',
  options: [
    'S3 Standard',
    'S3 Standard-IA',
    'S3 Glacier Flexible Retrieval',
    'S3 Intelligent-Tiering',
  ],
  format: 'multiple_choice',
})

const REVIEW_ITEM: SessionItemResponseDto = {
  index: 0,
  type: 'quiz',
  content: REVIEW_QUIZ_CONTENT,
  completed: false,
  sourceChunkIds: ['chunk-s3-glacier-001'],
  supportingSpans: ['AWS S3 Storage Classes Documentation'],
}

function buildReviewSessionDetail(
  completed: boolean,
  items: SessionItemResponseDto[],
): SessionDetailResponseDto {
  // Orval generates `{ [key: string]: unknown }` for nullable/enum scalar columns (kind/status/
  // focusArea/endedAt), so the fixture literal is cast to the DTO once — the established pattern.
  const data = {
    id: REVIEW_IDS.reviewSessionId,
    userCertificationId: REVIEW_IDS.enrollmentId,
    kind: 'review',
    status: completed ? 'completed' : 'active',
    durationMinutes: 5,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
    lastItemIndex: completed ? items.length : 0,
    startedAt: '2026-06-29T09:00:00.000Z',
    endedAt: completed ? '2026-06-29T09:05:00.000Z' : null,
    items,
  } as unknown as SessionResponseDto
  return {
    data,
    relationships: { items: { data: items.map((item) => ({ index: item.index })) } },
  }
}

// The quiz submit response: correct answer chosen. The frontend colours the chosen option and shows
// the continue affordance.
const QUIZ_SUBMIT_RESULT = {
  id: 'response-review-1',
  correct: true,
  answer: 'S3 Glacier Flexible Retrieval',
  confidence: 4,
  timeTakenMs: 5200,
  userCertificationId: REVIEW_IDS.enrollmentId,
}

// Completion summary for the review session (reused by the reused SessionSummaryBody component).
const REVIEW_SUMMARY: SessionSummaryEnvelopeDto = {
  data: {
    questionsAnswered: 5,
    accuracy: 0.8,
    domains: [
      { domain: 'Secure Architectures', accuracy: 0.83 },
      { domain: 'Resilient Architectures', accuracy: 0.75 },
    ],
    weakAreaDeltas: [
      { domain: 'Secure Architectures', delta: 9 },
      { domain: 'Resilient Architectures', delta: 5 },
    ],
    readiness: {
      before: 62,
      after: 66,
      delta: 4,
    } as unknown as SessionReadinessChangeDto,
    strongestQuestion: {
      responseId: 'strong-review-1',
      question:
        'Which S3 storage class minimises cost for long-lived, infrequently accessed objects?',
    },
    weakestQuestion: {
      responseId: 'weak-review-1',
      question: 'Which feature enforces permission guardrails across all accounts in an OU?',
    },
    nextFocus: { domain: 'Secure Architectures' },
  },
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

function mock(target: Target, pattern: RegExp, handler: Handler): void {
  void target.route(pattern, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
      return
    }
    await handler(route)
  })
}

const { enrollmentId, certificationId, reviewSessionId, questionId, drillSessionId } = REVIEW_IDS

/**
 * Installs the full route-mock surface for the quick-review happy path. Five items are due across
 * two domains. "Start review" returns a started session with one quiz item. Auth-bootstrap endpoints
 * are mocked so the app is authenticated without a real sign-in.
 */
export function mockReviewLoop(page: Page): void {
  const context = page.context()

  // Context-level safety net (page routes take precedence over context routes in Playwright).
  mock(context, /\/api\/v1\//, async (route) => {
    if (route.request().method() === 'GET') {
      await fulfilJson(route, 200, { data: [], meta: { total: 0, page: 1, limit: 20 } })
      return
    }
    await fulfilJson(route, 200, { data: {} })
  })

  // --- Auth bootstrap ---
  mock(page, /\/api\/v1\/auth\/refresh$/, async (route) => {
    await fulfilJson(route, 200, { data: { accessToken: 'mock-access-token' } })
  })
  mock(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
    await fulfilJson(route, 200, { data: PROFILE })
  })

  // --- Certification detail (cert chip + domain names) ---
  mock(page, new RegExp(`/api/v1/certifications/${certificationId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: CERTIFICATION, relationships: {} })
  })

  // --- Enrollment detail (cert-code chip resolution: enrollmentId → certificationId) ---
  mock(page, new RegExp(`/api/v1/user-certifications/${enrollmentId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: ENROLLMENT_DETAIL, relationships: {} })
  })

  // --- Review queue (drives queue-entry scene: due count + per-domain breakdown) ---
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/review(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, REVIEW_QUEUE_RESPONSE)
    },
  )

  // --- Start review: returns a started review session ---
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/review/start$`),
    async (route) => {
      await fulfilJson(route, 200, {
        data: {
          status: 'started',
          session: {
            id: reviewSessionId,
            userCertificationId: enrollmentId,
            kind: 'review',
            status: 'active',
            durationMinutes: 5,
            startedAt: '2026-06-29T09:00:00.000Z',
          },
        },
      })
    },
  )

  // --- Session detail with items (fetched after start via sessionsControllerDetail) ---
  const itemsDone = new Set<number>()
  mock(page, new RegExp(`/api/v1/sessions/${reviewSessionId}(\\?|$)`), async (route) => {
    const reflected = [{ ...REVIEW_ITEM, completed: itemsDone.has(0) }]
    await fulfilJson(route, 200, buildReviewSessionDetail(itemsDone.has(0), reflected))
  })

  // --- Item completion (marks the item done, enabling the auto-end detection) ---
  mock(
    page,
    new RegExp(`/api/v1/sessions/${reviewSessionId}/items/(\\d+)/complete$`),
    async (route) => {
      const index = Number(new URL(route.request().url()).pathname.split('/').at(-2))
      itemsDone.add(index)
      const reflected = [{ ...REVIEW_ITEM, completed: itemsDone.has(0) }]
      await fulfilJson(route, 200, buildReviewSessionDetail(true, reflected))
    },
  )

  // --- End session (called when the last item is completed) ---
  mock(page, new RegExp(`/api/v1/sessions/${reviewSessionId}/end$`), async (route) => {
    itemsDone.add(0)
    await fulfilJson(
      route,
      200,
      buildReviewSessionDetail(true, [{ ...REVIEW_ITEM, completed: true }]),
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
        correctOption: 'c',
        explanation:
          'S3 Glacier Flexible Retrieval offers the lowest storage cost for objects accessed roughly once or twice per year, with retrieval times of minutes to hours.',
        citations: ['AWS S3 Storage Classes Documentation'],
      },
    })
  })

  // --- Completion summary (reused SessionSummaryBody) ---
  mock(page, new RegExp(`/api/v1/sessions/${reviewSessionId}/summary$`), async (route) => {
    await fulfilJson(route, 200, REVIEW_SUMMARY)
  })

  // --- Drill my misses ---
  mock(page, new RegExp(`/api/v1/sessions/${reviewSessionId}/drill$`), async (route) => {
    const body: DrillResultEnvelopeDto = {
      data: {
        status: 'started',
        session: {
          id: drillSessionId,
          userCertificationId: enrollmentId,
          kind: 'drill',
          status: 'active',
        } as unknown as DrillResultResponseDtoSession,
      },
    }
    await fulfilJson(route, 201, body)
  })
}

/**
 * Installs the route-mock surface for the self-grade flashcard loop. Five items are due across two
 * domains. Auth-bootstrap, certification detail, and review queue are mocked so the queue-entry
 * scene renders correctly. The grade endpoint fulfils 200 so each card advances without a real API.
 */
export function mockReviewSelfGrade(page: Page): void {
  const context = page.context()

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
  mock(page, new RegExp(`/api/v1/certifications/${certificationId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: CERTIFICATION, relationships: {} })
  })

  // --- Enrollment detail (cert-code chip resolution: enrollmentId → certificationId) ---
  mock(page, new RegExp(`/api/v1/user-certifications/${enrollmentId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: ENROLLMENT_DETAIL, relationships: {} })
  })

  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/review(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, REVIEW_QUEUE_RESPONSE)
    },
  )

  // Start review: the single "Start review" launches the self-grade flow, but it still opens the
  // run loop via enrollmentReviewControllerStart, which returns a started review session.
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/review/start$`),
    async (route) => {
      await fulfilJson(route, 200, {
        data: {
          status: 'started',
          session: {
            id: reviewSessionId,
            userCertificationId: enrollmentId,
            kind: 'review',
            status: 'active',
            durationMinutes: 5,
            startedAt: '2026-06-29T09:00:00.000Z',
          },
        },
      })
    },
  )

  // Grade endpoint — called once per item as the user taps a grade button.
  mock(page, /\/api\/v1\/review-items\/[0-9a-f-]+\/grade$/, async (route) => {
    await fulfilJson(route, 200, { data: {} })
  })
}

/**
 * Installs the route-mock surface for the all-caught-up empty state. The review queue returns zero
 * due items, so the review page renders the `review-all-caught-up` empty state without a start CTA.
 */
export function mockReviewAllCaughtUp(page: Page): void {
  const context = page.context()

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
  mock(page, new RegExp(`/api/v1/certifications/${certificationId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: CERTIFICATION, relationships: {} })
  })

  // --- Enrollment detail (cert-code chip resolution: enrollmentId → certificationId) ---
  mock(page, new RegExp(`/api/v1/user-certifications/${enrollmentId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, { data: ENROLLMENT_DETAIL, relationships: {} })
  })

  // Zero due items — triggers the all-caught-up empty state.
  mock(
    page,
    new RegExp(`/api/v1/user-certifications/${enrollmentId}/review(\\?|$)`),
    async (route) => {
      await fulfilJson(route, 200, { items: [], meta: { dueCount: 0, total: 3 } })
    },
  )
}
