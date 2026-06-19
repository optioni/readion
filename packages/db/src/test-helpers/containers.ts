import { GenericContainer, Wait } from 'testcontainers'

export const POSTGRES_IMAGE = 'pgvector/pgvector:pg17'
export const REDIS_IMAGE = 'redis:7-alpine'

export async function startPostgresContainer() {
  return new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_USER: 'readion',
      POSTGRES_PASSWORD: 'readion',
      POSTGRES_DB: 'readion_test',
    })
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .withExposedPorts(5432)
    .start()
}

export async function startRedisContainer() {
  return new GenericContainer(REDIS_IMAGE)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .withExposedPorts(6379)
    .start()
}
