import { randomUUID } from 'node:crypto'
import { ContentSource, createDbHarness, type DbHarness } from '@readion/db'
import { SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ContentSourceRepository } from './content-source.repository'

async function seedSource(
  harness: DbHarness,
  data: { certificationId: string; url: string; createdAt: Date; enabled?: boolean },
): Promise<ContentSource> {
  const em = harness.getEm()
  const source = em.create(ContentSource, {
    certificationId: data.certificationId,
    type: 'web',
    url: data.url,
    recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    enabled: data.enabled ?? true,
    createdAt: data.createdAt,
    updatedAt: data.createdAt,
  })
  em.persist(source)
  await em.flush()
  return source
}

describe('ContentSourceRepository', () => {
  let harness: DbHarness | undefined

  beforeAll(async () => {
    harness = await createDbHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness?.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  function db(): DbHarness {
    if (!harness) throw new Error('DB harness was not initialized')
    return harness
  }

  function repository(): ContentSourceRepository {
    return new ContentSourceRepository(db().getEm())
  }

  describe('create', () => {
    it('derives recheckIntervalMinutes from SOURCE_RECHECK_INTERVALS when omitted', async () => {
      const certificationId = randomUUID()

      const created = await repository().create({
        certificationId,
        type: 'reddit',
        url: 'https://reddit.com/r/aws',
      })

      expect(created.id).toBeDefined()
      expect(created.certificationId).toBe(certificationId)
      expect(created.recheckIntervalMinutes).toBe(SOURCE_RECHECK_INTERVALS.reddit)
      expect(created.enabled).toBe(true)
      expect(created.lastFetchedAt).toBeNull()
    })

    it('honors an explicit recheckIntervalMinutes when provided', async () => {
      const created = await repository().create({
        certificationId: randomUUID(),
        type: 'web',
        url: 'https://example.com',
        recheckIntervalMinutes: 99,
      })

      expect(created.recheckIntervalMinutes).toBe(99)
    })
  })

  describe('findById', () => {
    it('returns the source when present', async () => {
      const seeded = await seedSource(db(), {
        certificationId: randomUUID(),
        url: 'https://example.com/one',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })

      const found = await repository().findById(seeded.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(seeded.id)
      expect(found?.url).toBe('https://example.com/one')
    })

    it('returns null when absent', async () => {
      const found = await repository().findById(randomUUID())

      expect(found).toBeNull()
    })
  })

  describe('list', () => {
    it('lists sources for a certification ordered by createdAt DESC', async () => {
      const certificationId = randomUUID()
      const otherCertificationId = randomUUID()

      await seedSource(db(), {
        certificationId,
        url: 'https://example.com/oldest',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })
      await seedSource(db(), {
        certificationId,
        url: 'https://example.com/newest',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      })
      await seedSource(db(), {
        certificationId,
        url: 'https://example.com/middle',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      })
      await seedSource(db(), {
        certificationId: otherCertificationId,
        url: 'https://example.com/other',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      })

      const result = await repository().list({ certificationId })

      expect(result.total).toBe(3)
      expect(result.items.map((item) => item.url)).toEqual([
        'https://example.com/newest',
        'https://example.com/middle',
        'https://example.com/oldest',
      ])
    })

    it('lists all sources newest-first when no certification filter is given', async () => {
      await seedSource(db(), {
        certificationId: randomUUID(),
        url: 'https://example.com/a',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })
      await seedSource(db(), {
        certificationId: randomUUID(),
        url: 'https://example.com/b',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      })

      const result = await repository().list({})

      expect(result.total).toBe(2)
      expect(result.items.map((item) => item.url)).toEqual([
        'https://example.com/b',
        'https://example.com/a',
      ])
    })

    it('paginates with page/limit translated to offset', async () => {
      const certificationId = randomUUID()
      for (let index = 0; index < 5; index += 1) {
        await seedSource(db(), {
          certificationId,
          url: `https://example.com/${index}`,
          createdAt: new Date(Date.UTC(2026, 0, index + 1)),
        })
      }

      const page2 = await repository().list({ certificationId, page: 2, limit: 2 })

      expect(page2.total).toBe(5)
      expect(page2.items.map((item) => item.url)).toEqual([
        'https://example.com/2',
        'https://example.com/1',
      ])
    })
  })

  describe('setEnabled', () => {
    it('toggles the enabled flag and returns the updated source', async () => {
      const seeded = await seedSource(db(), {
        certificationId: randomUUID(),
        url: 'https://example.com/toggle',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        enabled: true,
      })

      const updated = await repository().setEnabled(seeded.id, false)

      expect(updated?.enabled).toBe(false)

      const reloaded = await repository().findById(seeded.id)
      expect(reloaded?.enabled).toBe(false)
    })

    it('returns null when the source is absent', async () => {
      const updated = await repository().setEnabled(randomUUID(), false)

      expect(updated).toBeNull()
    })
  })
})
