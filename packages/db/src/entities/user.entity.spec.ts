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
})
