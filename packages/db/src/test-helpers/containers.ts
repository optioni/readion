import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers'

declare module 'vitest' {
  interface ProvidedContext {
    readionPostgresUrl?: string
    readionRedisUrl?: string
  }
}

// `inject` is resolved lazily so that importing the @readion/db barrel never pulls the Vitest
// runtime into non-test consumers (the API/worker processes require the compiled package, and
// Vitest's CJS entry throws on require). Inside the suite the shared-container URLs are still
// injected; everywhere else this resolves to undefined and the helpers start their own
// container, exactly as the fallback path already does.
async function injectSharedUrl(
  key: 'readionPostgresUrl' | 'readionRedisUrl',
): Promise<string | undefined> {
  try {
    const { inject } = await import('vitest')
    return inject(key)
  } catch {
    return undefined
  }
}

export const POSTGRES_IMAGE = 'pgvector/pgvector:pg17'
export const REDIS_IMAGE = 'redis:7-alpine'

// The full suite shares a single Postgres + Redis pair started once in the Vitest global
// setup and published via provide()/inject(). These helpers hand back a handle pointing
// at the shared pair so existing specs need no changes — they keep calling getHost() /
// getMappedPort() / stop(). The suite runs serially, so sharing is safe: specs already
// reset their own state (TRUNCATE / flushdb) between tests, and stop() is a no-op (the
// shared containers are torn down by the global setup, not by individual specs).
//
// When no shared URL is injected — e.g. a helper imported outside the configured suite —
// each call falls back to starting a dedicated container, exactly as before.
function parse(url: string): { host: string; port: number } {
  const { hostname, port } = new URL(url)
  return { host: hostname, port: Number(port) }
}

function sharedHandle(host: string, port: number): StartedTestContainer {
  return new Proxy({} as StartedTestContainer, {
    get(_target, prop) {
      if (prop === 'getHost') return () => host
      if (prop === 'getMappedPort') return () => port
      if (prop === 'stop') return async () => undefined
      // Anything else (including the `then` probe used to detect thenables when this
      // handle is the resolved value of a promise) is simply absent.
      return undefined
    },
  })
}

export async function startPostgresContainer(): Promise<StartedTestContainer> {
  const sharedUrl = await injectSharedUrl('readionPostgresUrl')
  if (sharedUrl !== undefined) {
    const { host, port } = parse(sharedUrl)
    return sharedHandle(host, port)
  }
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

export async function startRedisContainer(): Promise<StartedTestContainer> {
  const sharedUrl = await injectSharedUrl('readionRedisUrl')
  if (sharedUrl !== undefined) {
    const { host, port } = parse(sharedUrl)
    return sharedHandle(host, port)
  }
  return new GenericContainer(REDIS_IMAGE)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .withExposedPorts(6379)
    .start()
}
