import { EntityManager, QueryOrder } from '@mikro-orm/core'
import { InjectQueue } from '@nestjs/bullmq'
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Certification } from '@readion/db'
import {
  AuditAction,
  CERT_EXTRACTION_QUEUE,
  type CertExtractionResult,
  type CertificationResponse,
  type CreateCertificationRequest,
  type DiscoverSourcesRequest,
  type DiscoverSourcesResponse,
  type DueForReverificationItem,
  type ExtractionEnqueuedResponse,
  type ExtractionStatusResponse,
  type ExtractRequest,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  type ReverifyCertificationRequest,
  validateDomainWeights,
} from '@readion/shared'
import type { Queue } from 'bullmq'
import { AuditLogService } from '../admin/audit-log.service'
import { mapCertificationToDto } from '../certifications/certifications.mapper'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { CertDiscoveryService } from './cert-discovery.service'

export interface ListDueForReverificationQuery {
  page?: number
  limit?: number
}

interface CertExtractionJobData {
  name: string
  code?: string
  confirmedSourceUrl: string
}

@Injectable()
export class CertSetupService {
  constructor(
    private readonly discovery: CertDiscoveryService,
    @InjectQueue(CERT_EXTRACTION_QUEUE)
    private readonly queue: Queue<CertExtractionJobData, CertExtractionResult>,
    private readonly em: EntityManager,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  async discoverSources(request: DiscoverSourcesRequest): Promise<DiscoverSourcesResponse> {
    return this.discovery.discoverSources(request)
  }

  async enqueueExtraction(request: ExtractRequest): Promise<ExtractionEnqueuedResponse> {
    const job = await this.queue.add('extract', {
      name: request.name,
      code: request.code,
      confirmedSourceUrl: request.confirmedSourceUrl,
    })
    return { jobId: String(job.id), state: await job.getState() }
  }

  async readExtractionResult(jobId: string): Promise<ExtractionStatusResponse> {
    const job = await this.queue.getJob(jobId)
    if (job === undefined) {
      throw new NotFoundException('Extraction job not found')
    }
    return { state: await job.getState(), fields: job.returnvalue?.fields ?? null }
  }

  async createDraft(
    actorUserId: string,
    body: CreateCertificationRequest,
  ): Promise<CertificationResponse> {
    if (!validateDomainWeights(body.domains)) {
      throw new UnprocessableEntityException('Domain weights must sum to 100')
    }

    const em = this.em.fork()
    const existing = await em.findOne(Certification, { code: body.code })
    if (existing !== null) {
      throw new ConflictException(`Certification with code ${body.code} already exists`)
    }

    const cert = em.create(Certification, {
      name: body.name,
      provider: body.provider,
      code: body.code,
      domains: body.domains,
      questionCount: body.questionCount,
      passingScore: body.passingScore,
      timeLimitMinutes: body.timeLimitMinutes,
      provenance: body.provenance,
      state: 'draft',
      verifiedAt: new Date(),
    })
    em.persist(cert)
    await em.flush()

    await this.auditLog.record({
      actorUserId,
      action: AuditAction.CertCreated,
      targetType: 'Certification',
      targetId: cert.id,
      after: snapshot(cert),
    })

    return mapCertificationToDto(cert)
  }

  async reverify(
    actorUserId: string,
    id: string,
    body: ReverifyCertificationRequest,
  ): Promise<CertificationResponse> {
    const em = this.em.fork()
    const cert = await em.findOne(Certification, { id })
    if (cert === null) {
      throw new NotFoundException('Certification not found')
    }

    const before = snapshot(cert)

    cert.domains = body.domains
    cert.questionCount = body.questionCount
    cert.passingScore = body.passingScore
    cert.timeLimitMinutes = body.timeLimitMinutes
    cert.provenance = body.provenance
    cert.verifiedAt = new Date()
    await em.flush()

    await this.auditLog.record({
      actorUserId,
      action: AuditAction.CertReverified,
      targetType: 'Certification',
      targetId: cert.id,
      before,
      after: snapshot(cert),
    })

    return mapCertificationToDto(cert)
  }

  async listDueForReverification(
    query: ListDueForReverificationQuery,
  ): Promise<CollectionResult<DueForReverificationItem>> {
    const page = query.page !== undefined && query.page > 0 ? Math.floor(query.page) : 1
    const requestedLimit =
      query.limit !== undefined && query.limit > 0 ? Math.floor(query.limit) : PAGE_SIZE_DEFAULT
    const limit = Math.min(requestedLimit, PAGE_SIZE_MAX)

    const intervalDays = this.config.get<number>('CERT_REVERIFICATION_INTERVAL_DAYS') ?? 0
    const cutoff = new Date(Date.now() - intervalDays * 24 * 60 * 60 * 1000)

    const em = this.em.fork()
    const [certs, total] = await em.findAndCount(
      Certification,
      { $or: [{ verifiedAt: null }, { verifiedAt: { $lt: cutoff } }] },
      { limit, offset: (page - 1) * limit, orderBy: { verifiedAt: QueryOrder.ASC_NULLS_FIRST } },
    )

    return {
      items: certs.map((cert) => ({
        id: cert.id,
        name: cert.name,
        code: cert.code,
        verifiedAt: cert.verifiedAt?.toISOString() ?? null,
        dueForReverification: true,
      })),
      meta: { total, page, limit },
    }
  }
}

function snapshot(cert: Certification): Record<string, unknown> {
  return {
    name: cert.name,
    provider: cert.provider,
    code: cert.code,
    domains: cert.domains,
    questionCount: cert.questionCount,
    passingScore: cert.passingScore,
    timeLimitMinutes: cert.timeLimitMinutes,
    provenance: cert.provenance,
    verifiedAt: cert.verifiedAt?.toISOString() ?? null,
  }
}
