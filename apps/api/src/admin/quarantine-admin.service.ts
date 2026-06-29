import { EntityManager, type FilterQuery } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { QuarantinedItem, type QuarantinedItemStatus } from '@readion/db'
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, type QuarantinedItemListItem } from '@readion/shared'
import type { CollectionResult } from '../common/interceptors/response.interceptor'

interface Pagination {
  page: number
  limit: number
  offset: number
}

interface ListQuarantineFilters {
  page?: number
  limit?: number
  certificationId?: string
  status?: QuarantinedItemStatus
}

function resolvePagination(page?: number, limit?: number): Pagination {
  const resolvedPage = page !== undefined && page > 0 ? Math.floor(page) : 1
  const requestedLimit = limit !== undefined && limit > 0 ? Math.floor(limit) : PAGE_SIZE_DEFAULT
  const resolvedLimit = Math.min(requestedLimit, PAGE_SIZE_MAX)
  return { page: resolvedPage, limit: resolvedLimit, offset: (resolvedPage - 1) * resolvedLimit }
}

@Injectable()
export class QuarantineAdminService {
  constructor(private readonly em: EntityManager) {}

  async list(filters: ListQuarantineFilters): Promise<CollectionResult<QuarantinedItemListItem>> {
    const { page, limit, offset } = resolvePagination(filters.page, filters.limit)
    const em = this.em.fork()

    const where: FilterQuery<QuarantinedItem> = {}
    if (filters.certificationId !== undefined) {
      where.certificationId = filters.certificationId
    }
    if (filters.status !== undefined) {
      where.status = filters.status
    }

    const [rows, total] = await em.findAndCount(QuarantinedItem, where, {
      orderBy: { createdAt: 'DESC' },
      limit,
      offset,
    })

    const items = rows.map(
      (row): QuarantinedItemListItem => ({
        id: row.id,
        certificationId: row.certificationId,
        domain: row.domain,
        verdict: row.verdict,
        reason: row.reason,
        status: row.status,
        provenance: row.provenance,
        createdAt: row.createdAt.toISOString(),
      }),
    )

    return { items, meta: { total, page, limit } }
  }
}
