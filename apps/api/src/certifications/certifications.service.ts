import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Certification } from '@readion/db'
import type { CertificationResponse } from '@readion/shared'
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@readion/shared'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { mapCertificationToDto } from './certifications.mapper'

export interface ListCertificationsOptions {
  page?: number
  limit?: number
}

@Injectable()
export class CertificationsService {
  constructor(private readonly em: EntityManager) {}

  async list(
    options: ListCertificationsOptions = {},
  ): Promise<CollectionResult<CertificationResponse>> {
    const page = Math.max(1, options.page ?? 1)
    const limit = Math.min(options.limit ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX)
    const offset = (page - 1) * limit

    const em = this.em.fork()
    const [certs, total] = await em.findAndCount(
      Certification,
      { state: 'live' },
      { limit, offset, orderBy: { name: 'ASC' } },
    )

    return {
      items: certs.map(mapCertificationToDto),
      meta: { total, page, limit },
    }
  }

  async findOne(id: string): Promise<CertificationResponse> {
    const em = this.em.fork()
    const cert = await em.findOne(Certification, { id, state: 'live' })

    if (cert === null) {
      throw new NotFoundException('Certification not found')
    }

    return mapCertificationToDto(cert)
  }
}
