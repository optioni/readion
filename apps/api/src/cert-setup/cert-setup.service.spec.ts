import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import {
  ConflictException,
  Module,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import {
  AuditLog,
  Certification,
  DbModule,
  startPostgresContainer,
  startRedisContainer,
} from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import {
  AuditAction,
  CERT_EXTRACTION_QUEUE,
  type CertExtractionResult,
  type CreateCertificationRequest,
  type DiscoverSourcesResponse,
} from '@readion/shared'
import { type Job, Queue, Worker } from 'bullmq'
import type Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AuditLogService } from '../admin/audit-log.service'
import { configureTestEnv } from '../mock-exam/test/mock-exam-test-utils'
import { QueueModule } from '../queue/queue.module'
import { REDIS_CLIENT, RedisModule } from '../redis/redis.module'
import { CertDiscoveryService } from './cert-discovery.service'
import { CertSetupService } from './cert-setup.service'

const ADMIN_ID = '00000000-0000-4000-8000-00000000ad11'
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000'
const VENDOR_URL = 'https://aws.amazon.com/certification/certified-cloud-practitioner/'
const REVERIFICATION_INTERVAL_DAYS = 180

const DISCOVERY_RESPONSE: DiscoverSourcesResponse = {
  candidates: [{ url: VENDOR_URL, title: 'AWS Certified Cloud Practitioner' }],
  suggestedContentSources: [{ url: VENDOR_URL, type: 'web' }],
}

const discoveryMock = {
  discoverSources: async (): Promise<DiscoverSourcesResponse> => DISCOVERY_RESPONSE,
}

const configMock = {
  get: (key: string): number | undefined =>
    key === 'CERT_REVERIFICATION_INTERVAL_DAYS' ? REVERIFICATION_INTERVAL_DAYS : undefined,
}

function citation(passage: string) {
  return { url: VENDOR_URL, passage }
}

const EXTRACTION_RETURN: CertExtractionResult = {
  fields: {
    domains: {
      value: [{ name: 'Cloud Concepts', weight: 100 }],
      citation: citation('Domain 1: Cloud Concepts'),
    },
    questionCount: { value: 65, citation: citation('The exam contains 65 questions.') },
    passingScore: { value: 700, citation: citation('A minimum score of 700 is required.') },
    timeLimitMinutes: { value: 90, citation: citation('Candidates are given 90 minutes.') },
  },
}

function draftPayload(
  overrides: Partial<CreateCertificationRequest> = {},
): CreateCertificationRequest {
  return {
    name: 'AWS Certified Cloud Practitioner',
    provider: 'AWS',
    code: `CLF-${Math.random().toString(16).slice(2, 8)}`,
    domains: [
      { name: 'Cloud Concepts', weight: 60 },
      { name: 'Security and Compliance', weight: 40 },
    ],
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: {
      domains: citation('Domain split'),
      questionCount: citation('65 questions'),
      passingScore: citation('700 to pass'),
      timeLimitMinutes: citation('90 minutes'),
    },
    sourceUrl: VENDOR_URL,
    ...overrides,
  }
}

@Module({
  imports: [
    DbModule,
    RedisModule,
    QueueModule,
    BullModule.registerQueue({ name: CERT_EXTRACTION_QUEUE }),
  ],
  providers: [
    CertSetupService,
    AuditLogService,
    { provide: CertDiscoveryService, useValue: discoveryMock },
    { provide: ConfigService, useValue: configMock },
  ],
})
class TestModule {}

describe('CertSetupService', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>
  let service: CertSetupService
  let em: EntityManager
  let queue: Queue
  let connection: { host: string; port: number }

  beforeAll(async () => {
    ;[postgresContainer, redisContainer] = await Promise.all([
      startPostgresContainer(),
      startRedisContainer(),
    ])
    configureTestEnv(postgresContainer, redisContainer)
    process.env.CERT_REVERIFICATION_INTERVAL_DAYS = String(REVERIFICATION_INTERVAL_DAYS)
    await acquireIsolatedDatabase()

    moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile()

    service = moduleRef.get(CertSetupService)
    em = moduleRef.get(EntityManager)
    queue = moduleRef.get<Queue>(getQueueToken(CERT_EXTRACTION_QUEUE))
    const redis = moduleRef.get<Redis>(REDIS_CLIENT)
    connection = { host: redis.options.host ?? 'localhost', port: redis.options.port ?? 6379 }
  }, 120_000)

  afterAll(async () => {
    await queue?.close()
    await moduleRef?.close()
    await postgresContainer?.stop()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    await em.getConnection().execute('TRUNCATE TABLE certifications, audit_logs CASCADE')
    em.fork().clear()
    await queue.obliterate({ force: true })
  })

  async function auditsFor(targetId: string): Promise<AuditLog[]> {
    return em.fork().find(AuditLog, { targetId }, { orderBy: { createdAt: 'ASC' } })
  }

  async function seedCert(options: {
    code: string
    name?: string
    verifiedAt: Date | null
    state?: 'draft' | 'live'
  }): Promise<Certification> {
    const fork = em.fork()
    const cert = fork.create(Certification, {
      name: options.name ?? `Cert ${options.code}`,
      provider: 'AWS',
      code: options.code,
      domains: [{ name: 'Cloud Concepts', weight: 100 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: { domains: citation('seed') },
      verifiedAt: options.verifiedAt,
      state: options.state ?? 'draft',
    })
    fork.persist(cert)
    await fork.flush()
    return cert
  }

  async function seedCompletedJob(result: CertExtractionResult): Promise<string> {
    const job = await queue.add('extract', {
      name: 'AWS Certified Cloud Practitioner',
      code: 'CLF-C02',
      confirmedSourceUrl: VENDOR_URL,
    })
    const worker = new Worker(CERT_EXTRACTION_QUEUE, async () => result, { connection })
    await new Promise<void>((resolve, reject) => {
      worker.on('completed', () => resolve())
      worker.on('failed', (_job: Job | undefined, error: Error) => reject(error))
    })
    await worker.close()
    return String(job.id)
  }

  describe('discoverSources', () => {
    it('delegates to CertDiscoveryService and persists nothing', async () => {
      const result = await service.discoverSources({
        name: 'AWS Certified Cloud Practitioner',
        code: 'CLF-C02',
      })

      expect(result).toEqual(DISCOVERY_RESPONSE)
      expect(await em.fork().count(Certification, {})).toBe(0)
    })
  })

  describe('enqueueExtraction', () => {
    it('enqueues exactly one cert-extraction job carrying the confirmed source', async () => {
      const result = await service.enqueueExtraction({
        name: 'AWS Certified Cloud Practitioner',
        code: 'CLF-C02',
        confirmedSourceUrl: VENDOR_URL,
      })

      expect(result.jobId).toBeTruthy()
      expect(result.state).toBeTruthy()

      const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'delayed'])
      expect(jobs).toHaveLength(1)
      expect(jobs[0]?.name).toBe('extract')
      expect(jobs[0]?.data).toEqual({
        name: 'AWS Certified Cloud Practitioner',
        code: 'CLF-C02',
        confirmedSourceUrl: VENDOR_URL,
      })
    })
  })

  describe('readExtractionResult', () => {
    it('returns the job state and completed fields from the job return value', async () => {
      const jobId = await seedCompletedJob(EXTRACTION_RETURN)

      const result = await service.readExtractionResult(jobId)

      expect(result.state).toBe('completed')
      expect(result.fields).toEqual(EXTRACTION_RETURN.fields)
    })

    it('returns null fields while the job is pending', async () => {
      const enqueued = await service.enqueueExtraction({
        name: 'AWS Certified Cloud Practitioner',
        code: 'CLF-C02',
        confirmedSourceUrl: VENDOR_URL,
      })

      const result = await service.readExtractionResult(enqueued.jobId)

      expect(result.state).toBe('waiting')
      expect(result.fields).toBeNull()
    })

    it('throws NotFoundException for an unknown job id', async () => {
      await expect(service.readExtractionResult('does-not-exist')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('createDraft', () => {
    it('rejects domain weights that do not sum to 100 with 422 and persists nothing', async () => {
      await expect(
        service.createDraft(
          ADMIN_ID,
          draftPayload({
            domains: [
              { name: 'Cloud Concepts', weight: 50 },
              { name: 'Security', weight: 40 },
            ],
          }),
        ),
      ).rejects.toThrow(UnprocessableEntityException)

      expect(await em.fork().count(Certification, {})).toBe(0)
    })

    it('rejects a duplicate code with 409 and persists nothing new', async () => {
      await seedCert({ code: 'CLF-DUP', verifiedAt: new Date() })

      await expect(
        service.createDraft(ADMIN_ID, draftPayload({ code: 'CLF-DUP' })),
      ).rejects.toThrow(ConflictException)

      expect(await em.fork().count(Certification, {})).toBe(1)
    })

    it('creates a draft with provenance, verifiedAt, and one cert.created audit', async () => {
      const body = draftPayload({ code: 'CLF-NEW' })

      const dto = await service.createDraft(ADMIN_ID, body)

      expect(dto.state).toBe('draft')
      expect(dto.code).toBe('CLF-NEW')

      const persisted = await em.fork().findOneOrFail(Certification, { code: 'CLF-NEW' })
      expect(persisted.state).toBe('draft')
      expect(persisted.verifiedAt).not.toBeNull()
      expect(persisted.provenance).toEqual(body.provenance)

      const audits = await auditsFor(persisted.id)
      expect(audits).toHaveLength(1)
      expect(audits[0].action).toBe(AuditAction.CertCreated)
      expect(audits[0].targetType).toBe('Certification')
      expect(audits[0].userId).toBe(ADMIN_ID)
      expect(audits[0].after).toMatchObject({ code: 'CLF-NEW', provenance: body.provenance })
    })
  })

  describe('reverify', () => {
    it('throws NotFoundException and writes no audit for a missing certification', async () => {
      await expect(
        service.reverify(ADMIN_ID, UNKNOWN_ID, {
          confirmedSourceUrl: VENDOR_URL,
          domains: [{ name: 'Cloud Concepts', weight: 100 }],
          questionCount: 65,
          passingScore: 700,
          timeLimitMinutes: 90,
          provenance: { domains: citation('x') },
        }),
      ).rejects.toThrow(NotFoundException)

      expect(await em.fork().count(AuditLog, {})).toBe(0)
    })

    it('updates fields, provenance and verifiedAt, leaves state unchanged, and audits before/after', async () => {
      const stale = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)
      const cert = await seedCert({ code: 'CLF-REV', verifiedAt: stale, state: 'live' })

      const dto = await service.reverify(ADMIN_ID, cert.id, {
        confirmedSourceUrl: VENDOR_URL,
        domains: [
          { name: 'Cloud Concepts', weight: 70 },
          { name: 'Security', weight: 30 },
        ],
        questionCount: 70,
        passingScore: 720,
        timeLimitMinutes: 100,
        provenance: { domains: citation('updated') },
      })

      expect(dto.state).toBe('live')
      expect(dto.questionCount).toBe(70)

      const updated = await em.fork().findOneOrFail(Certification, { id: cert.id })
      expect(updated.state).toBe('live')
      expect(updated.questionCount).toBe(70)
      expect(updated.passingScore).toBe(720)
      expect(updated.timeLimitMinutes).toBe(100)
      expect(updated.provenance).toEqual({ domains: citation('updated') })
      expect(updated.verifiedAt?.getTime()).toBeGreaterThan(stale.getTime())

      const audits = (await auditsFor(cert.id)).filter(
        (a) => a.action === AuditAction.CertReverified,
      )
      expect(audits).toHaveLength(1)
      expect(audits[0].before).toMatchObject({ questionCount: 65 })
      expect(audits[0].after).toMatchObject({ questionCount: 70 })
    })
  })

  describe('listDueForReverification', () => {
    it('returns certs that are due, ordered by verifiedAt ascending with nulls first', async () => {
      const stale = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)
      const fresh = new Date()
      await seedCert({ code: 'DUE-STALE', verifiedAt: stale })
      await seedCert({ code: 'DUE-NULL', verifiedAt: null })
      await seedCert({ code: 'NOT-DUE', verifiedAt: fresh })

      const result = await service.listDueForReverification({})

      expect(result.meta).toEqual({ total: 2, page: 1, limit: 25 })
      expect(result.items.map((item) => item.code)).toEqual(['DUE-NULL', 'DUE-STALE'])
      expect(result.items.every((item) => item.dueForReverification)).toBe(true)
      const nullItem = result.items.find((item) => item.code === 'DUE-NULL')
      expect(nullItem?.verifiedAt).toBeNull()
    })

    it('clamps the page size to the maximum', async () => {
      const result = await service.listDueForReverification({ limit: 9999 })
      expect(result.meta.limit).toBe(100)
    })
  })
})
