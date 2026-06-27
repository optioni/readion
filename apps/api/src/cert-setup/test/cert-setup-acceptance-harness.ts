import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { CertificationDomain, CertificationProvenance } from '@readion/shared'
import { MockEmbeddingModelV3, MockLanguageModelV3 } from 'ai/test'
import { type Job, Queue, Worker } from 'bullmq'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { vi } from 'vitest'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { ProviderAdapter } from '../../llm/provider-adapter'
import { REDIS_CLIENT } from '../../redis/redis.module'

// The shared queue-name constant CERT_EXTRACTION_QUEUE will be added in group 1
// (mirroring ingestionQueueName). Until it exists, importing it would break the
// whole suite's compilation, so reference the literal queue name here.
export const CERT_EXTRACTION_QUEUE = 'cert-extraction'

export const VENDOR_DOMAIN_URL =
  'https://aws.amazon.com/certification/certified-cloud-practitioner/'
export const THIRD_PARTY_URL =
  'https://www.examtopics.com/exams/amazon/aws-certified-cloud-practitioner/'

export type ExtractionJobData = {
  name: string
  code: string
  confirmedSourceUrl: string
}

export const DISCOVERY_CANDIDATES = {
  candidates: [
    {
      url: VENDOR_DOMAIN_URL,
      title: 'AWS Certified Cloud Practitioner',
      snippet: 'Official exam guide and overview.',
    },
    {
      url: THIRD_PARTY_URL,
      title: 'AWS Certified Cloud Practitioner practice exams',
      snippet: 'Community-contributed practice questions.',
    },
  ],
  suggestedContentSources: [{ url: VENDOR_DOMAIN_URL, type: 'web' as const }],
}

const EXTRACTED_DOMAINS: CertificationDomain[] = [
  { name: 'Cloud Concepts', weight: 24 },
  { name: 'Security and Compliance', weight: 30 },
  { name: 'Cloud Technology and Services', weight: 34 },
  { name: 'Billing, Pricing, and Support', weight: 12 },
]

function citation(passage: string) {
  return { url: VENDOR_DOMAIN_URL, passage }
}

export const EXTRACTION_RESULT = {
  name: 'AWS Certified Cloud Practitioner',
  provider: 'AWS',
  code: 'CLF-C02',
  domains: EXTRACTED_DOMAINS,
  questionCount: 65,
  passingScore: 700,
  timeLimitMinutes: 90,
  sourceUrl: VENDOR_DOMAIN_URL,
  provenance: {
    name: citation('AWS Certified Cloud Practitioner'),
    code: citation('Exam code: CLF-C02'),
    domains: citation('Domain 1: Cloud Concepts (24% of scored content)'),
    questionCount: citation('The exam contains 65 questions.'),
    passingScore: citation('A minimum score of 700 is required to pass.'),
    timeLimitMinutes: citation('Candidates are given 90 minutes.'),
  } satisfies CertificationProvenance,
}

export type SeedDraftCertificationOptions = {
  code: string
  name?: string
  verifiedAt: Date
  state?: 'draft' | 'live'
}

export type CertSetupAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  certExtractionQueue: Queue
  resetState: () => Promise<void>
  teardown: () => Promise<void>
  registerAndLogin: (email: string, password: string) => Promise<string>
  getRequest: () => ReturnType<typeof supertest>
  countCertifications: () => Promise<number>
  findCertificationByCode: (code: string) => Promise<Certification | null>
  findCertificationById: (id: string) => Promise<Certification | null>
  seedDraftCertification: (options: SeedDraftCertificationOptions) => Promise<Certification>
  seedCompletedExtractionJob: (
    data: ExtractionJobData,
    result: typeof EXTRACTION_RESULT,
  ) => Promise<string>
}

function createDiscoveryLangModel(): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async ({ prompt }: { prompt: Array<{ role: string; content: unknown }> }) => {
      const text = JSON.stringify(
        prompt.some((message) => JSON.stringify(message.content).includes('extract'))
          ? EXTRACTION_RESULT
          : DISCOVERY_CANDIDATES,
      )
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
        warnings: [],
      }
    },
  })
}

function createEmbeddingModel(): MockEmbeddingModelV3 {
  return new MockEmbeddingModelV3({
    doEmbed: async ({ values }) => ({
      embeddings: values.map(() => new Array(1536).fill(0.1)),
      usage: { tokens: values.length * 10 },
      warnings: [],
    }),
  })
}

export async function createCertSetupAcceptanceHarness(): Promise<CertSetupAcceptanceHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, BullModule.registerQueue({ name: CERT_EXTRACTION_QUEUE })],
  })
    .overrideProvider(ProviderAdapter)
    .useValue({
      getChatModel: vi.fn().mockReturnValue(createDiscoveryLangModel()),
      getEmbeddingModel: vi.fn().mockReturnValue(createEmbeddingModel()),
    })
    .compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const redis = moduleRef.get<Redis>(REDIS_CLIENT)
  const em = moduleRef.get(EntityManager)
  const certExtractionQueue = moduleRef.get<Queue>(getQueueToken(CERT_EXTRACTION_QUEUE))
  const connection = {
    host: redis.options.host ?? 'localhost',
    port: redis.options.port ?? 6379,
  }

  return {
    app,
    moduleRef,
    certExtractionQueue,
    resetState: async () => {
      await redis.flushdb()
      await truncateDomainTables(em)
    },
    teardown: async () => {
      await certExtractionQueue.close()
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
    registerAndLogin: async (email: string, password: string) => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password })
      return res.body.data.accessToken as string
    },
    getRequest: () => supertest(app.getHttpServer()),
    countCertifications: async () => em.fork().count(Certification, {}),
    findCertificationByCode: async (code: string) =>
      em.fork().findOne(Certification, { code }),
    findCertificationById: async (id: string) => em.fork().findOne(Certification, { id }),
    seedDraftCertification: async (options: SeedDraftCertificationOptions) => {
      const fork = em.fork()
      const certification = fork.create(Certification, {
        name: options.name ?? `Cert ${options.code}`,
        provider: 'AWS',
        code: options.code,
        domains: EXTRACTED_DOMAINS,
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
        provenance: EXTRACTION_RESULT.provenance,
        verifiedAt: options.verifiedAt,
        state: options.state ?? 'draft',
      })
      fork.persist(certification)
      await fork.flush()
      return certification
    },
    seedCompletedExtractionJob: async (data, result) => {
      const job = await certExtractionQueue.add('extract', data)
      const worker = new Worker(CERT_EXTRACTION_QUEUE, async () => result, { connection })
      await new Promise<void>((resolve, reject) => {
        worker.on('completed', () => {
          resolve()
        })
        worker.on('failed', (_job: Job | undefined, error: Error) => {
          reject(error)
        })
      })
      await worker.close()
      return String(job.id)
    },
  }
}

async function truncateDomainTables(em: EntityManager) {
  const fork = em.fork()
  const conn = fork.getConnection()
  const tables: { tablename: string }[] = await conn.execute(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != 'mikro_orm_migrations'
  `)

  if (tables.length === 0) {
    return
  }

  const names = tables.map((table) => `"${table.tablename}"`).join(', ')
  await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
  fork.clear()
}

function configureTestEnv(
  postgresContainer: StartedTestContainer,
  redisContainer: StartedTestContainer,
) {
  const dbHost = postgresContainer.getHost()
  const dbPort = postgresContainer.getMappedPort(5432)
  const redisHost = redisContainer.getHost()
  const redisPort = redisContainer.getMappedPort(6379)

  process.env.DATABASE_URL = `postgresql://readion:readion@${dbHost}:${dbPort}/readion_test`
  process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`
  process.env.DB_HOST = dbHost
  process.env.DB_PORT = String(dbPort)
  process.env.DB_NAME = 'readion_test'
  process.env.DB_USER = 'readion'
  process.env.DB_PASSWORD = 'readion'
  process.env.PORT = '0'
  process.env.NODE_ENV = 'test'
  process.env.CORS_ORIGIN = 'http://localhost:3000'
  process.env.MAIL_FROM = 'Readion <no-reply@readion.app>'
  process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters'
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS = '900'
  process.env.JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS = '604800'
  process.env.BCRYPT_COST = '4'
  process.env.WEB_BASE_URL = 'http://localhost:3000'
  // The reverification interval gets a config default in group 5; provide one
  // here so the module can validate it once it is wired into AppModule.
  process.env.CERT_REVERIFICATION_INTERVAL_DAYS = '180'
}
