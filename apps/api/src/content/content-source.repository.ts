import { EntityManager, type FilterQuery } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { ContentSource } from '@readion/db'
import { type ContentSourceType, SOURCE_RECHECK_INTERVALS } from '@readion/shared'

export interface CreateContentSourceInput {
  certificationId: string
  type: ContentSourceType
  url: string
  recheckIntervalMinutes?: number
}

export interface ListContentSourcesInput {
  certificationId?: string
  page?: number
  limit?: number
}

export interface ContentSourceListResult {
  items: ContentSource[]
  total: number
}

@Injectable()
export class ContentSourceRepository {
  constructor(private readonly em: EntityManager) {}

  async create(input: CreateContentSourceInput): Promise<ContentSource> {
    const em = this.em.fork()
    const source = em.create(ContentSource, {
      certificationId: input.certificationId,
      type: input.type,
      url: input.url,
      recheckIntervalMinutes: input.recheckIntervalMinutes ?? SOURCE_RECHECK_INTERVALS[input.type],
    })
    em.persist(source)
    await em.flush()
    return source
  }

  findById(id: string): Promise<ContentSource | null> {
    return this.em.fork().findOne(ContentSource, { id })
  }

  async list(input: ListContentSourcesInput): Promise<ContentSourceListResult> {
    const limit = resolveLimit(input.limit)
    const offset = resolveOffset(input.page, limit)
    const where: FilterQuery<ContentSource> =
      input.certificationId !== undefined ? { certificationId: input.certificationId } : {}

    const [items, total] = await this.em
      .fork()
      .findAndCount(ContentSource, where, { orderBy: { createdAt: 'DESC' }, limit, offset })

    return { items, total }
  }

  async setEnabled(id: string, enabled: boolean): Promise<ContentSource | null> {
    const em = this.em.fork()
    const source = await em.findOne(ContentSource, { id })

    if (source === null) {
      return null
    }

    source.enabled = enabled
    await em.flush()
    return source
  }
}

function resolveLimit(limit?: number): number | undefined {
  return limit !== undefined && limit > 0 ? Math.floor(limit) : undefined
}

function resolveOffset(page: number | undefined, limit: number | undefined): number | undefined {
  if (limit === undefined) {
    return undefined
  }
  const resolvedPage = page !== undefined && page > 0 ? Math.floor(page) : 1
  return (resolvedPage - 1) * limit
}
