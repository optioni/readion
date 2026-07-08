import type { BrowserContext, Page, Route } from '@playwright/test'

// Route-mock harness for the web-admin acceptance loop. Mirrors settings-seed.ts: per design.md Test
// Boundaries this change is frontend-only and drives the REAL apps/web against a FULLY MOCKED HTTP API
// (Playwright `route` fulfil) so the admin console (Users, Audit Log, Sources, Certifications setup +
// re-verification, Review queue) and the /admin role gate are exercised deterministically without a
// running NestJS backend or Postgres. Every endpoint below is a real Orval-consumed method the admin
// pages call; the data shapes match the authoritative contract in design.md.

const WEB_ORIGIN = 'http://127.0.0.1:3000'

// Cross-origin (web :3000 → api :3001) credentialed fetches require explicit CORS headers; a wildcard
// origin is rejected by the browser when `credentials: 'include'` is used (auth bootstrap + mutator).
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': WEB_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

// The only admin in the fixture — demoting it returns 409 (last admin). Also the signed-in user when
// seeded with role 'admin'.
export const ADMIN_USER_ID = 'a0000000-0000-0000-0000-000000000001'
// A plain user that the promote flow elevates to admin.
export const PROMOTE_USER_ID = 'a0000000-0000-0000-0000-000000000002'
const OTHER_USER_ID = 'a0000000-0000-0000-0000-000000000003'

// A live certification whose sources are managed and which is due for re-verification.
export const CERT_ID = 'c0000000-0000-0000-0000-000000000001'
// The DRAFT created by the cert-setup wizard.
const NEW_CERT_ID = 'c0000000-0000-0000-0000-000000000002'

export const SOURCE_ENABLED_ID = 'd0000000-0000-0000-0000-000000000001'
const SOURCE_DISABLED_ID = 'd0000000-0000-0000-0000-000000000002'

const EXTRACT_JOB_ID = 'e0000000-0000-0000-0000-000000000001'
const REINGEST_JOB_ID = 'e0000000-0000-0000-0000-000000000002'

// Pending quarantined items the Review queue lists and resolves.
export const QUARANTINE_ITEM_A_ID = 'f0000000-0000-0000-0000-000000000001'
export const QUARANTINE_ITEM_B_ID = 'f0000000-0000-0000-0000-000000000002'

// Audit log fixture ids — a role-change entry and a system-originated source/cert entry.
export const AUDIT_LOG_ROLE_CHANGE_ID = 'au-0000000000000001'
export const AUDIT_LOG_CERT_ACTION_ID = 'au-0000000000000002'

type Role = 'admin' | 'user'

type Profile = {
  id: string
  email: string
  role: Role
  emailVerified: boolean
  displayTimezone: string
}

type AdminUserListItem = {
  id: string
  email: string
  role: Role
  emailVerified: boolean
  createdAt: string
  enrollmentCount: number
}

type ContentSource = {
  id: string
  certificationId: string
  type: string
  url: string
  enabled: boolean
  lastFetchedAt: string | null
  recheckIntervalMinutes: number
  createdAt: string
  chunkCount: number
}

// Captured request payloads + counts the acceptance test asserts against. Populated by the route
// handlers as the admin pages issue mutations.
export interface AdminMockHandles {
  promotedUserIds: string[]
  demotedUserIds: string[]
  contentSourceCreates: Array<Record<string, unknown>>
  reingestSourceIds: string[]
  enabledSourceIds: string[]
  disabledSourceIds: string[]
  discoverBodies: Array<Record<string, unknown>>
  extractBodies: Array<Record<string, unknown>>
  certificationCreates: Array<Record<string, unknown>>
  reverifyBodies: Array<{ id: string; body: Record<string, unknown> }>
  approvedQuarantineIds: string[]
  rejectedQuarantineIds: string[]
  quarantineDetailRequestedIds: string[]
}

type QuarantinedItemDetailContent = {
  question: string
  options: string[]
  answerKey: string
  format: 'multiple_choice' | 'true_false' | 'scenario' | null
  supportingSpans: string[]
  sourceChunkIds: string[]
}

type QuarantinedItem = {
  id: string
  certificationId: string
  domain: string
  verdict: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  provenance: { sourceChunkIds: string[]; supportingSpans: string[]; score: number }
  createdAt: string
  content: QuarantinedItemDetailContent
}

async function fulfilJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  })
}

async function fulfilProblem(
  route: Route,
  status: number,
  title: string,
  detail: string,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/problem+json',
    headers: CORS_HEADERS,
    body: JSON.stringify({ type: 'about:blank', title, status, detail }),
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

function readJsonBody(route: Route): Record<string, unknown> {
  const parsed = route.request().postDataJSON()
  return (parsed ?? {}) as Record<string, unknown>
}

function pathSegment(route: Route, index: number): string {
  return new URL(route.request().url()).pathname.split('/')[index] ?? ''
}

function buildUsers(): AdminUserListItem[] {
  return [
    {
      id: ADMIN_USER_ID,
      email: 'root@readion.io',
      role: 'admin',
      emailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      enrollmentCount: 0,
    },
    {
      id: PROMOTE_USER_ID,
      email: 'casey@org.io',
      role: 'user',
      emailVerified: true,
      createdAt: '2026-02-01T00:00:00.000Z',
      enrollmentCount: 3,
    },
    {
      id: OTHER_USER_ID,
      email: 'dana@org.io',
      role: 'user',
      emailVerified: false,
      createdAt: '2026-03-01T00:00:00.000Z',
      enrollmentCount: 1,
    },
  ]
}

// actorEmail/targetLabel are the audit-log contract fields this change adds (see the audit-log spec
// delta): the actor's resolved email (`null` for a purged/system actor) and a human target label
// (an email for a role change, a cert/source title for a content or certification action).
const AUDIT_LOGS = [
  {
    id: AUDIT_LOG_ROLE_CHANGE_ID,
    userId: ADMIN_USER_ID,
    actorEmail: 'root@readion.io',
    action: 'user.promote',
    targetType: 'user',
    targetId: PROMOTE_USER_ID,
    targetLabel: 'casey@org.io',
    before: { role: 'user' },
    after: { role: 'admin' },
    createdAt: '2026-06-20T10:00:00.000Z',
  },
  {
    id: AUDIT_LOG_CERT_ACTION_ID,
    userId: null,
    actorEmail: null,
    action: 'cert.published',
    targetType: 'certification',
    targetId: CERT_ID,
    targetLabel: 'AWS Certified Solutions Architect — Associate',
    before: { state: 'draft' },
    after: { state: 'live' },
    createdAt: '2026-06-21T11:30:00.000Z',
  },
]

const CERTIFICATION = {
  id: CERT_ID,
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

// The real GET /certifications/:id/coverage shape (CoverageReportDto): per-domain chunkCount vs
// chunkThreshold + met flag, plus the overall totals/state. No fabricated `coverage` fraction.
const COVERAGE = {
  domains: [
    {
      name: 'Secure Architectures',
      chunkCount: 142,
      chunkThreshold: 120,
      enabledSourceCount: 3,
      met: true,
    },
    {
      name: 'Resilient Architectures',
      chunkCount: 96,
      chunkThreshold: 120,
      enabledSourceCount: 2,
      met: false,
    },
    {
      name: 'High-Performing Architectures',
      chunkCount: 80,
      chunkThreshold: 120,
      enabledSourceCount: 1,
      met: false,
    },
    {
      name: 'Cost-Optimized Architectures',
      chunkCount: 55,
      chunkThreshold: 120,
      enabledSourceCount: 1,
      met: false,
    },
  ],
  totalChunks: 373,
  totalThreshold: 480,
  state: 'draft',
  met: false,
}

const DISCOVER_RESPONSE = {
  candidates: [
    {
      url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
      title: 'AWS Certified Solutions Architect — Associate',
      snippet: 'Official exam guide: 65 questions, 130 minutes, passing score 720/1000.',
    },
    {
      url: 'https://d1.awsstatic.com/training-and-certification/SAA-C03-exam-guide.pdf',
      title: 'SAA-C03 Exam Guide (PDF)',
      snippet: 'Domain breakdown and weightings for the SAA-C03 exam.',
    },
  ],
  suggestedContentSources: [
    { url: 'https://docs.aws.amazon.com/', type: 'web' },
    { url: 'https://aws.amazon.com/blogs/architecture/feed/', type: 'rss' },
  ],
}

// One grounded field (passingScore, with citation) and one unverified field (questionCount) per the
// design.md acceptance contract; the remaining two are grounded so the wizard can render the full set.
const EXTRACTION_FIELDS = {
  domains: {
    value: [
      { name: 'Secure Architectures', weight: 30 },
      { name: 'Resilient Architectures', weight: 26 },
      { name: 'High-Performing Architectures', weight: 24 },
      { name: 'Cost-Optimized Architectures', weight: 20 },
    ],
    citation: {
      url: 'https://d1.awsstatic.com/training-and-certification/SAA-C03-exam-guide.pdf',
      passage: 'Domain 1: Design Secure Architectures (30%) … Domain 4: Cost-Optimized (20%).',
    },
  },
  questionCount: { unverified: true },
  passingScore: {
    value: 67,
    citation: {
      url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
      passage: 'AWS scales scores from 100–1,000 with a minimum passing score of 720 (~67%).',
    },
  },
  timeLimitMinutes: {
    value: 130,
    citation: {
      url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
      passage: 'Time: 130 minutes to complete the exam.',
    },
  },
}

const DUE_FOR_REVERIFICATION = [
  {
    id: CERT_ID,
    name: CERTIFICATION.name,
    code: CERTIFICATION.code,
    verifiedAt: '2025-06-01T00:00:00.000Z',
    dueForReverification: true,
  },
]

const UUID = '[0-9a-f-]{36}'

/**
 * Installs the full route-mock surface for the admin console and returns the captured-request handles.
 * Auth-bootstrap endpoints are mocked so the app is authenticated without a real sign-in; pass
 * `{ role: 'user' }` to seed a signed-in non-admin for the /admin role-gate test. Pass
 * `{ manyPages: true }` to report a `meta.total` beyond one page for Users and Audit Log, so the
 * pagination-control acceptance assertions have something to render against. A context-level
 * catch-all keeps any unforeseen /api/v1 call from hitting the (absent) backend; page-level mocks win.
 */
export function mockAdmin(page: Page, options: { role?: Role; manyPages?: boolean } = {}): AdminMockHandles {
  const role: Role = options.role ?? 'admin'
  const manyPages = options.manyPages ?? false
  const context = page.context()

  const profile: Profile = {
    id: role === 'admin' ? ADMIN_USER_ID : PROMOTE_USER_ID,
    email: role === 'admin' ? 'root@readion.io' : 'casey@org.io',
    role,
    emailVerified: true,
    displayTimezone: 'Europe/Helsinki',
  }

  const users = buildUsers()
  const sources: ContentSource[] = [
    {
      id: SOURCE_ENABLED_ID,
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://docs.aws.amazon.com/',
      enabled: true,
      lastFetchedAt: '2026-06-25T08:00:00.000Z',
      recheckIntervalMinutes: 1440,
      createdAt: '2026-01-10T00:00:00.000Z',
      chunkCount: 142,
    },
    {
      id: SOURCE_DISABLED_ID,
      certificationId: CERT_ID,
      type: 'rss',
      url: 'https://aws.amazon.com/blogs/architecture/feed/',
      enabled: false,
      lastFetchedAt: null,
      recheckIntervalMinutes: 1440,
      createdAt: '2026-01-12T00:00:00.000Z',
      chunkCount: 0,
    },
  ]
  // Extraction polling: first poll is still running, the second resolves with grounded + unverified
  // fields so the wizard exercises a real poll loop.
  let extractionPolls = 0

  const handles: AdminMockHandles = {
    promotedUserIds: [],
    demotedUserIds: [],
    contentSourceCreates: [],
    reingestSourceIds: [],
    enabledSourceIds: [],
    disabledSourceIds: [],
    discoverBodies: [],
    extractBodies: [],
    certificationCreates: [],
    reverifyBodies: [],
    approvedQuarantineIds: [],
    rejectedQuarantineIds: [],
    quarantineDetailRequestedIds: [],
  }

  const quarantineItems: QuarantinedItem[] = [
    {
      id: QUARANTINE_ITEM_A_ID,
      certificationId: CERT_ID,
      domain: 'Secure Architectures',
      verdict: JSON.stringify({ pass: false, score: 0.2 }),
      reason: 'The answer key is incorrect',
      status: 'pending',
      provenance: {
        sourceChunkIds: ['chunk-1'],
        supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
        score: 0.2,
      },
      createdAt: '2026-06-20T10:00:00.000Z',
      content: {
        question: 'Which AWS service provides scalable object storage?',
        options: ['Amazon EC2', 'Amazon S3', 'Amazon RDS', 'Amazon VPC'],
        answerKey: 'Amazon S3',
        format: 'multiple_choice',
        supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
        sourceChunkIds: ['chunk-1'],
      },
    },
    {
      id: QUARANTINE_ITEM_B_ID,
      certificationId: CERT_ID,
      domain: 'Resilient Architectures',
      verdict: JSON.stringify({ pass: false, score: 0.4 }),
      reason: 'Hallucinated distractor',
      status: 'pending',
      provenance: {
        sourceChunkIds: ['chunk-2'],
        supportingSpans: ['Amazon S3 stores objects durably'],
        score: 0.4,
      },
      createdAt: '2026-06-21T10:00:00.000Z',
      content: {
        question: 'Which AWS service is a fully managed relational database?',
        options: ['Amazon RDS', 'Amazon S3', 'AWS Lambda', 'Amazon CloudFront'],
        answerKey: 'Amazon RDS',
        format: 'multiple_choice',
        supportingSpans: ['Amazon S3 stores objects durably'],
        sourceChunkIds: ['chunk-2'],
      },
    },
  ]

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
    await fulfilJson(route, 200, { data: profile })
  })

  // --- Users ---
  mock(page, new RegExp(`/api/v1/admin/users/${UUID}/promote$`), async (route) => {
    const id = pathSegment(route, 5)
    handles.promotedUserIds.push(id)
    const target = users.find((user) => user.id === id)
    if (target) {
      target.role = 'admin'
    }
    await fulfilJson(route, 200, { data: target ?? null })
  })
  mock(page, new RegExp(`/api/v1/admin/users/${UUID}/demote$`), async (route) => {
    const id = pathSegment(route, 5)
    handles.demotedUserIds.push(id)
    const target = users.find((user) => user.id === id)
    // The seeded root admin is the protected "last admin": demoting it always conflicts (409),
    // independent of how many other admins exist. The promote flow elevates casey separately and
    // must not unblock this — mirrors the backend's last-admin guard for this fixture.
    if (target && target.id === ADMIN_USER_ID) {
      await fulfilProblem(route, 409, 'Conflict', 'Cannot demote the last remaining admin.')
      return
    }
    if (target) {
      target.role = 'user'
    }
    await fulfilJson(route, 200, { data: target ?? null })
  })
  mock(page, /\/api\/v1\/admin\/users(\?|$)/, async (route) => {
    const total = manyPages ? users.length + 20 : users.length
    await fulfilJson(route, 200, { data: users, meta: { total, page: 1, limit: 20 } })
  })

  // --- Audit Log ---
  mock(page, /\/api\/v1\/admin\/audit-logs(\?|$)/, async (route) => {
    const total = manyPages ? AUDIT_LOGS.length + 20 : AUDIT_LOGS.length
    await fulfilJson(route, 200, {
      data: AUDIT_LOGS,
      meta: { total, page: 1, limit: 20 },
    })
  })

  // --- Content sources ---
  mock(page, new RegExp(`/api/v1/admin/content-sources/${UUID}/enable$`), async (route) => {
    const id = pathSegment(route, 5)
    handles.enabledSourceIds.push(id)
    const target = sources.find((source) => source.id === id)
    if (target) {
      target.enabled = true
    }
    await fulfilJson(route, 200, { data: target ?? null })
  })
  mock(page, new RegExp(`/api/v1/admin/content-sources/${UUID}/disable$`), async (route) => {
    const id = pathSegment(route, 5)
    handles.disabledSourceIds.push(id)
    const target = sources.find((source) => source.id === id)
    if (target) {
      target.enabled = false
    }
    await fulfilJson(route, 200, { data: target ?? null })
  })
  mock(page, new RegExp(`/api/v1/admin/content-sources/${UUID}/reingest$`), async (route) => {
    const id = pathSegment(route, 5)
    handles.reingestSourceIds.push(id)
    await fulfilJson(route, 202, {
      data: { jobId: REINGEST_JOB_ID, contentSourceId: id, state: 'waiting' },
    })
  })
  mock(page, new RegExp(`/api/v1/admin/content-sources/${UUID}/jobs$`), async (route) => {
    await fulfilJson(route, 200, {
      data: [
        {
          jobId: REINGEST_JOB_ID,
          state: 'completed',
          progress: 100,
          attemptsMade: 1,
          failedReason: null,
          timestamp: '2026-06-25T07:55:00.000Z',
          processedOn: '2026-06-25T07:56:00.000Z',
          finishedOn: '2026-06-25T08:00:00.000Z',
        },
      ],
    })
  })
  mock(page, /\/api\/v1\/admin\/content-sources(\?|$)/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = readJsonBody(route)
      handles.contentSourceCreates.push(body)
      const created: ContentSource = {
        id: 'd0000000-0000-0000-0000-0000000000ff',
        certificationId: String(body.certificationId ?? CERT_ID),
        type: String(body.type ?? 'web'),
        url: String(body.url ?? ''),
        enabled: true,
        lastFetchedAt: null,
        recheckIntervalMinutes: 1440,
        createdAt: '2026-06-28T00:00:00.000Z',
        chunkCount: 0,
      }
      sources.push(created)
      await fulfilJson(route, 201, { data: created })
      return
    }
    const certId = new URL(route.request().url()).searchParams.get('certificationId')
    const data = certId ? sources.filter((source) => source.certificationId === certId) : sources
    await fulfilJson(route, 200, { data, meta: { total: data.length, page: 1, limit: 20 } })
  })

  // --- Certification setup wizard ---
  mock(page, /\/api\/v1\/admin\/certifications\/discover-sources$/, async (route) => {
    handles.discoverBodies.push(readJsonBody(route))
    await fulfilJson(route, 200, { data: DISCOVER_RESPONSE })
  })
  mock(page, /\/api\/v1\/admin\/certifications\/extract$/, async (route) => {
    handles.extractBodies.push(readJsonBody(route))
    extractionPolls = 0
    await fulfilJson(route, 202, { data: { jobId: EXTRACT_JOB_ID, state: 'active' } })
  })
  mock(page, new RegExp(`/api/v1/admin/certifications/extractions/${UUID}$`), async (route) => {
    extractionPolls += 1
    if (extractionPolls < 2) {
      await fulfilJson(route, 200, { data: { state: 'active', fields: null } })
      return
    }
    await fulfilJson(route, 200, { data: { state: 'completed', fields: EXTRACTION_FIELDS } })
  })
  mock(page, /\/api\/v1\/admin\/certifications\/due-for-reverification$/, async (route) => {
    await fulfilJson(route, 200, {
      data: DUE_FOR_REVERIFICATION,
      meta: { total: DUE_FOR_REVERIFICATION.length, page: 1, limit: 20 },
    })
  })
  mock(page, new RegExp(`/api/v1/admin/certifications/${UUID}/reverify$`), async (route) => {
    const id = pathSegment(route, 5)
    handles.reverifyBodies.push({ id, body: readJsonBody(route) })
    await fulfilJson(route, 200, { data: { ...CERTIFICATION, id } })
  })
  mock(page, /\/api\/v1\/admin\/certifications(\?|$)/, async (route) => {
    handles.certificationCreates.push(readJsonBody(route))
    await fulfilJson(route, 201, {
      data: { ...CERTIFICATION, id: NEW_CERT_ID, state: 'draft' },
    })
  })

  // --- Quarantine review queue ---
  mock(page, new RegExp(`/api/v1/admin/quarantine/${UUID}/approve$`), async (route) => {
    const id = pathSegment(route, 5)
    handles.approvedQuarantineIds.push(id)
    const target = quarantineItems.find((item) => item.id === id)
    if (target) {
      target.status = 'approved'
    }
    await fulfilJson(route, 200, { data: { id, status: 'approved' } })
  })
  mock(page, new RegExp(`/api/v1/admin/quarantine/${UUID}/reject$`), async (route) => {
    const id = pathSegment(route, 5)
    handles.rejectedQuarantineIds.push(id)
    const target = quarantineItems.find((item) => item.id === id)
    if (target) {
      target.status = 'rejected'
    }
    await fulfilJson(route, 200, { data: { id, status: 'rejected' } })
  })
  mock(page, new RegExp(`/api/v1/admin/quarantine/${UUID}$`), async (route) => {
    const id = pathSegment(route, 5)
    handles.quarantineDetailRequestedIds.push(id)
    const target = quarantineItems.find((item) => item.id === id)
    if (!target) {
      await fulfilProblem(route, 404, 'Not Found', 'Quarantined item not found.')
      return
    }
    await fulfilJson(route, 200, { data: target })
  })
  mock(page, /\/api\/v1\/admin\/quarantine(\?|$)/, async (route) => {
    const status = new URL(route.request().url()).searchParams.get('status')
    const data = status ? quarantineItems.filter((item) => item.status === status) : quarantineItems
    await fulfilJson(route, 200, { data, meta: { total: data.length, page: 1, limit: 25 } })
  })

  // --- Certifications (read) ---
  // The Sources page's certification pills are populated from this plain list endpoint (no id
  // segment) — distinct from the /:id and /:id/coverage reads below.
  mock(page, /\/api\/v1\/certifications(\?|$)/, async (route) => {
    await fulfilJson(route, 200, { data: [CERTIFICATION], meta: { total: 1, page: 1, limit: 20 } })
  })
  mock(page, new RegExp(`/api/v1/certifications/${UUID}/coverage$`), async (route) => {
    await fulfilJson(route, 200, { data: COVERAGE })
  })
  mock(page, new RegExp(`/api/v1/certifications/${UUID}(\\?|$)`), async (route) => {
    const id = pathSegment(route, 4)
    await fulfilJson(route, 200, { data: { ...CERTIFICATION, id }, relationships: {} })
  })

  return handles
}
