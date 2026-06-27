require('reflect-metadata')

const fs = require('node:fs')
const http = require('node:http')
const Module = require('node:module')
const net = require('node:net')
const path = require('node:path')
const swc = require('@swc/core')
const { EntityManager, MikroORM } = require('@mikro-orm/core')
const { Test } = require('@nestjs/testing')

registerSwcTypeScriptHook()
registerWorkspaceSourceAliases()

const {
  Certification,
  ContentChunk,
  ContentSource,
  MockExam,
  QuizResponse,
  ReviewItem,
  User,
  UserCertification,
  startPostgresContainer,
  startRedisContainer,
} = require('@readion/db')
const { v4: uuidv4 } = require('uuid')
const mikroOrmConfig = require('@readion/db/src/mikro-orm.config').default

async function createReadionE2eHarness() {
  const [postgresContainer, redisContainer, scrapperStub, prometheusPort] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
    startScrapperStub(),
    getFreePort(),
  ])

  configureE2eEnv(postgresContainer, redisContainer, scrapperStub.port, prometheusPort)

  const orm = await MikroORM.init({
    ...mikroOrmConfig,
    host: postgresContainer.getHost(),
    port: postgresContainer.getMappedPort(5432),
    dbName: 'readion_test',
  })
  await orm.migrator.up()
  await orm.close()

  const { AppModule: ApiAppModule } = require('../../../api/src/app.module')
  const { bootstrapApp } = require('../../../api/src/bootstrap')
  const { MAIL_CAPTURED_MESSAGES } = require('../../../api/src/mail/transport')
  const { REDIS_CLIENT } = require('../../../api/src/redis/redis.module')
  require('prom-client').register.clear()
  const { AppModule: WorkerAppModule } = require('../../../worker/src/app.module')

  const apiModule = await Test.createTestingModule({
    imports: [ApiAppModule],
  }).compile()
  const apiApp = apiModule.createNestApplication()
  await bootstrapApp(apiApp)
  await apiApp.init()
  await apiApp.listen(0, '127.0.0.1')

  const workerModule = await Test.createTestingModule({
    imports: [WorkerAppModule],
  }).compile()
  await workerModule.init()

  const mailMessages = apiModule.get(MAIL_CAPTURED_MESSAGES)
  const em = apiModule.get(EntityManager)
  const redis = apiModule.get(REDIS_CLIENT)

  return {
    apiBaseUrl: normalizeNestUrl(await apiApp.getUrl()),
    mailMessages,
    registerVerifiedUser: async (api, email = `users.${Date.now()}@example.com`) => {
      const password = 'correcthorse'
      const register = await api.post('/api/v1/auth/register', {
        data: { email, password },
      })

      if (register.status() !== 201) {
        throw new Error(
          `Expected registration to succeed, got ${register.status()}: ${await register.text()}`,
        )
      }

      const registerBody = await register.json()
      const verificationToken = extractLatestToken(mailMessages)
      const verify = await api.post('/api/v1/auth/verify-email', {
        data: { token: verificationToken },
      })

      if (verify.status() !== 200) {
        throw new Error(
          `Expected email verification to succeed, got ${verify.status()}: ${await verify.text()}`,
        )
      }

      return {
        accessToken: registerBody.data.accessToken,
        email,
        password,
      }
    },
    seedCalibratedEnrollment: async (email) => seedCalibratedEnrollment(em, email),
    resetState: async () => {
      mailMessages.length = 0
      await redis.flushdb()
      await truncateDomainTables(em)
    },
    teardown: async () => {
      await workerModule.close()
      await apiApp.close()
      await postgresContainer.stop()
      await redisContainer.stop()
      await scrapperStub.close()
    },
    workerModule,
  }
}

// Seeds a calibrated enrollment with real read-surface data so the digest/nudge
// flows have genuine metrics: a submitted diagnostic guarantees calibration,
// quiz responses across two content chunks make "Security" the relatively
// weakest domain, and three past-due review items give a due-review count of 3.
// Data is written via the EntityManager (not the public API) because resetState
// truncates every domain table, leaving no live certifications to enroll into.
async function seedCalibratedEnrollment(em, email) {
  const fork = em.fork()
  const user = await fork.findOneOrFail(User, { email })

  const certification = fork.create(Certification, {
    name: 'AWS Certified Security - Specialty',
    provider: 'AWS',
    code: `SCS-${Date.now()}`,
    domains: [
      { name: 'Security', weight: 60 },
      { name: 'Networking', weight: 40 },
    ],
    questionCount: 65,
    passingScore: 750,
    timeLimitMinutes: 170,
    state: 'live',
    provenance: 'verified',
    verifiedAt: new Date(),
  })

  const enrollment = fork.create(UserCertification, {
    user,
    certification,
    status: 'active',
  })

  const contentSource = fork.create(ContentSource, {
    certificationId: certification.id,
    type: 'web',
    url: `https://example.com/${certification.code}`,
    enabled: true,
    recheckIntervalMinutes: 1440,
  })

  // FK targets (certifications, content_sources) must exist before chunks/items
  // reference them, and these references are plain UUID columns the ORM can't
  // order automatically — so flush in dependency stages.
  fork.persist([certification, enrollment, contentSource])
  await fork.flush()

  const makeChunk = (domain, index) =>
    fork.create(ContentChunk, {
      contentSourceId: contentSource.id,
      certificationId: certification.id,
      text: `${domain} content #${index}.`,
      contentHash: `${index}`.padStart(64, '0'),
      domainTags: [{ domain, confidence: 0.95 }],
      primaryDomain: domain,
      metadata: {},
    })

  const securityChunk = makeChunk('Security', 1)
  const networkingChunk = makeChunk('Networking', 2)
  // Review items are unique per (enrollment, chunk) and FK to content_chunks, so
  // each due item needs its own anchor chunk.
  const reviewChunks = [makeChunk('Security', 3), makeChunk('Security', 4), makeChunk('Security', 5)]

  fork.persist([securityChunk, networkingChunk, ...reviewChunks])
  await fork.flush()

  const records = []
  const makeResponse = (chunk, correct) =>
    records.push(
      fork.create(QuizResponse, {
        userCertification: enrollment,
        answer: correct ? 'A' : 'B',
        correct,
        confidence: 4,
        timeTakenMs: 12000,
        format: 'multiple_choice',
        questionSnapshot: {
          question: `Question about ${chunk.primaryDomain}`,
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          provenance: {
            sourceChunkIds: [chunk.id],
            supportingSpans: [],
            verdict: { pass: true, score: 1, distractorFindings: [] },
            score: 1,
          },
        },
      }),
    )

  // Security is the relatively weakest domain (a few wrong); Networking is strong.
  for (let i = 0; i < 8; i++) makeResponse(securityChunk, i < 6)
  for (let i = 0; i < 6; i++) makeResponse(networkingChunk, true)

  records.push(
    fork.create(MockExam, {
      user,
      userCertification: enrollment,
      type: 'diagnostic',
      status: 'submitted',
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      deadline: null,
      score: 82,
      passed: true,
      domainBreakdown: {},
      questions: [],
    }),
  )

  const dueAt = new Date(Date.now() - 24 * 60 * 60 * 1000)
  for (const chunk of reviewChunks) {
    records.push(
      fork.create(ReviewItem, {
        userCertification: enrollment,
        anchorChunkId: chunk.id,
        box: 1,
        state: 'active',
        dueAt,
      }),
    )
  }

  fork.persist(records)
  await fork.flush()

  return {
    userId: user.id,
    enrollmentId: enrollment.id,
    certificationId: certification.id,
    weakestDomain: 'Security',
    dueReviewCount: 3,
  }
}

async function truncateDomainTables(em) {
  const fork = em.fork()
  const conn = fork.getConnection()
  const tables = await conn.execute(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != 'mikro_orm_migrations'
  `)

  if (tables.length > 0) {
    const names = tables.map((table) => `"${table.tablename}"`).join(', ')
    await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
  }

  fork.clear()
}

function extractLatestToken(messages) {
  const message = messages.at(-1)

  if (message === undefined) {
    throw new Error('No captured mail message')
  }

  const match = message.text.match(/https?:\/\/\S+/)
  const token = match ? new URL(match[0]).searchParams.get('token') : null

  if (token === null) {
    throw new Error('Captured mail did not include a token')
  }

  return token
}

function configureE2eEnv(postgresContainer, redisContainer, scrapperPort, prometheusPort) {
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
  process.env.SCRAPPER_URL = `http://127.0.0.1:${scrapperPort}`
  process.env.PROMETHEUS_PORT = String(prometheusPort)
  process.env.SERVICE_NAME = 'readion-e2e-test'

  // AI config — required by the API/worker Zod schemas at boot. No model is ever
  // invoked in these e2e flows, so the values just need to be present and valid.
  process.env.AI_PROVIDER = 'openai'
  process.env.AI_API_KEY = 'test-ai-api-key'
  process.env.AI_MODEL_QUIZ_GENERATION = 'gpt-4o-mini'
  process.env.AI_MODEL_ANSWER_VERIFICATION = 'gpt-4o'
  process.env.AI_MODEL_DOMAIN_TAGGING = 'gpt-4o-mini'
  process.env.AI_MODEL_AGENT_QA = 'gpt-4o'
  process.env.AI_MODEL_CERTIFICATION_PREFILL = 'gpt-4o-mini'
  process.env.AI_MODEL_MATERIAL_GENERATION = 'gpt-4o'
  process.env.AI_MODEL_COMPLEX_REASONING = 'gpt-4o'

  // Lifecycle-email (email-lifecycle change) config — fixed test values so both
  // apps boot once their Zod schemas require these keys. PUBLIC_API_URL /
  // INTERNAL_API_BASE_URL hosts are placeholders: tests extract only the path of
  // generated links and hit them through the harness's real API base URL.
  process.env.INTERNAL_API_SECRET = 'test-internal-secret'
  process.env.INTERNAL_API_BASE_URL = 'http://127.0.0.1:3001'
  process.env.PUBLIC_API_URL = 'http://127.0.0.1:3001'
  process.env.DIGEST_SEND_WEEKDAY = '1'
  process.env.DIGEST_SEND_HOUR = '9'
  process.env.EXAM_READY_THRESHOLD = '80'
  process.env.NUDGE_ACTIVITY_LULL_DAYS = '7'
  process.env.NUDGE_FOLLOWUP_DELAY_DAYS = '3'
  process.env.NUDGE_MAX_FOLLOWUPS = '1'
}

async function startScrapperStub() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('# Cleaned Content\n\nSome text from the scrapper.')
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  return {
    port,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  }
}

async function getFreePort() {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

function normalizeNestUrl(url) {
  return url.replace('http://[::1]', 'http://127.0.0.1')
}

function registerSwcTypeScriptHook() {
  require.extensions['.ts'] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8')
    const output = swc.transformSync(source, {
      filename,
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
        target: 'es2022',
      },
      module: {
        type: 'commonjs',
      },
      sourceMaps: 'inline',
    })

    module._compile(output.code, filename)
  }
}

function registerWorkspaceSourceAliases() {
  const root = path.resolve(__dirname, '../../../..')
  const aliases = new Map([
    ['@readion/db', path.join(root, 'packages/db/src/index.ts')],
    ['@readion/shared', path.join(root, 'packages/shared/src/index.ts')],
    // `@readion/db`'s test-helpers import `vitest` for shared-container injection.
    // Under Playwright there is no Vitest runtime, so stub it: `inject()` returns
    // undefined and the container helpers fall back to starting their own.
    ['vitest', path.join(__dirname, 'vitest-stub.cjs')],
  ])
  const resolveFilename = Module._resolveFilename

  Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
    const aliased = aliases.get(request)

    if (aliased !== undefined) {
      return aliased
    }

    return resolveFilename.call(this, request, parent, isMain, options)
  }
}

module.exports = {
  createReadionE2eHarness,
}
