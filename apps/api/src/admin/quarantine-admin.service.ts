import { EntityManager, type FilterQuery } from '@mikro-orm/core'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { QuarantinedItem, type QuarantinedItemStatus } from '@readion/db'
import {
  AuditAction,
  type AuditActionValue,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  type QuarantinedItemDetail,
  type QuarantinedItemDetailContent,
  type QuarantinedItemListItem,
  type QuestionFormat,
  questionFormats,
} from '@readion/shared'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { LlmResponseCacheService } from '../llm/llm-response-cache.service'
import { AuditLogService } from './audit-log.service'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : []
}

function toQuestionFormat(value: unknown): QuestionFormat | null {
  return questionFormats.find((format) => format === value) ?? null
}

export function mapGeneratedContent(
  generatedContent: Record<string, unknown> | null,
): QuarantinedItemDetailContent | null {
  if (generatedContent === null) {
    return null
  }

  const item = generatedContent.item
  if (!isRecord(item) || typeof item.question !== 'string' || item.question.length === 0) {
    return null
  }

  return {
    question: item.question,
    options: toStringArray(item.options),
    answerKey: typeof item.correctAnswer === 'string' ? item.correctAnswer : '',
    format: toQuestionFormat(generatedContent.format),
    supportingSpans: toStringArray(item.supportingSpans),
    sourceChunkIds: toStringArray(item.sourceChunkIds),
  }
}

const LIST_ITEM_FIELDS = [
  'id',
  'certificationId',
  'domain',
  'verdict',
  'reason',
  'status',
  'provenance',
  'createdAt',
] as const satisfies readonly (keyof QuarantinedItem)[]

type ListItemFields = Pick<QuarantinedItem, (typeof LIST_ITEM_FIELDS)[number]>

function toListItem(row: ListItemFields): QuarantinedItemListItem {
  return {
    id: row.id,
    certificationId: row.certificationId,
    domain: row.domain,
    verdict: row.verdict,
    reason: row.reason,
    status: row.status,
    provenance: row.provenance,
    createdAt: row.createdAt.toISOString(),
  }
}

export interface QuarantineResolution {
  id: string
  status: QuarantinedItemStatus
}

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
  constructor(
    private readonly em: EntityManager,
    private readonly auditLogService: AuditLogService,
    private readonly cache: LlmResponseCacheService,
  ) {}

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
      fields: LIST_ITEM_FIELDS,
      orderBy: { createdAt: 'DESC' },
      limit,
      offset,
    })

    const items = rows.map(toListItem)

    return { items, meta: { total, page, limit } }
  }

  async getDetail(id: string): Promise<QuarantinedItemDetail> {
    const em = this.em.fork()
    const item = await em.findOne(QuarantinedItem, { id })

    if (item === null) {
      throw new NotFoundException('Quarantined item not found')
    }

    return { ...toListItem(item), content: mapGeneratedContent(item.generatedContent) }
  }

  async approve(actorUserId: string, id: string): Promise<QuarantineResolution> {
    return this.resolve(actorUserId, id, 'approved', AuditAction.QuarantineApproved, true)
  }

  async reject(actorUserId: string, id: string): Promise<QuarantineResolution> {
    return this.resolve(actorUserId, id, 'rejected', AuditAction.QuarantineRejected, false)
  }

  private async resolve(
    actorUserId: string,
    id: string,
    status: Exclude<QuarantinedItemStatus, 'pending'>,
    action: AuditActionValue,
    reinstate: boolean,
  ): Promise<QuarantineResolution> {
    return this.em.fork().transactional(async (tx) => {
      const item = await tx.findOne(QuarantinedItem, { id })

      if (item === null) {
        throw new NotFoundException('Quarantined item not found')
      }

      if (item.status !== 'pending') {
        throw new ConflictException('Quarantined item has already been resolved')
      }

      const before = { status: item.status }
      item.status = status

      if (reinstate) {
        await this.reinstate(item)
      }

      await this.auditLogService.record(
        {
          actorUserId,
          action,
          targetType: 'quarantined_item',
          targetId: id,
          before,
          after: { status },
        },
        tx,
      )

      return { id: item.id, status: item.status }
    })
  }

  private async reinstate(item: QuarantinedItem): Promise<void> {
    await this.cache.set(item.cacheKey, item.provenance.sourceChunkIds, {
      text: JSON.stringify({ ...(item.generatedContent ?? {}), provenance: item.provenance }),
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
      verified: true,
    })
  }
}
