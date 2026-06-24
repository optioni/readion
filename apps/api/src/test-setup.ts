import 'reflect-metadata'
import { register } from 'prom-client'
import { afterAll } from 'vitest'

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

// Clear prom-client registry after each test file to prevent duplicate-registration errors
// across test app instances.
afterAll(() => {
  register.clear()
})
