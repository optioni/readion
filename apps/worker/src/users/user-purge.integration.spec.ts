import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import { UserPurgeService } from './user-purge.service'
import { UsersModule } from './users.module'

describe('UserPurgeService integration', () => {
  let harness: DbHarness
  let moduleRef: TestingModule
  let em: EntityManager
  let service: UserPurgeService

  beforeAll(async () => {
    harness = await createDbHarness()
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.SCRAPPER_URL = 'http://localhost:3001'
    process.env.NODE_ENV = 'test'
    process.env.LIFECYCLE_DELETION_GRACE_DAYS = '14'

    moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule, UsersModule],
    }).compile()
    await moduleRef.init()

    em = moduleRef.get(EntityManager).fork()
    service = moduleRef.get(UserPurgeService)
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
    em = moduleRef.get(EntityManager).fork()
  })

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
  })

  it('hard-purges eligible soft-deleted users and retains active or within-window users', async () => {
    await insertUser(em, {
      id: '00000000-0000-4000-8000-000000000201',
      email: 'eligible@example.com',
      deletedAt: '2026-06-01T00:00:00.000Z',
    })
    await insertUser(em, {
      id: '00000000-0000-4000-8000-000000000202',
      email: 'within-window@example.com',
      deletedAt: '2026-06-20T00:00:00.000Z',
    })
    await insertUser(em, {
      id: '00000000-0000-4000-8000-000000000203',
      email: 'active@example.com',
      deletedAt: null,
    })

    await service.purgeEligibleDeletedUsers(new Date('2026-06-24T12:00:00.000Z'))

    expect(await countUsers(em, 'eligible@example.com')).toBe(0)
    expect(await countUsers(em, 'within-window@example.com')).toBe(1)
    expect(await countUsers(em, 'active@example.com')).toBe(1)
  })
})

async function insertUser(
  em: EntityManager,
  input: { deletedAt: string | null; email: string; id: string },
) {
  await em.getConnection().execute(
    `
      INSERT INTO users (
        id,
        email,
        password_hash,
        role,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (?, ?, ?, 'user', now(), now(), ?)
    `,
    [
      input.id,
      input.email,
      '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
      input.deletedAt,
    ],
  )
}

async function countUsers(em: EntityManager, email: string) {
  const [{ count }] = await em
    .getConnection()
    .execute<{ count: string }[]>('SELECT count(*) FROM users WHERE email = ?', [email])
  return Number(count)
}
