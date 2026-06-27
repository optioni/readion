import { randomBytes } from 'node:crypto'
import { MikroORM } from '@mikro-orm/core'
import { Client } from 'pg'
import { inject } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'

export const TEMPLATE_DB_NAME = 'readion_template'

type AdminConn = {
  host: string
  port: number
  user: string
  password: string
}

// Resolve the shared Postgres from the Vitest-provided URL (see global-setup) so the per-spec
// database is created on the exact instance the app will connect to, regardless of whether the
// spec has populated process.env yet. Falls back to env for the dedicated-container path.
function adminConn(): AdminConn {
  let host = process.env.DB_HOST ?? 'localhost'
  let port = Number(process.env.DB_PORT ?? 5432)
  try {
    const url = inject('readionPostgresUrl')
    if (url !== undefined) {
      const parsed = new URL(url)
      host = parsed.hostname
      port = Number(parsed.port)
    }
  } catch {
    // inject() is unavailable outside a running Vitest worker; the env fallback covers that.
  }
  return {
    host,
    port,
    user: process.env.DB_USER ?? 'readion',
    password: process.env.DB_PASSWORD ?? 'readion',
  }
}

// Connect to the `postgres` maintenance database so we can CREATE/DROP the per-spec database
// (a session cannot drop the database it is connected to).
async function withAdminClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const { host, port, user, password } = adminConn()
  const client = new Client({ host, port, user, password, database: 'postgres' })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

/**
 * Build the migrated template database once per suite (called from the Vitest global setup).
 * Per-spec databases are then cheap file-copies of this template, so migrations run a single
 * time for the whole suite instead of once per spec.
 */
export async function provisionTemplateDatabase(
  connection: { host: string; port: number },
  template: string = TEMPLATE_DB_NAME,
): Promise<void> {
  process.env.DB_HOST = connection.host
  process.env.DB_PORT = String(connection.port)

  await withAdminClient(async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${template}" WITH (FORCE)`)
    await client.query(`CREATE DATABASE "${template}"`)
  })

  const orm = await MikroORM.init({
    ...mikroOrmConfig,
    host: connection.host,
    port: connection.port,
    dbName: template,
    // Don't emit a `.snapshot-<db>.json` for the throwaway template database.
    migrations: { ...mikroOrmConfig.migrations, snapshot: false },
  })
  try {
    await orm.migrator.up()
  } finally {
    await orm.close()
  }
}

export type IsolatedDatabase = {
  dbName: string
  drop: () => Promise<void>
}

/**
 * Provision a throwaway database for a single spec file by copying the pre-migrated template
 * (see global-setup). Each spec gets its own database so its TRUNCATE reset and any lingering
 * connection can never collide with another spec sharing one Postgres instance. Sets
 * process.env.DB_NAME so the app booted afterwards connects to the isolated copy.
 */
export async function acquireIsolatedDatabase(
  template: string = TEMPLATE_DB_NAME,
): Promise<IsolatedDatabase> {
  const dbName = `rdn_${process.pid}_${randomBytes(6).toString('hex')}`
  const { host, port, user, password } = adminConn()
  await withAdminClient((client) =>
    client.query(`CREATE DATABASE "${dbName}" TEMPLATE "${template}"`),
  )

  // Point every DB env var at the freshly created copy so an app booted afterwards connects to
  // it without the spec needing to wire host/port/name itself.
  process.env.DB_HOST = host
  process.env.DB_PORT = String(port)
  process.env.DB_NAME = dbName
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${dbName}`

  return {
    dbName,
    drop: async () => {
      // FORCE terminates any connection still attached to the database (a leaked one is exactly
      // what we are isolating against) so the drop cannot hang.
      await withAdminClient((client) =>
        client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`),
      )
    },
  }
}
