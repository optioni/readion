import type { BrowserContext, Page, Route } from '@playwright/test'
import type {
  DrillResultEnvelopeDto,
  DrillResultResponseDtoSession,
  MockExamDetailResponseDto,
  MockExamQuestionResponseDto,
  MockExamResponseDto,
  SessionReadinessChangeDto,
  SessionSummaryEnvelopeDto,
} from '../../src/api/model'

// Route-mock harness for the web-mock-exam acceptance loop. Mirrors session-view-seed.ts: per design.md
// Test Boundaries this change drives the REAL apps/web against a FULLY MOCKED HTTP API so the polling
// stream-in, the wall-clock countdown, and the submit/expiry envelopes are exercised deterministically
// without a running NestJS backend or Postgres. Everything below is served from Playwright `route`
// fulfil with envelope-shaped fixtures matching the committed Orval contract in apps/web/src/api.
//
// IMPORTANT: generation stream-in is POLLING, not SSE. The GET /mock-exams/:id handler returns a
// SCRIPTED SEQUENCE across successive calls (preparing 20 → 43 → 65, then ready, then terminal once
// submitted), which the page observes via a vue-query refetchInterval while `generation === 'preparing'`.

const WEB_ORIGIN = 'http://127.0.0.1:3000'

// Cross-origin (web :3000 → api :3001) credentialed fetches require explicit CORS headers; a wildcard
// origin is rejected by the browser when `credentials: 'include'` is used (auth bootstrap + mutator).
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

export const MOCK_EXAM_IDS = {
  userId: '77777777-7777-7777-7777-777777777777',
  enrollmentId: '11111111-1111-1111-1111-111111111111',
  certificationId: '33333333-3333-3333-3333-333333333333',
  examId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  cronRaceExamId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  drillSessionId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  strongestResponseId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  weakestResponseId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
} as const

const TOTAL_QUESTIONS = 65
// Successive poll lengths while `generation === 'preparing'`; the next GET after these flips to ready.
const PREPARE_COUNTS = [20, 43, 65] as const

const DOMAINS = [
  'Resilient Architectures',
  'Secure Architectures',
  'High-Performing Architectures',
  'Cost-Optimized Architectures',
] as const

// The /users/me body satisfies the auth bootstrap (id/email/emailVerified/displayTimezone) and the
// onboarding gate's profile read (role + sessionDefaults). Served as { data: <profile> }.
const PROFILE = {
  id: MOCK_EXAM_IDS.userId,
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

// Question 0 carries meaningful content the acceptance test asserts against; the rest are generic so the
// nav can render all 65 squares. In the terminal attempt the reveal fields (correctAnswer/explanation/
// citations) and a deterministic userAnswer mix are baked in for review mode.
function questionOptions(index: number): string[] {
  if (index === 0) {
    return [
      'Enable cross-zone load balancing',
      'Convert the instance to a Multi-AZ deployment',
      'Add a cross-region read replica',
      'Increase the instance size',
    ]
  }
  const n = index + 1
  return [`Option A for Q${n}`, `Option B for Q${n}`, `Option C for Q${n}`, `Option D for Q${n}`]
}

function questionStem(index: number): string {
  if (index === 0) {
    return 'Which change adds Availability Zone redundancy to a single-AZ RDS database?'
  }
  return `Sample mock-exam question ${index + 1}?`
}

type QuestionState = {
  index: number
  total: number
  terminal: boolean
  answers: Map<number, string>
}

function buildQuestion({ index, terminal, answers }: QuestionState): MockExamQuestionResponseDto {
  const options = questionOptions(index)
  const base = {
    id: `q-${index}`,
    question: questionStem(index),
    options,
    domain: DOMAINS[index % DOMAINS.length],
  }

  if (!terminal) {
    return {
      ...base,
      userAnswer: answers.get(index) ?? null,
    } as unknown as MockExamQuestionResponseDto
  }

  // Terminal reveal: Q0 answered incorrectly, Q1 answered correctly, the rest left unanswered (skipped).
  const correctAnswer = options[1]
  let userAnswer: string | null = null
  if (index === 0) {
    userAnswer = options[2]
  } else if (index === 1) {
    userAnswer = options[1]
  }

  return {
    ...base,
    userAnswer,
    correctAnswer,
    explanation:
      index === 0
        ? 'Multi-AZ creates a synchronous standby in a second Availability Zone and fails over automatically; a cross-region read replica is asynchronous and does not provide AZ-level HA.'
        : `Explanation for question ${index + 1}: option B is correct.`,
    citations:
      index === 0
        ? [
            {
              chunkId: 'chunk-rds-multiaz-001',
              text: 'Amazon RDS Multi-AZ deployments provide enhanced availability and durability via a synchronous standby replica.',
            },
          ]
        : [{ chunkId: `chunk-${index}`, text: `Source span for question ${index + 1}.` }],
  } as unknown as MockExamQuestionResponseDto
}

function buildQuestions(
  count: number,
  opts: { terminal: boolean; answers: Map<number, string> },
): MockExamQuestionResponseDto[] {
  return Array.from({ length: count }, (_unused, index) =>
    buildQuestion({ index, total: count, terminal: opts.terminal, answers: opts.answers }),
  )
}

// Orval generates `{ [key: string]: unknown }` for the nullable/enum scalar columns (type/status/
// generation/deadline/score/passed/userAnswer), so each runtime fixture literal is cast to the DTO once
// — the established session-view-seed.ts pattern.
function envelope(data: MockExamResponseDto): MockExamDetailResponseDto {
  return { data }
}

function buildPreparing(count: number): MockExamDetailResponseDto {
  return envelope({
    id: MOCK_EXAM_IDS.examId,
    userCertificationId: MOCK_EXAM_IDS.enrollmentId,
    type: 'mock',
    status: 'in_progress',
    generation: 'preparing',
    startedAt: null,
    deadline: null,
    remainingSeconds: null,
    score: null,
    passed: null,
    domainBreakdown: {},
    questions: buildQuestions(count, { terminal: false, answers: new Map() }),
  } as unknown as MockExamResponseDto)
}

function buildReady(answers: Map<number, string>): MockExamDetailResponseDto {
  return envelope({
    id: MOCK_EXAM_IDS.examId,
    userCertificationId: MOCK_EXAM_IDS.enrollmentId,
    type: 'mock',
    status: 'in_progress',
    generation: 'ready',
    startedAt: '2026-06-29T10:00:00.000Z',
    deadline: '2026-06-29T11:47:23.000Z',
    remainingSeconds: 6443,
    score: null,
    passed: null,
    domainBreakdown: {},
    questions: buildQuestions(TOTAL_QUESTIONS, { terminal: false, answers }),
  } as unknown as MockExamResponseDto)
}

const TERMINAL_DOMAIN_BREAKDOWN = {
  'Resilient Architectures': { correct: 14, total: 18, accuracy: 0.78 },
  'Secure Architectures': { correct: 11, total: 16, accuracy: 0.69 },
  'High-Performing Architectures': { correct: 12, total: 16, accuracy: 0.75 },
  'Cost-Optimized Architectures': { correct: 9, total: 15, accuracy: 0.6 },
}

function buildTerminal(
  status: 'submitted' | 'expired',
  answers: Map<number, string>,
): MockExamDetailResponseDto {
  return envelope({
    id: status === 'expired' ? MOCK_EXAM_IDS.cronRaceExamId : MOCK_EXAM_IDS.examId,
    userCertificationId: MOCK_EXAM_IDS.enrollmentId,
    type: 'mock',
    status,
    generation: 'ready',
    startedAt: '2026-06-29T10:00:00.000Z',
    deadline: '2026-06-29T11:47:23.000Z',
    remainingSeconds: 0,
    score: 73,
    passed: true,
    domainBreakdown: TERMINAL_DOMAIN_BREAKDOWN,
    questions: buildQuestions(TOTAL_QUESTIONS, { terminal: true, answers }),
  } as unknown as MockExamResponseDto)
}

// Reuses the SessionSummaryResponse envelope shape from session-view-seed.ts so the results scene's
// reused SessionSummaryBody renders readiness/weak-area/strongest-weakest/drill from one fixture.
const SUMMARY: SessionSummaryEnvelopeDto = {
  data: {
    questionsAnswered: 65,
    accuracy: 0.73,
    domains: [
      { domain: 'Resilient Architectures', accuracy: 0.78 },
      { domain: 'Cost-Optimized Architectures', accuracy: 0.6 },
    ],
    weakAreaDeltas: [
      { domain: 'Resilient Architectures', delta: 0.08 },
      { domain: 'Cost-Optimized Architectures', delta: -0.03 },
    ],
    readiness: { before: 70, after: 74, delta: 4 } as unknown as SessionReadinessChangeDto,
    strongestQuestion: {
      responseId: MOCK_EXAM_IDS.strongestResponseId,
      question: 'Which change adds Availability Zone redundancy to a single-AZ RDS database?',
    },
    weakestQuestion: {
      responseId: MOCK_EXAM_IDS.weakestResponseId,
      question: 'Which storage class minimises cost for rarely accessed, long-lived data?',
    },
    nextFocus: { domain: 'Cost-Optimized Architectures' },
  },
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

const { enrollmentId, certificationId, examId, cronRaceExamId, drillSessionId } = MOCK_EXAM_IDS

/**
 * Installs the full route-mock surface for the mock-exam loop and returns the fixtures. Auth-bootstrap
 * endpoints are mocked so the app is authenticated without a real sign-in. A context-level catch-all
 * keeps any unforeseen /api/v1 call from hitting the (absent) backend; page-level mocks always win.
 */
export function mockMockExamLoop(page: Page): {
  ids: typeof MOCK_EXAM_IDS
  summary: SessionSummaryEnvelopeDto
} {
  const context = page.context()
  const answers = new Map<number, string>()
  let prepareStage = 0
  let submitted = false
  // The 409 cron-race variant: once the cron has expired the attempt, GET returns the terminal attempt.
  let cronExpired = false

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

  // --- Optional certification read (omitted by default; safe if the page joins it) ---
  mock(page, new RegExp(`/api/v1/certifications/${certificationId}(\\?|$)`), async (route) => {
    await fulfilJson(route, 200, {
      data: {
        id: certificationId,
        name: 'AWS Certified Solutions Architect — Associate',
        provider: 'AWS',
        code: 'SAA-C03',
        domains: DOMAINS.map((name) => ({ name, weight: 25 })),
        questionCount: TOTAL_QUESTIONS,
        passingScore: 72,
        timeLimitMinutes: 130,
        state: 'live',
      },
      relationships: {},
    })
  })

  // --- Cron-race variant attempt: ready → submit 409 → expired terminal on refetch ---
  mock(page, new RegExp(`/api/v1/mock-exams/${cronRaceExamId}/submit$`), async (route) => {
    cronExpired = true
    await fulfilJson(route, 409, {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Attempt already terminated',
    })
  })
  mock(page, new RegExp(`/api/v1/mock-exams/${cronRaceExamId}(\\?|$)`), async (route) => {
    if (cronExpired) {
      await fulfilJson(route, 200, buildTerminal('expired', answers))
      return
    }
    await fulfilJson(route, 200, buildReady(answers))
  })

  // --- Answer persistence by ZERO-BASED index ---
  // The Orval mockExamControllerSaveAnswer client does not serialize a body param; the app supplies the
  // `{ answer }` body via request options. We assert the path index is a zero-based integer, record the
  // answer (parsing the body when present), and echo the updated attempt.
  mock(page, /\/api\/v1\/mock-exams\/[0-9a-f-]{36}\/answers\/(\d+)$/, async (route) => {
    const path = new URL(route.request().url()).pathname
    const rawIndex = path.split('/').pop() ?? ''
    const index = Number(rawIndex)
    if (!Number.isInteger(index) || index < 0 || String(index) !== rawIndex) {
      await fulfilJson(route, 400, { title: 'Bad index', status: 400 })
      return
    }
    const postData = route.request().postData()
    if (postData) {
      try {
        const body = JSON.parse(postData) as { answer?: unknown }
        if (typeof body.answer === 'string') {
          answers.set(index, body.answer)
        }
      } catch {
        // Body shape is owned by the implementer group; the harness only needs the index to be valid.
      }
    }
    await fulfilJson(route, 200, buildReady(answers))
  })

  // --- Submit (terminal) ---
  mock(page, new RegExp(`/api/v1/mock-exams/${examId}/submit$`), async (route) => {
    submitted = true
    await fulfilJson(route, 200, buildTerminal('submitted', answers))
  })

  // --- Summary + drill (post-submission, reused SessionSummaryBody) ---
  mock(page, /\/api\/v1\/mock-exams\/[0-9a-f-]{36}\/summary$/, async (route) => {
    await fulfilJson(route, 200, SUMMARY)
  })
  mock(page, /\/api\/v1\/mock-exams\/[0-9a-f-]{36}\/drill$/, async (route) => {
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
    await fulfilJson(route, 200, body)
  })

  // --- Main attempt load / poll / resume / terminal-after-submit ---
  // Scripted sequence: preparing (20 → 43 → 65), then ready, then terminal once submitted. Keyed last so
  // the more specific /submit, /answers, /summary, /drill routes above win.
  mock(page, new RegExp(`/api/v1/mock-exams/${examId}(\\?|$)`), async (route) => {
    if (submitted) {
      await fulfilJson(route, 200, buildTerminal('submitted', answers))
      return
    }
    if (prepareStage < PREPARE_COUNTS.length) {
      const count = PREPARE_COUNTS[prepareStage]
      prepareStage += 1
      await fulfilJson(route, 200, buildPreparing(count))
      return
    }
    await fulfilJson(route, 200, buildReady(answers))
  })

  return { ids: MOCK_EXAM_IDS, summary: SUMMARY }
}
