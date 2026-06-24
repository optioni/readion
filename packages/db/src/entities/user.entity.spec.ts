import { MikroORM } from '@mikro-orm/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { User, UserRole, UserSchema } from './user.entity'

describe('User entity', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>

  beforeAll(async () => {
    container = await startPostgresContainer()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [UserSchema],
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

  it('persists identity fields with safe defaults and case-insensitive email uniqueness', async () => {
    const em = orm.em.fork()
    const user = em.create(User, {
      email: 'Ada@Example.com',
      passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
      emailVerified: false,
      role: UserRole.User,
    })

    em.persist(user)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(User, { id: user.id })
    expect(persisted.email).toBe('Ada@Example.com')
    expect(persisted.passwordHash).toMatch(/^\$2/)
    expect(persisted.emailVerified).toBe(false)
    expect(persisted.role).toBe('user')
    expect(persisted.createdAt).toBeInstanceOf(Date)
    expect(persisted.updatedAt).toBeInstanceOf(Date)

    const duplicate = em.create(User, {
      email: 'ada@example.com',
      passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
      emailVerified: false,
      role: UserRole.User,
    })

    em.persist(duplicate)
    await expect(em.flush()).rejects.toThrow()
  })

  it('migrates profile defaults, soft delete marker, and active-email uniqueness', async () => {
    const em = orm.em.fork()
    const columns: { column_name: string }[] = await em.getConnection().execute(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name IN (
        'display_timezone',
        'session_default_duration',
        'session_default_content_mix',
        'session_default_difficulty',
        'session_default_focus_area',
        'session_default_learning_style',
        'deleted_at'
      )
    `)
    expect(columns.map((column) => column.column_name).sort()).toEqual([
      'deleted_at',
      'display_timezone',
      'session_default_content_mix',
      'session_default_difficulty',
      'session_default_duration',
      'session_default_focus_area',
      'session_default_learning_style',
    ])

    const indexes: { indexdef: string }[] = await em.getConnection().execute(`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'users'
    `)
    expect(indexes.map((index) => index.indexdef)).toContainEqual(
      expect.stringMatching(
        /CREATE UNIQUE INDEX .* ON .*users.*lower\(email\).* WHERE \(deleted_at IS NULL\)/i,
      ),
    )

    const [inserted] = await em.getConnection().execute<
      {
        display_timezone: string
        session_default_duration: number
        session_default_content_mix: string
        session_default_difficulty: string
        session_default_focus_area: string
        session_default_learning_style: string
        deleted_at: Date | null
      }[]
    >(`
      INSERT INTO users (
        id,
        email,
        password_hash,
        role,
        created_at,
        updated_at
      )
      VALUES (
        '00000000-0000-4000-8000-000000000101',
        'defaults@example.com',
        '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
        'user',
        now(),
        now()
      )
      RETURNING
        display_timezone,
        session_default_duration,
        session_default_content_mix,
        session_default_difficulty,
        session_default_focus_area,
        session_default_learning_style,
        deleted_at
    `)

    expect(inserted).toEqual({
      display_timezone: 'Europe/Helsinki',
      session_default_duration: 30,
      session_default_content_mix: 'balanced',
      session_default_difficulty: 'intermediate',
      session_default_focus_area: 'auto',
      session_default_learning_style: 'weak-area-focus',
      deleted_at: null,
    })
  })

  it('round-trips the users lifecycle migration down and back up', async () => {
    // Roll back to just before Migration20260624000000 (users lifecycle).
    // Newer certification migrations sit on top of it and must be rolled back first.
    await orm.migrator.down({ to: '20260623000000' })

    const em = orm.em.fork()
    const columnsAfterDown = await em.getConnection().execute<{ column_name: string }[]>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'deleted_at'
    `)
    expect(columnsAfterDown).toHaveLength(0)

    await orm.migrator.up()

    const columnsAfterUp = await em.getConnection().execute<{ column_name: string }[]>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'deleted_at'
    `)
    expect(columnsAfterUp).toHaveLength(1)
  })
})
