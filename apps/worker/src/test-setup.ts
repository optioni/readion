import 'reflect-metadata'
import { register } from 'prom-client'
import { afterAll } from 'vitest'

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://readion:readion@localhost:5432/readion_test'
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
process.env.SCRAPPER_URL = process.env.SCRAPPER_URL ?? 'http://localhost:3001'
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test'
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? 'readion-worker-test'
process.env.PROMETHEUS_PORT = process.env.PROMETHEUS_PORT ?? '0'
process.env.INTERNAL_API_BASE_URL = process.env.INTERNAL_API_BASE_URL ?? 'http://localhost:3001'
process.env.INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET ?? 'test-internal-lifecycle-secret'

// AI / LLM defaults for tests (no real API calls expected; services are mocked)
process.env.AI_PROVIDER = process.env.AI_PROVIDER ?? 'openai'
process.env.AI_MODEL_DOMAIN_TAGGING = process.env.AI_MODEL_DOMAIN_TAGGING ?? 'gpt-4o-mini'
process.env.AI_EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small'

afterAll(() => {
  register.clear()
})
