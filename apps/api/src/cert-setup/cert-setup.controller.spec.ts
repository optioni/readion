import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type CertSetupAcceptanceHarness,
  createCertSetupAcceptanceHarness,
  EXTRACTION_FIELDS_RESULT,
  EXTRACTION_RESULT,
  THIRD_PARTY_URL,
  VENDOR_DOMAIN_URL,
} from './test/cert-setup-acceptance-harness'

const BASE = '/api/v1/admin/certifications'
const DISCOVER = `${BASE}/discover-sources`
const EXTRACT = `${BASE}/extract`
const EXTRACTIONS = `${BASE}/extractions`
const DUE = `${BASE}/due-for-reverification`
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000'

const DRAFT_PAYLOAD = {
  name: 'AWS Certified Cloud Practitioner',
  provider: 'AWS',
  code: 'CLF-C02',
  domains: EXTRACTION_RESULT.domains,
  questionCount: 65,
  passingScore: 700,
  timeLimitMinutes: 90,
  provenance: EXTRACTION_RESULT.provenance,
  sourceUrl: VENDOR_DOMAIN_URL,
}

describe('CertSetupController routes', () => {
  let harness: CertSetupAcceptanceHarness

  beforeAll(async () => {
    harness = await createCertSetupAcceptanceHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  const req = () => harness.getRequest()
  const asAdmin = async () =>
    `Bearer ${await harness.registerAndLogin('admin@example.com', 'correcthorse')}`

  it('POST /discover-sources returns 200 with a single-resource envelope, persisting nothing', async () => {
    const adminAuth = await asAdmin()

    const res = await req()
      .post(DISCOVER)
      .set('Authorization', adminAuth)
      .send({ name: 'AWS Certified Cloud Practitioner', code: 'CLF-C02' })

    expect(res.status).toBe(200)
    const candidates = res.body.data.candidates as Array<{ url: string }>
    expect(candidates.map((c) => c.url)).toEqual([VENDOR_DOMAIN_URL, THIRD_PARTY_URL])
    expect(res.body.data.suggestedContentSources).toBeDefined()
    expect(res.body.relationships).toBeDefined()
    expect(await harness.countCertifications()).toBe(0)
  })

  it('POST /discover-sources rejects an invalid body with 400 problem+json', async () => {
    const adminAuth = await asAdmin()

    const res = await req().post(DISCOVER).set('Authorization', adminAuth).send({ code: 'CLF-C02' })

    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toContain('application/problem+json')
  })

  it('POST /extract returns 202 with a jobId and enqueues exactly one job', async () => {
    const adminAuth = await asAdmin()

    const res = await req().post(EXTRACT).set('Authorization', adminAuth).send({
      name: 'AWS Certified Cloud Practitioner',
      code: 'CLF-C02',
      confirmedSourceUrl: VENDOR_DOMAIN_URL,
    })

    expect(res.status).toBe(202)
    expect(typeof res.body.data.jobId).toBe('string')
    expect(res.body.data.state).toBeDefined()

    const jobs = await harness.certExtractionQueue.getJobs([
      'waiting',
      'active',
      'completed',
      'delayed',
    ])
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.data).toEqual({
      name: 'AWS Certified Cloud Practitioner',
      code: 'CLF-C02',
      confirmedSourceUrl: VENDOR_DOMAIN_URL,
    })
  })

  it('POST /extract rejects an invalid confirmedSourceUrl with 400', async () => {
    const adminAuth = await asAdmin()

    const res = await req()
      .post(EXTRACT)
      .set('Authorization', adminAuth)
      .send({ name: 'AWS', confirmedSourceUrl: 'not-a-url' })

    expect(res.status).toBe(400)
  })

  it('GET /extractions/:jobId returns 200 with state and per-field result', async () => {
    const adminAuth = await asAdmin()
    const jobId = await harness.seedCompletedExtractionJob(
      {
        name: 'AWS Certified Cloud Practitioner',
        code: 'CLF-C02',
        confirmedSourceUrl: VENDOR_DOMAIN_URL,
      },
      EXTRACTION_FIELDS_RESULT,
    )

    const res = await req().get(`${EXTRACTIONS}/${jobId}`).set('Authorization', adminAuth)

    expect(res.status).toBe(200)
    expect(res.body.data.state).toBe('completed')
    expect(res.body.data.fields.questionCount.value).toBe(65)
  })

  it('GET /extractions/:jobId returns 404 for an unknown job id', async () => {
    const adminAuth = await asAdmin()

    const res = await req().get(`${EXTRACTIONS}/does-not-exist`).set('Authorization', adminAuth)

    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toContain('application/problem+json')
  })

  it('POST / creates a draft with 201 and a single-resource envelope', async () => {
    const adminAuth = await asAdmin()

    const res = await req().post(BASE).set('Authorization', adminAuth).send(DRAFT_PAYLOAD)

    expect(res.status).toBe(201)
    expect(res.body.data.state).toBe('draft')
    expect(res.body.relationships).toBeDefined()
    expect(await harness.findCertificationByCode('CLF-C02')).not.toBeNull()
  })

  it('POST / rejects domain weights not summing to 100 with 422', async () => {
    const adminAuth = await asAdmin()

    const res = await req()
      .post(BASE)
      .set('Authorization', adminAuth)
      .send({
        ...DRAFT_PAYLOAD,
        domains: [
          { name: 'Cloud Concepts', weight: 50 },
          { name: 'Security and Compliance', weight: 40 },
        ],
      })

    expect(res.status).toBe(422)
    expect(res.headers['content-type']).toContain('application/problem+json')
  })

  it('POST / rejects a duplicate code with 409', async () => {
    const adminAuth = await asAdmin()
    await harness.seedDraftCertification({ code: 'CLF-C02', verifiedAt: new Date() })

    const res = await req().post(BASE).set('Authorization', adminAuth).send(DRAFT_PAYLOAD)

    expect(res.status).toBe(409)
  })

  it('POST / rejects an invalid body with 400', async () => {
    const adminAuth = await asAdmin()

    const res = await req()
      .post(BASE)
      .set('Authorization', adminAuth)
      .send({ ...DRAFT_PAYLOAD, code: '' })

    expect(res.status).toBe(400)
  })

  it('GET /due-for-reverification returns a collection envelope with default page size 25', async () => {
    const adminAuth = await asAdmin()
    const stale = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)
    await harness.seedDraftCertification({ code: 'DUE-1', verifiedAt: stale })

    const res = await req().get(DUE).set('Authorization', adminAuth)

    expect(res.status).toBe(200)
    expect(res.body.meta).toMatchObject({ page: 1, limit: 25 })
    expect(res.body.data[0]).toMatchObject({ code: 'DUE-1', dueForReverification: true })
  })

  it('GET /due-for-reverification caps the page size at 100', async () => {
    const adminAuth = await asAdmin()

    const res = await req().get(DUE).query({ limit: 1000 }).set('Authorization', adminAuth)

    expect(res.status).toBe(200)
    expect(res.body.meta.limit).toBe(100)
  })

  it('POST /:id/reverify returns 200 and updates verifiedAt', async () => {
    const adminAuth = await asAdmin()
    const stale = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)
    const cert = await harness.seedDraftCertification({ code: 'REV-1', verifiedAt: stale })

    const res = await req()
      .post(`${BASE}/${cert.id}/reverify`)
      .set('Authorization', adminAuth)
      .send({
        confirmedSourceUrl: VENDOR_DOMAIN_URL,
        domains: EXTRACTION_RESULT.domains,
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
        provenance: EXTRACTION_RESULT.provenance,
      })

    expect(res.status).toBe(200)
    const updated = await harness.findCertificationById(cert.id)
    expect(updated?.verifiedAt?.getTime()).toBeGreaterThan(stale.getTime())
  })

  it('POST /:id/reverify returns 404 for an unknown certification', async () => {
    const adminAuth = await asAdmin()

    const res = await req()
      .post(`${BASE}/${UNKNOWN_ID}/reverify`)
      .set('Authorization', adminAuth)
      .send({
        confirmedSourceUrl: VENDOR_DOMAIN_URL,
        domains: EXTRACTION_RESULT.domains,
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
        provenance: EXTRACTION_RESULT.provenance,
      })

    expect(res.status).toBe(404)
  })

  describe('authorization', () => {
    const routes: Array<['get' | 'post', string]> = [
      ['post', DISCOVER],
      ['post', EXTRACT],
      ['get', `${EXTRACTIONS}/some-job`],
      ['post', BASE],
      ['get', DUE],
      ['post', `${BASE}/${UNKNOWN_ID}/reverify`],
    ]

    it('forbids a user-role caller with 403 problem+json on every route', async () => {
      await asAdmin()
      const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')
      const userAuth = `Bearer ${userToken}`

      for (const [method, path] of routes) {
        const res = await req()[method](path).set('Authorization', userAuth).send({})
        expect(res.status).toBe(403)
        expect(res.headers['content-type']).toContain('application/problem+json')
      }
    })

    it('rejects an unauthenticated caller with 401 problem+json on every route', async () => {
      for (const [method, path] of routes) {
        const res = await req()[method](path).send({})
        expect(res.status).toBe(401)
        expect(res.headers['content-type']).toContain('application/problem+json')
      }
    })
  })
})
