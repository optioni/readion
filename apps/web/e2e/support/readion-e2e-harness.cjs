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

const { startPostgresContainer, startRedisContainer } = require('@readion/db')
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
