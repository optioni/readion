import 'reflect-metadata'

// Set placeholder env vars so ConfigModule.forRoot validation passes at import time.
// Integration tests override these in beforeAll after starting real containers.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://readion:readion@localhost:5432/readion_test'
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
process.env.PORT = process.env.PORT ?? '0'
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test'
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000'
