import { EntityManager } from '@mikro-orm/core'
import { getQueueToken } from '@nestjs/bullmq'
import { ConflictException, Module, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
  AuditLog,
  Certification,
  ContentChunk,
  ContentSource,
  DbModule,
  startPostgresContainer,
  startRedisContainer,
} from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import { AuditAction, contentSourceTypes, ingestionQueueName } from '@readion/shared'
import type { Queue } from 'bullmq'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AuditLogService } from '../admin/audit-log.service'
import { configureTestEnv } from '../mock-exam/test/mock-exam-test-utils'
import { QueueModule } from '../queue/queue.module'
import { RedisModule } from '../redis/redis.module'
import { ContentIngestionQueueModule } from './content-ingestion-queue.module'
import { ContentSourceRepository } from './content-source.repository'
import { ContentSourceService } from './content-source.service'

@Module({
  imports: [DbModule, RedisModule, QueueModule, ContentIngestionQueueModule],
  providers: [ContentSourceService, ContentSourceRepository, AuditLogService],
})
class TestModule {}

const ADMIN_ID = '00000000-0000-4000-8000-00000000ad11'
const UNKNOWN_ID = '00000000-0000-4000-8000-0000000000ff'

describe('ContentSourceService', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>
  let service: ContentSourceService
  let em: EntityManager
  let queues: Queue[]

  beforeAll(async () => {
    ;[postgresContainer, redisContainer] = await Promise.all([
      startPostgresContainer(),
      startRedisContainer(),
    ])
    configureTestEnv(postgresContainer, redisContainer)
    await acquireIsolatedDatabase()

    moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile()

    service = moduleRef.get(ContentSourceService)
    em = moduleRef.get(EntityManager)
    queues = contentSourceTypes.map((type) =>
      moduleRef.get<Queue>(getQueueToken(ingestionQueueName(type))),
    )
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await postgresContainer?.stop()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    await em
      .getConnection()
      .execute('TRUNCATE TABLE content_sources, certifications, audit_logs CASCADE')
    em.fork().clear()
    for (const queue of queues) {
      await queue.obliterate({ force: true })
    }
  })

  async function seedCert(
    domains: { name: string; weight: number }[] = [{ name: 'Cloud Concepts', weight: 100 }],
  ): Promise<Certification> {
    const fork = em.fork()
    const cert = fork.create(Certification, {
      name: 'AWS Cloud Practitioner',
      provider: 'AWS',
      code: `CLF-${Math.random().toString(16).slice(2, 8)}`,
      domains,
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: 'live',
    })
    fork.persist(cert)
    await fork.flush()
    return cert
  }

  async function auditsFor(targetId: string): Promise<AuditLog[]> {
    return em.fork().find(AuditLog, { targetId }, { orderBy: { createdAt: 'ASC' } })
  }

  async function seedChunks(
    contentSourceId: string,
    certificationId: string,
    count: number,
  ): Promise<void> {
    const fork = em.fork()
    for (let i = 0; i < count; i++) {
      const chunk = fork.create(ContentChunk, {
        contentSourceId,
        certificationId,
        text: `seeded chunk ${i}`,
        contentHash: `${contentSourceId}-${i}`.padEnd(64, '0').slice(0, 64),
        domainTags: [],
        primaryDomain: 'Cloud Concepts',
      })
      fork.persist(chunk)
    }
    await fork.flush()
  }

  describe('register', () => {
    it('throws NotFoundException when the certification does not exist', async () => {
      await expect(
        service.register(ADMIN_ID, {
          certificationId: UNKNOWN_ID,
          type: 'web',
          url: 'https://docs.aws.amazon.com/',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('persists the source and writes one source.added audit with an after snapshot', async () => {
      const cert = await seedCert()

      const dto = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })

      expect(dto.certificationId).toBe(cert.id)
      expect(dto.type).toBe('web')
      expect(dto.enabled).toBe(true)

      const persisted = await em.fork().findOne(ContentSource, { id: dto.id })
      expect(persisted).not.toBeNull()

      const audits = await auditsFor(dto.id)
      expect(audits).toHaveLength(1)
      expect(audits[0].action).toBe(AuditAction.SourceAdded)
      expect(audits[0].targetType).toBe('ContentSource')
      expect(audits[0].userId).toBe(ADMIN_ID)
      expect(audits[0].after).toMatchObject({ id: dto.id, enabled: true })
    })
  })

  describe('list', () => {
    it('applies default page size and returns collection meta', async () => {
      const cert = await seedCert()
      for (let i = 0; i < 3; i++) {
        await service.register(ADMIN_ID, {
          certificationId: cert.id,
          type: 'web',
          url: `https://docs.aws.amazon.com/${i}`,
        })
      }

      const result = await service.list({ certificationId: cert.id })

      expect(result.items).toHaveLength(3)
      expect(result.meta).toEqual({ total: 3, page: 1, limit: 25 })
    })

    it('clamps the limit to the maximum page size', async () => {
      const result = await service.list({ limit: 9999 })
      expect(result.meta.limit).toBe(100)
    })

    it('returns an accurate chunkCount per source via a batched count, not per-row N+1', async () => {
      const cert = await seedCert()
      const withChunks = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/with-chunks',
      })
      const withoutChunks = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/without-chunks',
      })
      await seedChunks(withChunks.id, cert.id, 3)

      const result = await service.list({ certificationId: cert.id })

      const foundWithChunks = result.items.find((item) => item.id === withChunks.id)
      const foundWithoutChunks = result.items.find((item) => item.id === withoutChunks.id)
      expect(foundWithChunks?.chunkCount).toBe(3)
      expect(foundWithoutChunks?.chunkCount).toBe(0)
    })
  })

  describe('findOne', () => {
    it('returns the mapped source', async () => {
      const cert = await seedCert()
      const created = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })

      const dto = await service.findOne(created.id)
      expect(dto.id).toBe(created.id)
    })

    it('throws NotFoundException for an unknown id', async () => {
      await expect(service.findOne(UNKNOWN_ID)).rejects.toThrow(NotFoundException)
    })

    it('returns an accurate chunkCount for the source', async () => {
      const cert = await seedCert()
      const created = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })
      await seedChunks(created.id, cert.id, 5)

      const dto = await service.findOne(created.id)
      expect(dto.chunkCount).toBe(5)
    })
  })

  describe('setEnabled', () => {
    it('does not write an audit when the source is already in the target state', async () => {
      const cert = await seedCert()
      const source = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })

      const dto = await service.setEnabled(ADMIN_ID, source.id, true)
      expect(dto.enabled).toBe(true)
      expect(await auditsFor(source.id)).toHaveLength(1) // only the source.added audit
    })

    it('writes one source.disabled audit with before/after on a real change', async () => {
      const cert = await seedCert()
      const source = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })

      const dto = await service.setEnabled(ADMIN_ID, source.id, false)
      expect(dto.enabled).toBe(false)

      const persisted = await em.fork().findOneOrFail(ContentSource, { id: source.id })
      expect(persisted.enabled).toBe(false)

      const audits = (await auditsFor(source.id)).filter(
        (a) => a.action === AuditAction.SourceDisabled,
      )
      expect(audits).toHaveLength(1)
      expect(audits[0].before).toEqual({ enabled: true })
      expect(audits[0].after).toEqual({ enabled: false })
    })

    it('writes one source.enabled audit when re-enabling', async () => {
      const cert = await seedCert()
      const source = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })
      await service.setEnabled(ADMIN_ID, source.id, false)

      await service.setEnabled(ADMIN_ID, source.id, true)

      const audits = (await auditsFor(source.id)).filter(
        (a) => a.action === AuditAction.SourceEnabled,
      )
      expect(audits).toHaveLength(1)
      expect(audits[0].before).toEqual({ enabled: false })
      expect(audits[0].after).toEqual({ enabled: true })
    })

    it('throws NotFoundException for an unknown id', async () => {
      await expect(service.setEnabled(ADMIN_ID, UNKNOWN_ID, false)).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('reingest', () => {
    it('throws NotFoundException for an unknown source', async () => {
      await expect(service.reingest(ADMIN_ID, UNKNOWN_ID)).rejects.toThrow(NotFoundException)
    })

    it('throws ConflictException for a disabled source', async () => {
      const cert = await seedCert()
      const source = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })
      await service.setEnabled(ADMIN_ID, source.id, false)

      await expect(service.reingest(ADMIN_ID, source.id)).rejects.toThrow(ConflictException)
    })

    it('enqueues an ingest job with cert domains and writes a source.reingested audit', async () => {
      const cert = await seedCert([
        { name: 'Cloud Concepts', weight: 50 },
        { name: 'Security', weight: 50 },
      ])
      const source = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })

      const result = await service.reingest(ADMIN_ID, source.id)

      expect(result.contentSourceId).toBe(source.id)
      expect(result.jobId).toBeTruthy()
      expect(result.state).toBeTruthy()

      const queue = moduleRef.get<Queue>(getQueueToken(ingestionQueueName('web')))
      const job = await queue.getJob(result.jobId)
      expect(job).toBeDefined()
      expect(job?.name).toBe('ingest')
      expect(job?.data).toEqual({
        contentSourceId: source.id,
        domains: ['Cloud Concepts', 'Security'],
      })

      const audits = (await auditsFor(source.id)).filter(
        (a) => a.action === AuditAction.SourceReingested,
      )
      expect(audits).toHaveLength(1)
      expect(audits[0].after).toEqual({ jobId: result.jobId })
    })
  })

  describe('getJobStatus', () => {
    it('throws NotFoundException for an unknown source', async () => {
      await expect(service.getJobStatus(UNKNOWN_ID, '1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when the job is absent', async () => {
      const cert = await seedCert()
      const source = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })

      await expect(service.getJobStatus(source.id, '999999')).rejects.toThrow(NotFoundException)
    })

    it('returns the ingestion job status for an existing job', async () => {
      const cert = await seedCert()
      const source = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/',
      })
      const enqueued = await service.reingest(ADMIN_ID, source.id)

      const status = await service.getJobStatus(source.id, enqueued.jobId)
      expect(status.jobId).toBe(enqueued.jobId)
      expect(status.state).toBe('waiting')
      expect(status.attemptsMade).toBe(0)
    })
  })

  describe('listJobs', () => {
    it('throws NotFoundException for an unknown source', async () => {
      await expect(service.listJobs(UNKNOWN_ID)).rejects.toThrow(NotFoundException)
    })

    it('returns only the jobs belonging to the source, most-recent first', async () => {
      const cert = await seedCert()
      const sourceA = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/a',
      })
      const sourceB = await service.register(ADMIN_ID, {
        certificationId: cert.id,
        type: 'web',
        url: 'https://docs.aws.amazon.com/b',
      })

      const first = await service.reingest(ADMIN_ID, sourceA.id)
      const second = await service.reingest(ADMIN_ID, sourceA.id)
      await service.reingest(ADMIN_ID, sourceB.id)

      const result = await service.listJobs(sourceA.id)

      expect(result.items).toHaveLength(2)
      expect(result.items.map((j) => j.jobId)).toEqual([second.jobId, first.jobId])
      expect(result.meta.total).toBe(2)
    })
  })
})
