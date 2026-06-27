import { MikroORM } from '@mikro-orm/core'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { AuditLog, AuditLogSchema } from './audit-log.entity'
import { User, UserSchema } from './user.entity'

describe('AuditLog entity', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>

  beforeAll(async () => {
    container = await startPostgresContainer()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [UserSchema, AuditLogSchema],
      host: container.getHost(),
      port: container.getMappedPort(5432),
      dbName: 'readion_test',
    })
    await orm.migrator.up()
  }, 120_000)

  afterAll(async () => {
    await orm?.close()
    await container?.stop()
  })

  beforeEach(async () => {
    await orm.em.getConnection().execute('TRUNCATE TABLE audit_logs, users CASCADE')
  })

  function seedUser(em: ReturnType<typeof orm.em.fork>) {
    const user = em.create(User, {
      email: `actor-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
    })
    em.persist(user)
    return user
  }

  it('migrates the audit_logs table with the expected columns and nullability', async () => {
    const conn = orm.em.getConnection()
    type ColumnRow = { column_name: string; is_nullable: string; data_type: string }
    const rows: ColumnRow[] = await conn.execute<ColumnRow[]>(
      `SELECT column_name, is_nullable, data_type
       FROM information_schema.columns
       WHERE table_name = 'audit_logs'`,
    )
    const byName = new Map<string, ColumnRow>(rows.map((r) => [r.column_name, r]))

    expect(byName.get('id')?.is_nullable).toBe('NO')
    expect(byName.get('user_id')?.is_nullable).toBe('YES')
    expect(byName.get('action')?.is_nullable).toBe('NO')
    expect(byName.get('target_type')?.is_nullable).toBe('NO')
    expect(byName.get('target_id')?.is_nullable).toBe('NO')
    expect(byName.get('before')?.is_nullable).toBe('YES')
    expect(byName.get('before')?.data_type).toBe('jsonb')
    expect(byName.get('after')?.is_nullable).toBe('YES')
    expect(byName.get('after')?.data_type).toBe('jsonb')
    expect(byName.get('created_at')?.is_nullable).toBe('NO')
  })

  it('persists and reads back an audit log with a non-null actor', async () => {
    const em = orm.em.fork()
    const user = seedUser(em)
    await em.flush()

    const log = em.create(AuditLog, {
      userId: user.id,
      action: 'user.role.promoted',
      targetType: 'user',
      targetId: user.id,
      before: { role: 'user' },
      after: { role: 'admin' },
    })
    em.persist(log)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(AuditLog, { id: log.id })
    expect(persisted.userId).toBe(user.id)
    expect(persisted.action).toBe('user.role.promoted')
    expect(persisted.targetType).toBe('user')
    expect(persisted.targetId).toBe(user.id)
    expect(persisted.before).toEqual({ role: 'user' })
    expect(persisted.after).toEqual({ role: 'admin' })
    expect(persisted.createdAt).toBeInstanceOf(Date)
  })

  it('persists an audit log with a null actor', async () => {
    const em = orm.em.fork()

    const log = em.create(AuditLog, {
      userId: null,
      action: 'source.disabled',
      targetType: 'content_source',
      targetId: 'src-123',
      before: null,
      after: null,
    })
    em.persist(log)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(AuditLog, { id: log.id })
    expect(persisted.userId).toBeNull()
    expect(persisted.action).toBe('source.disabled')
    expect(persisted.before).toBeNull()
    expect(persisted.after).toBeNull()
  })
})
