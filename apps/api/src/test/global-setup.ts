import { POSTGRES_IMAGE, REDIS_IMAGE } from '@readion/db'
import { provisionTemplateDatabase } from '@readion/db/src/test-helpers/isolated-db'
import { GenericContainer, Wait } from 'testcontainers'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  interface ProvidedContext {
    readionPostgresUrl?: string
    readionRedisUrl?: string
  }
}

// One Postgres + one Redis container for the entire suite. Per-spec setup connects to
// these via inject() (see test-helpers/containers.ts) instead of starting its own pair;
// starting a container per spec spins up dozens at once and overwhelms Docker, dropping
// random specs with ECONNREFUSED / startup timeouts. The suite runs serially
// (fileParallelism: false) so a single shared pair is safe — specs already reset their
// own state (TRUNCATE / flushdb) between tests.
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis] = await Promise.all([
    new GenericContainer(POSTGRES_IMAGE)
      .withEnvironment({
        POSTGRES_USER: 'readion',
        POSTGRES_PASSWORD: 'readion',
        POSTGRES_DB: 'readion_test',
      })
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .withExposedPorts(5432)
      .start(),
    new GenericContainer(REDIS_IMAGE)
      .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
      .withExposedPorts(6379)
      .start(),
  ])

  // Migrate the template database once. Each spec copies it into its own throwaway database
  // (see acquireIsolatedDatabase) so specs can never collide on the shared Postgres instance.
  await provisionTemplateDatabase({
    host: postgres.getHost(),
    port: postgres.getMappedPort(5432),
  })

  project.provide(
    'readionPostgresUrl',
    `postgresql://readion:readion@${postgres.getHost()}:${postgres.getMappedPort(5432)}/readion_test`,
  )
  project.provide('readionRedisUrl', `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`)

  return async () => {
    await Promise.allSettled([postgres.stop(), redis.stop()])
  }
}
