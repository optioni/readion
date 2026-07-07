import type { INestApplication } from '@nestjs/common'
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

describe('cert-setup acceptance', () => {
  let harness: CertSetupAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createCertSetupAcceptanceHarness()
    app = harness.app
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

  it('discovers ranked candidate sources, vendor-domain first, persisting nothing', async () => {
    const adminAuth = await asAdmin()
    harness.searchReturnsVendorRanked()

    const res = await req()
      .post(DISCOVER)
      .set('Authorization', adminAuth)
      .send({ name: 'AWS Certified Cloud Practitioner', code: 'CLF-C02' })

    expect(res.status).toBe(200)
    const candidates = res.body.data.candidates as Array<{ url: string }>
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.map((c) => c.url)).toEqual([VENDOR_DOMAIN_URL, THIRD_PARTY_URL])
    expect(res.body.data.suggestedContentSources).toBeDefined()

    expect(await harness.countCertifications()).toBe(0)
  })

  it('drops model-proposed candidates that search never surfaced (grounding guard)', async () => {
    const adminAuth = await asAdmin()
    harness.searchReturnsVendorOnly()

    const res = await req()
      .post(DISCOVER)
      .set('Authorization', adminAuth)
      .send({ name: 'AWS Certified Cloud Practitioner', code: 'CLF-C02' })

    expect(res.status).toBe(200)
    const candidates = res.body.data.candidates as Array<{ url: string }>
    expect(candidates.map((c) => c.url)).toEqual([VENDOR_DOMAIN_URL])
    expect(candidates.map((c) => c.url)).not.toContain(THIRD_PARTY_URL)
  })

  it('returns 200 with empty candidates when the search provider is unavailable', async () => {
    const adminAuth = await asAdmin()
    harness.searchThrows()

    const res = await req()
      .post(DISCOVER)
      .set('Authorization', adminAuth)
      .send({ name: 'AWS Certified Cloud Practitioner', code: 'CLF-C02' })

    expect(res.status).toBe(200)
    expect(res.body.data.candidates).toEqual([])
  })

  it('enqueues exactly one cert-extraction job carrying the confirmed source', async () => {
    const adminAuth = await asAdmin()

    const res = await req().post(EXTRACT).set('Authorization', adminAuth).send({
      name: 'AWS Certified Cloud Practitioner',
      code: 'CLF-C02',
      confirmedSourceUrl: VENDOR_DOMAIN_URL,
    })

    expect(res.status).toBe(202)
    expect(res.body.data.jobId).toBeDefined()
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

  it('reports extraction job state and 404 for an unknown job id', async () => {
    const adminAuth = await asAdmin()

    const jobId = await harness.seedCompletedExtractionJob(
      {
        name: 'AWS Certified Cloud Practitioner',
        code: 'CLF-C02',
        confirmedSourceUrl: VENDOR_DOMAIN_URL,
      },
      EXTRACTION_FIELDS_RESULT,
    )

    const found = await req().get(`${EXTRACTIONS}/${jobId}`).set('Authorization', adminAuth)
    expect(found.status).toBe(200)
    expect(found.body.data.state).toBe('completed')
    expect(found.body.data.fields.questionCount.value).toBe(65)

    const unknown = await req().get(`${EXTRACTIONS}/does-not-exist`).set('Authorization', adminAuth)
    expect(unknown.status).toBe(404)
  })

  it('creates a grounded draft with persisted provenance, verifiedAt, and audit', async () => {
    const adminAuth = await asAdmin()

    const res = await req().post(BASE).set('Authorization', adminAuth).send(DRAFT_PAYLOAD)

    expect(res.status).toBe(201)
    expect(res.body.data.state).toBe('draft')
    expect(res.body.relationships).toBeDefined()

    const cert = await harness.findCertificationByCode('CLF-C02')
    expect(cert).not.toBeNull()
    expect(cert?.verifiedAt).not.toBeNull()
    expect(cert?.provenance).not.toBe('verified')

    const audit = await req().get('/api/v1/admin/audit-logs').set('Authorization', adminAuth)
    const actions = (audit.body.data as Array<{ action: string }>).map((entry) => entry.action)
    expect(actions).toContain('cert.created')
  })

  it('rejects a draft whose domain weights do not sum to 100 with 422', async () => {
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
  })

  it('rejects a duplicate certification code with 409', async () => {
    const adminAuth = await asAdmin()
    await harness.seedDraftCertification({ code: 'CLF-C02', verifiedAt: new Date() })

    const res = await req().post(BASE).set('Authorization', adminAuth).send(DRAFT_PAYLOAD)

    expect(res.status).toBe(409)
  })

  it('lists certifications due for reverification ordered by verifiedAt ascending', async () => {
    const adminAuth = await asAdmin()
    const stale = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)
    await harness.seedDraftCertification({ code: 'DUE-1', verifiedAt: stale })

    const res = await req().get(DUE).set('Authorization', adminAuth)

    expect(res.status).toBe(200)
    expect(res.body.meta).toBeDefined()
    expect(res.body.data[0]).toMatchObject({ code: 'DUE-1', dueForReverification: true })
  })

  it('reverifies a certification, updating fields/provenance/verifiedAt and auditing', async () => {
    const adminAuth = await asAdmin()
    const stale = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)
    const cert = await harness.seedDraftCertification({ code: 'REV-1', verifiedAt: stale })

    const res = await req()
      .post(`${BASE}/${cert.id}/reverify`)
      .set('Authorization', adminAuth)
      .send({
        confirmedSourceUrl: VENDOR_DOMAIN_URL,
        name: cert.name,
        provider: cert.provider,
        code: cert.code,
        domains: EXTRACTION_RESULT.domains,
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
        provenance: EXTRACTION_RESULT.provenance,
      })

    expect(res.status).toBe(200)
    expect(res.body.data.state).toBe('draft')

    const updated = await harness.findCertificationById(cert.id)
    expect(updated?.verifiedAt?.getTime()).toBeGreaterThan(stale.getTime())

    const audit = await req().get('/api/v1/admin/audit-logs').set('Authorization', adminAuth)
    const actions = (audit.body.data as Array<{ action: string }>).map((entry) => entry.action)
    expect(actions).toContain('cert.reverified')
  })

  it('returns 404 when reverifying an unknown certification', async () => {
    const adminAuth = await asAdmin()

    const res = await req()
      .post(`${BASE}/00000000-0000-0000-0000-000000000000/reverify`)
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

  describe('authorization on every route', () => {
    const routes: Array<['get' | 'post', string]> = [
      ['post', DISCOVER],
      ['post', EXTRACT],
      ['get', `${EXTRACTIONS}/some-job`],
      ['post', BASE],
      ['get', DUE],
      ['post', `${BASE}/00000000-0000-0000-0000-000000000000/reverify`],
    ]

    it('rejects a user-role caller with 403 problem+json', async () => {
      await asAdmin()
      const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')
      const userAuth = `Bearer ${userToken}`

      for (const [method, path] of routes) {
        const res = await req()[method](path).set('Authorization', userAuth).send({})
        expect(res.status).toBe(403)
        expect(res.headers['content-type']).toContain('application/problem+json')
      }
    })

    it('rejects an unauthenticated caller with 401 problem+json', async () => {
      for (const [method, path] of routes) {
        const res = await req()[method](path).send({})
        expect(res.status).toBe(401)
        expect(res.headers['content-type']).toContain('application/problem+json')
      }
    })
  })
})
