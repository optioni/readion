import { MikroORM } from '@mikro-orm/core'
import { SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { ContentChunkSchema } from './content-chunk.entity'
import { ContentSource, ContentSourceSchema } from './content-source.entity'

describe('ContentSource entity', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>

  beforeAll(async () => {
    container = await startPostgresContainer()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [ContentSourceSchema, ContentChunkSchema] as any[],
      host: container.getHost(),
      port: container.getMappedPort(5432),
      dbName: 'readion_test',
    })
    await orm.migrator.up()
    await orm.schema.update({ safe: true })
  }, 120_000)

  afterAll(async () => {
    await orm?.close()
    await container?.stop()
  })

  beforeEach(async () => {
    const conn = orm.em.getConnection()
    await conn.execute('TRUNCATE TABLE content_chunks, content_sources CASCADE')
  })

  it('persists with required fields, enabled=true, lastFetchedAt=null', async () => {
    const em = orm.em.fork()
    const source = em.create(ContentSource, {
      certificationId: '00000000-0000-0000-0000-000000000001',
      type: 'web',
      url: 'https://docs.aws.amazon.com/something',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    em.persist(source)
    await em.flush()
    em.clear()

    const found = await em.findOneOrFail(ContentSource, { id: source.id })
    expect(found.enabled).toBe(true)
    expect(found.lastFetchedAt).toBeNull()
    expect(found.certificationId).toBe('00000000-0000-0000-0000-000000000001')
    expect(found.type).toBe('web')
    expect(found.url).toBe('https://docs.aws.amazon.com/something')
  })

  it('persists weekly recheck interval for web type', async () => {
    const em = orm.em.fork()
    const source = em.create(ContentSource, {
      certificationId: '00000000-0000-0000-0000-000000000001',
      type: 'web',
      url: 'https://docs.aws.amazon.com/',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    em.persist(source)
    await em.flush()
    em.clear()

    const found = await em.findOneOrFail(ContentSource, { id: source.id })
    expect(found.recheckIntervalMinutes).toBe(10_080)
  })

  it('persists monthly recheck interval for pdf type', async () => {
    const em = orm.em.fork()
    const source = em.create(ContentSource, {
      certificationId: '00000000-0000-0000-0000-000000000001',
      type: 'pdf',
      url: 'https://docs.aws.amazon.com/guide.pdf',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.pdf,
    })
    em.persist(source)
    await em.flush()
    em.clear()

    const found = await em.findOneOrFail(ContentSource, { id: source.id })
    expect(found.recheckIntervalMinutes).toBe(43_200)
  })
})
