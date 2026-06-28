import type { APIRequestContext } from '@playwright/test'
import { Client } from 'pg'
import { captureVerificationToken } from './mailpit-helpers'

// Seeds a single rich enrollment for the cert-detail acceptance test, through the SAME running
// API (127.0.0.1:3001) the Nuxt dev server talks to — never the in-process Testcontainers
// harness, whose API lives on a random port the browser can't reach.
//
// Registration, email verification, and enrollment go through the public API. Everything the
// cert-detail page reads back that the public API cannot produce locally (it needs the
// LLM-backed quiz/answer-verification path) is written as FK-chained rows DIRECTLY into the same
// Postgres database the running API reads from, exactly as the web-dashboard seed does for due
// reviews. That covers: graded quiz responses (which the API recomputes into weak-area domains),
// study + review session history, and a submitted mock-exam attempt.
//
// IMPORTANT: weak_areas rows cannot be seeded directly — the web weak-areas endpoint
// (userCertificationsControllerListWeakAreas) RECOMPUTES weak areas from quiz_responses on every
// read and DELETES any domain that has no backing responses. So instead we seed content_chunks
// (one per certification domain, carrying primary_domain) plus quiz_responses whose provenance
// points at those chunks, and let the API derive the weak areas. Correctness is monotonic in the
// domain index so the certification's first domain is deterministically the weakest, which the
// Overview's per-domain breakdown surfaces first and the suggested-next-focus points at.
//
// Generated Orval client methods the cert-detail composables consume (all already committed under
// apps/web/src/api, so NO `yarn codegen` is required for this change):
//   userCertificationsControllerDetail, certificationsControllerDetail, readinessControllerRead,
//   userCertificationsControllerListWeakAreas, sessionsControllerList,
//   sessionSummaryControllerSummary, enrollmentReviewControllerQueue (dueCount via meta),
//   enrollmentMockExamControllerList.

const databaseUrl =
  process.env.READION_E2E_DATABASE_URL ?? 'postgresql://readion:readion@localhost:5432/readion'

// The cert-detail flow only needs one live certification to enroll into.
const MIN_LIVE_CERTIFICATIONS = 1

const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' }

type RegisterResponse = { data: { accessToken: string } }
type CertificationRow = { id: string; name: string; provider: string }
type CertificationsResponse = { data: CertificationRow[] }
type CertificationDomain = { name: string; weight: number }
type CertificationDetailResponse = { data: { domains: CertificationDomain[] } }
type EnrollResponse = { data: { id: string; certificationId: string } }

export type SeededCertDetailUser = {
  email: string
  password: string
  accessToken: string
  enrollmentId: string
  certificationId: string
  certName: string
  provider: string
  // Every certification domain, in catalog order, so the Overview per-domain breakdown (one row
  // per certification domain) and the suggested-next-focus have deterministic content to assert.
  // The first entry is seeded as the weakest domain.
  weakAreaDomains: string[]
  // Direct-DB session history split by kind so the Sessions-tab type filter has both classes to
  // narrow between.
  studySessionCount: number
  reviewSessionCount: number
  totalSessionCount: number
  // The submitted mock attempt the Exam History tab must list with a status and score.
  mockExam: { type: 'mock' | 'diagnostic'; status: 'submitted'; score: number; passed: boolean }
}

async function ensureLiveCatalog(client: Client): Promise<void> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*)::int AS count FROM certifications WHERE state = 'live'`,
  )
  const liveCount = Number(rows[0]?.count ?? 0)
  const missing = MIN_LIVE_CERTIFICATIONS - liveCount
  if (missing <= 0) {
    return
  }
  await client.query(
    `UPDATE certifications SET state = 'live', updated_at = now()
     WHERE id IN (
       SELECT id FROM certifications WHERE state = 'draft' ORDER BY name ASC LIMIT $1
     )`,
    [missing],
  )
}

async function registerVerifiedUser(
  api: APIRequestContext,
  mailpit: APIRequestContext,
): Promise<{ email: string; password: string; accessToken: string }> {
  const email = `cert-detail.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`
  const password = 'correcthorse'

  const registerRes = await api.post('/api/v1/auth/register', {
    headers: CONTENT_TYPE_JSON,
    data: { email, password },
  })
  if (registerRes.status() !== 201) {
    throw new Error(`Seed failed to register user: HTTP ${registerRes.status()}`)
  }
  const {
    data: { accessToken },
  } = (await registerRes.json()) as RegisterResponse

  const verificationToken = await captureVerificationToken(mailpit, email)
  const verifyRes = await api.post('/api/v1/auth/verify-email', {
    headers: CONTENT_TYPE_JSON,
    data: { token: verificationToken },
  })
  if (verifyRes.status() !== 200 && verifyRes.status() !== 201) {
    throw new Error(`Seed failed to verify email: HTTP ${verifyRes.status()}`)
  }

  return { email, password, accessToken }
}

async function resolveUserId(client: Client, email: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [email],
  )
  const id = rows[0]?.id
  if (id === undefined) {
    throw new Error(`Seed could not resolve user id for ${email}`)
  }
  return id
}

async function createContentSource(
  client: Client,
  certificationId: string,
  url: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO content_sources
       (id, certification_id, type, url, enabled, recheck_interval_minutes, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'web', $2, true, 1440, now(), now())
     RETURNING id`,
    [certificationId, url],
  )
  const id = result.rows[0]?.id
  if (id === undefined) {
    throw new Error('Seed failed to create a content source')
  }
  return id
}

async function createContentChunk(
  client: Client,
  contentSourceId: string,
  certificationId: string,
  primaryDomain: string,
  hashSeed: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO content_chunks
       (id, content_source_id, certification_id, text, content_hash,
        domain_tags, primary_domain, metadata, state, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4,
        $5::jsonb, $6, '{}'::jsonb, 'active', now(), now())
     RETURNING id`,
    [
      contentSourceId,
      certificationId,
      `Reviewable content for ${primaryDomain} (cert-detail e2e).`,
      hashSeed.padEnd(64, '0').slice(0, 64),
      JSON.stringify([{ domain: primaryDomain, confidence: 0.95 }]),
      primaryDomain,
    ],
  )
  const id = result.rows[0]?.id
  if (id === undefined) {
    throw new Error(`Seed failed to create a content chunk for ${primaryDomain}`)
  }
  return id
}

// Seeds, per certification domain, a content chunk plus quiz responses that point at it through
// their provenance. The API derives the weak-area domains and their 0–100 scores from these
// responses. Correctness rises with the domain index so domains[0] is the weakest.
async function seedDomainPerformance(
  client: Client,
  enrollmentId: string,
  certificationId: string,
  domains: string[],
): Promise<void> {
  const contentSourceId = await createContentSource(
    client,
    certificationId,
    `https://example.com/e2e-cert-detail-domains-${enrollmentId}`,
  )

  const totalPerDomain = domains.length
  for (const [index, domain] of domains.entries()) {
    const chunkId = await createContentChunk(
      client,
      contentSourceId,
      certificationId,
      domain,
      `e2e-cert-detail-${enrollmentId}-${index}`,
    )
    const snapshot = JSON.stringify({
      question: `Which option best fits ${domain}?`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      provenance: {
        sourceChunkIds: [chunkId],
        supportingSpans: [],
        verdict: { pass: true, score: 1, distractorFindings: [] },
        score: 1,
      },
    })
    const correctCount = index + 1
    for (let i = 0; i < totalPerDomain; i++) {
      const correct = i < correctCount
      await client.query(
        `INSERT INTO quiz_responses
           (id, user_certification_id, answer, correct, confidence, time_taken_ms,
            question_snapshot, format, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 3, 9000, $4::jsonb, 'multiple_choice', now(), now())`,
        [enrollmentId, correct ? 'A' : 'B', correct, snapshot],
      )
    }
  }
}

async function seedSessions(
  client: Client,
  enrollmentId: string,
  userId: string,
): Promise<{ studySessionCount: number; reviewSessionCount: number }> {
  const focusArea = JSON.stringify({ mode: 'auto' })
  const completed: Array<{ kind: 'study' | 'review' }> = [
    { kind: 'study' },
    { kind: 'study' },
    { kind: 'review' },
  ]
  for (const [index, session] of completed.entries()) {
    await client.query(
      `INSERT INTO study_sessions
         (id, user_certification_id, user_id, kind, status, duration_minutes, content_mix,
          difficulty, focus_area, learning_style, last_item_index, started_at, ended_at,
          created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'completed', 30, 'balanced', 'intermediate',
          $4::jsonb, 'weak-area-focus', 6,
          now() - ($5::int * interval '1 day'),
          now() - ($5::int * interval '1 day') + interval '30 minutes',
          now(), now())`,
      [enrollmentId, userId, session.kind, focusArea, index + 1],
    )
  }
  return {
    studySessionCount: completed.filter((session) => session.kind === 'study').length,
    reviewSessionCount: completed.filter((session) => session.kind === 'review').length,
  }
}

async function seedMockExam(
  client: Client,
  enrollmentId: string,
  userId: string,
  domains: string[],
): Promise<SeededCertDetailUser['mockExam']> {
  const primaryDomain = domains[0] ?? 'General'
  const domainBreakdown = JSON.stringify({
    [primaryDomain]: { correct: 7, total: 10, accuracy: 0.7 },
  })
  const score = 78.5
  await client.query(
    `INSERT INTO mock_exams
       (id, user_id, user_certification_id, type, status, started_at, deadline, score, passed,
        domain_breakdown, questions, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'mock', 'submitted',
        now() - interval '2 days', now() - interval '2 days' + interval '90 minutes',
        $3, true, $4::jsonb, '[]'::jsonb, now(), now())`,
    [userId, enrollmentId, score, domainBreakdown],
  )
  return { type: 'mock', status: 'submitted', score, passed: true }
}

// Writes the content_source → content_chunk → review_item FK chain a due review needs, so the
// running API's review-queue endpoint reports dueCount > 0 for this enrollment.
async function seedDueReview(
  client: Client,
  enrollmentId: string,
  certificationId: string,
): Promise<void> {
  const contentSourceId = await createContentSource(
    client,
    certificationId,
    `https://example.com/e2e-cert-detail-review-${enrollmentId}`,
  )
  const anchorChunkId = await createContentChunk(
    client,
    contentSourceId,
    certificationId,
    'Security',
    `e2e-cert-detail-review-${enrollmentId}`,
  )

  await client.query(
    `INSERT INTO review_items
       (id, user_certification_id, anchor_chunk_id, box, state, due_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 1, 'active', now() - interval '1 day', now(), now())`,
    [enrollmentId, anchorChunkId],
  )
}

export async function seedCertDetailUser(
  api: APIRequestContext,
  mailpit: APIRequestContext,
): Promise<SeededCertDetailUser> {
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    await ensureLiveCatalog(client)

    const { email, password, accessToken } = await registerVerifiedUser(api, mailpit)
    const authHeaders = { Authorization: `Bearer ${accessToken}` }
    const userId = await resolveUserId(client, email)

    const certsRes = await api.get('/api/v1/certifications', { headers: authHeaders })
    if (certsRes.status() !== 200) {
      throw new Error(`Seed failed to list certifications: HTTP ${certsRes.status()}`)
    }
    const { data: certifications } = (await certsRes.json()) as CertificationsResponse
    const certification = certifications[0]
    if (certification === undefined) {
      throw new Error('Seed precondition: no live certification available to enroll into')
    }

    const detailRes = await api.get(`/api/v1/certifications/${certification.id}`, {
      headers: authHeaders,
    })
    if (detailRes.status() !== 200) {
      throw new Error(`Seed failed to read certification detail: HTTP ${detailRes.status()}`)
    }
    const { data: detail } = (await detailRes.json()) as CertificationDetailResponse
    // The Overview renders one breakdown row per certification domain, so the acceptance test
    // asserts a row count equal to every domain — not just the answered ones.
    const weakAreaDomains = detail.domains.map((domain) => domain.name)
    if (weakAreaDomains.length === 0) {
      weakAreaDomains.push('General')
    }

    const enrollRes = await api.post('/api/v1/user-certifications', {
      headers: { ...authHeaders, ...CONTENT_TYPE_JSON },
      data: { certificationId: certification.id },
    })
    if (enrollRes.status() !== 201) {
      throw new Error(`Seed failed to enroll into ${certification.id}: HTTP ${enrollRes.status()}`)
    }
    const { data: enrollment } = (await enrollRes.json()) as EnrollResponse

    await seedDomainPerformance(
      client,
      enrollment.id,
      enrollment.certificationId,
      weakAreaDomains,
    )
    const { studySessionCount, reviewSessionCount } = await seedSessions(
      client,
      enrollment.id,
      userId,
    )
    const mockExam = await seedMockExam(client, enrollment.id, userId, weakAreaDomains)
    await seedDueReview(client, enrollment.id, enrollment.certificationId)

    // Materialise the weak_areas rows now (the endpoint recomputes from the seeded responses) so
    // the session-summary endpoint's next-focus, which reads the persisted table, is populated.
    await api.get(`/api/v1/user-certifications/${enrollment.id}/weak-areas`, {
      headers: authHeaders,
    })

    return {
      email,
      password,
      accessToken,
      enrollmentId: enrollment.id,
      certificationId: enrollment.certificationId,
      certName: certification.name,
      provider: certification.provider,
      weakAreaDomains,
      studySessionCount,
      reviewSessionCount,
      totalSessionCount: studySessionCount + reviewSessionCount,
      mockExam,
    }
  } finally {
    await client.end()
  }
}
