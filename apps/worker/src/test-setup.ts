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

afterAll(() => {
  register.clear()
})
