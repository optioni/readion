import 'reflect-metadata'
import Redis from 'ioredis'
import { register } from 'prom-client'
import { afterAll, beforeEach, inject } from 'vitest'

// Set placeholder env vars so ConfigModule.forRoot validation passes at import time.
// Integration tests override these in beforeAll after starting real containers.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://readion:readion@localhost:5432/readion_test'
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
process.env.PORT = process.env.PORT ?? '0'
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test'
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000'
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? 'readion-api-test'
process.env.SMTP_HOST = process.env.SMTP_HOST ?? 'mail.smtp2go.com'
process.env.SMTP_PORT = process.env.SMTP_PORT ?? '2525'
process.env.SMTP_USERNAME = process.env.SMTP_USERNAME ?? 'smtp-user'
process.env.SMTP_PASSWORD = process.env.SMTP_PASSWORD ?? 'smtp-password'
process.env.MAIL_FROM = process.env.MAIL_FROM ?? 'Readion <no-reply@readion.app>'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-with-at-least-32-characters'
process.env.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS =
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS ?? '900'
process.env.JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS =
  process.env.JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS ?? '604800'
process.env.WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:3000'
process.env.BCRYPT_COST = process.env.BCRYPT_COST ?? '4'

process.env.AI_PROVIDER = process.env.AI_PROVIDER ?? 'anthropic'
process.env.AI_MODEL_QUIZ_GENERATION = process.env.AI_MODEL_QUIZ_GENERATION ?? 'claude-haiku-4-5'
process.env.AI_MODEL_ANSWER_VERIFICATION =
  process.env.AI_MODEL_ANSWER_VERIFICATION ?? 'claude-haiku-4-5'
process.env.AI_MODEL_DOMAIN_TAGGING = process.env.AI_MODEL_DOMAIN_TAGGING ?? 'claude-haiku-4-5'
process.env.AI_MODEL_AGENT_QA = process.env.AI_MODEL_AGENT_QA ?? 'claude-sonnet-4-6'
process.env.AI_MODEL_CERTIFICATION_PREFILL =
  process.env.AI_MODEL_CERTIFICATION_PREFILL ?? 'claude-sonnet-4-6'
process.env.AI_MODEL_MATERIAL_GENERATION =
  process.env.AI_MODEL_MATERIAL_GENERATION ?? 'claude-sonnet-4-6'
process.env.AI_MODEL_COMPLEX_REASONING =
  process.env.AI_MODEL_COMPLEX_REASONING ?? 'claude-sonnet-4-6'

process.env.PUBLIC_API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3001'
process.env.INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? 'test-internal-lifecycle-secret'

process.env.GROUNDING_MAX_REGEN_ATTEMPTS = process.env.GROUNDING_MAX_REGEN_ATTEMPTS ?? '3'
process.env.GROUNDING_VERBATIM_CAP = process.env.GROUNDING_VERBATIM_CAP ?? '500'
process.env.GROUNDING_SIMILARITY_THRESHOLD = process.env.GROUNDING_SIMILARITY_THRESHOLD ?? '0.75'

// Clear prom-client registry after each test file to prevent duplicate-registration errors
// across test app instances.
afterAll(() => {
  register.clear()
})

// The whole suite shares one Redis (see test/global-setup.ts) and runs serially. Reset it
// before every test so cross-file state can't bleed — chiefly the rate-limit counters,
// whose TTL outlives the run and would otherwise accumulate across files and trip random
// throttle failures. Specs seed their own Redis state in beforeEach/the test body, which
// runs after this hook, so nothing they rely on is wiped.
let sharedRedis: Redis | undefined
beforeEach(async () => {
  const url = inject('readionRedisUrl')
  if (url === undefined) return
  sharedRedis ??= new Redis(url)
  await sharedRedis.flushall()
})

afterAll(async () => {
  await sharedRedis?.quit()
  sharedRedis = undefined
})
