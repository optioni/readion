import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse } from '@nestjs/swagger'
import type {
  CertificationDomain,
  CertificationResponse,
  CertificationState,
} from '@readion/shared'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Min } from 'class-validator'
import { Public } from '../auth/auth.guards'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { CertificationsService } from './certifications.service'

export class ListCertificationsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @ApiPropertyOptional({ minimum: 1 })
  page?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @ApiPropertyOptional({ minimum: 1, description: 'Capped at 100 by the service' })
  limit?: number
}

class CertificationDomainDto {
  @ApiProperty()
  name!: string
  @ApiProperty()
  weight!: number
}

class CertificationResponseDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  name!: string
  @ApiProperty()
  provider!: string
  @ApiProperty()
  code!: string
  @ApiProperty({ type: [CertificationDomainDto] })
  domains!: CertificationDomain[]
  @ApiProperty()
  questionCount!: number
  @ApiProperty()
  passingScore!: number
  @ApiProperty()
  timeLimitMinutes!: number
  @ApiProperty({ enum: ['draft', 'live'] })
  state!: CertificationState
}

class CertificationListMetaDto {
  @ApiProperty()
  total!: number
  @ApiProperty()
  page!: number
  @ApiProperty()
  limit!: number
}

class CertificationListResponseDto {
  @ApiProperty({ type: [CertificationResponseDto] })
  data!: CertificationResponse[]
  @ApiProperty({ type: CertificationListMetaDto })
  meta!: CertificationListMetaDto
}

class CertificationDetailResponseDto {
  @ApiProperty({ type: CertificationResponseDto })
  data!: CertificationResponse
  @ApiProperty()
  relationships!: Record<string, never>
}

@Controller('certifications')
@Public()
export class CertificationsController {
  constructor(private readonly service: CertificationsService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: CertificationListResponseDto })
  list(
    @Query() query: ListCertificationsQueryDto,
  ): Promise<CollectionResult<CertificationResponse>> {
    return this.service.list(query)
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: CertificationDetailResponseDto })
  async detail(
    @Param('id') id: string,
  ): Promise<{ data: CertificationResponse; relationships: Record<string, never> }> {
    const data = await this.service.findOne(id)
    return { data, relationships: {} }
  }
}
