import type { APIRequestContext } from '@playwright/test'
import {
  type CertificationsResponse,
  CONTENT_TYPE_JSON,
  createContentChunk,
  createContentSource,
  ensureLiveCatalog,
  newSeedClient,
  registerVerifiedUser,
  seedDueReview,
} from './seed-helpers'

// Seeds a single rich enrollment for the cert-detail acceptance test. Registration, email
// verification, and enrollment go through the public API; everything the cert-detail page reads
// back that the public API cannot produce locally (it needs the LLM-backed quiz/answer-
// verification path) is written as FK-chained rows directly into the same Postgres database the
// running API reads from. See seed-helpers.ts for the shared scaffolding.
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

// The cert-detail flow only needs one live certification to enroll into.
const MIN_LIVE_CERTIFICATIONS = 1

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

async function resolveUserId(client: ReturnType<typeof newSeedClient>, email: string) {
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

// Seeds, per certification domain, a content chunk plus quiz responses that point at it through
// their provenance. The API derives the weak-area domains and their 0–100 scores from these
// responses. Correctness rises with the domain index so domains[0] is the weakest.
async function seedDomainPerformance(
  client: ReturnType<typeof newSeedClient>,
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
    const chunkId = await createContentChunk(client, {
      contentSourceId,
      certificationId,
      primaryDomain: domain,
      hashSeed: `e2e-cert-detail-${enrollmentId}-${index}`,
    })
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
  client: ReturnType<typeof newSeedClient>,
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
  client: ReturnType<typeof newSeedClient>,
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

export async function seedCertDetailUser(
  api: APIRequestContext,
  mailpit: APIRequestContext,
): Promise<SeededCertDetailUser> {
  const client = newSeedClient()
  await client.connect()

  try {
    await ensureLiveCatalog(client, MIN_LIVE_CERTIFICATIONS)

    const { email, password, accessToken } = await registerVerifiedUser(api, mailpit, 'cert-detail')
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

    await seedDomainPerformance(client, enrollment.id, enrollment.certificationId, weakAreaDomains)
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
