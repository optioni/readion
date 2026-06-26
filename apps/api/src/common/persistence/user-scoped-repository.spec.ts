import type { EntitySchema } from '@mikro-orm/core'
import { defineEntity, p } from '@mikro-orm/core'
import { NotFoundException } from '@nestjs/common'
import { BaseEntity, BaseSchema, createDbHarness, type DbHarness } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { UserScopedRepository } from './user-scoped-repository'

const ScopedDocumentSchema = defineEntity({
  name: 'ScopedDocument',
  tableName: 'scoped_documents',
  extends: BaseSchema,
  properties: {
    userId: p.uuid(),
    title: p.string(),
  },
}) as EntitySchema

class ScopedDocument extends BaseEntity {
  userId!: string
  title!: string
}
ScopedDocumentSchema.setClass(ScopedDocument)

describe('UserScopedRepository', () => {
  let harness: DbHarness | undefined

  beforeAll(async () => {
    harness = await createDbHarness([ScopedDocumentSchema])
  }, 120_000)

  beforeEach(async () => {
    await harness?.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  it('reads only the owner row and returns identical 404s for cross-user and missing rows', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized')
    }

    const em = harness.getEm()
    const ownerId = '00000000-0000-4000-8000-000000000001'
    const otherUserId = '00000000-0000-4000-8000-000000000002'
    const ownerDocument = em.create(ScopedDocument, {
      userId: ownerId,
      title: 'Owner document',
    })
    const otherDocument = em.create(ScopedDocument, {
      userId: otherUserId,
      title: 'Other document',
    })
    em.persist([ownerDocument, otherDocument])
    await em.flush()
    em.clear()

    const queries: string[] = []
    const connection = em.getConnection()
    const execute = connection.execute.bind(connection)
    connection.execute = async (...args: Parameters<typeof connection.execute>) => {
      queries.push(String(args[0]))
      return execute(...args)
    }

    const repository = new UserScopedRepository(em.getRepository(ScopedDocument))

    await expect(
      repository.findOneOrFail(ownerId, { id: ownerDocument.id }),
    ).resolves.toMatchObject({
      id: ownerDocument.id,
      title: 'Owner document',
    })

    const crossUserError = await repository
      .findOneOrFail(ownerId, { id: otherDocument.id })
      .catch((error: unknown) => error)
    const missingError = await repository
      .findOneOrFail(ownerId, { id: '00000000-0000-4000-8000-000000000099' })
      .catch((error: unknown) => error)

    expect(crossUserError).toBeInstanceOf(NotFoundException)
    expect(missingError).toBeInstanceOf(NotFoundException)
    expect((crossUserError as NotFoundException).getResponse()).toEqual(
      (missingError as NotFoundException).getResponse(),
    )
    expect(
      queries.some((query) => /where .*id.*=.* and .*user_id.*=/.test(query.toLowerCase())),
    ).toBe(true)
  })
})
