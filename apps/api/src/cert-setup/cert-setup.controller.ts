import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse } from '@nestjs/swagger'
import type {
  CertificationDomain,
  CertificationResponse,
  DiscoverSourcesResponse,
  DueForReverificationItem,
  ExtractionEnqueuedResponse,
  ExtractionStatusResponse,
  ValidationErrorItem,
} from '@readion/shared'
import {
  createCertificationRequestSchema,
  discoverSourcesRequestSchema,
  extractRequestSchema,
  reverifyCertificationRequestSchema,
} from '@readion/shared'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Min } from 'class-validator'
import type { ZodType } from 'zod'
import { CurrentUser, type CurrentUserPrincipal, Roles } from '../auth/auth.guards'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { CertSetupService } from './cert-setup.service'

export class ListDueForReverificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ type: Number })
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ type: Number })
  limit?: number
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
  @ApiProperty({ type: Object, isArray: true })
  domains!: CertificationDomain[]
  @ApiProperty()
  questionCount!: number
  @ApiProperty()
  passingScore!: number
  @ApiProperty()
  timeLimitMinutes!: number
  @ApiProperty()
  state!: string
}

class CertificationDetailDto {
  @ApiProperty({ type: CertificationResponseDto })
  data!: CertificationResponseDto
  @ApiProperty({ type: Object })
  relationships!: Record<string, never>
}

class DiscoveryCandidateDto {
  @ApiProperty()
  url!: string
  @ApiProperty()
  title!: string
  @ApiPropertyOptional()
  snippet?: string
}

class SuggestedContentSourceDto {
  @ApiProperty()
  url!: string
  @ApiProperty()
  type!: string
}

class DiscoverSourcesResponseDto {
  @ApiProperty({ type: [DiscoveryCandidateDto] })
  candidates!: DiscoveryCandidateDto[]
  @ApiPropertyOptional({ type: [SuggestedContentSourceDto] })
  suggestedContentSources?: SuggestedContentSourceDto[]
}

class DiscoverSourcesDetailDto {
  @ApiProperty({ type: DiscoverSourcesResponseDto })
  data!: DiscoverSourcesResponseDto
  @ApiProperty({ type: Object })
  relationships!: Record<string, never>
}

class ExtractionEnqueuedResponseDto {
  @ApiProperty()
  jobId!: string
  @ApiProperty()
  state!: string
}

class ExtractionEnqueuedDetailDto {
  @ApiProperty({ type: ExtractionEnqueuedResponseDto })
  data!: ExtractionEnqueuedResponseDto
}

class ExtractionStatusResponseDto {
  @ApiProperty()
  state!: string
  @ApiProperty({ type: Object, nullable: true })
  fields!: Record<string, unknown> | null
}

class ExtractionStatusDetailDto {
  @ApiProperty({ type: ExtractionStatusResponseDto })
  data!: ExtractionStatusResponseDto
}

class DueForReverificationItemDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  name!: string
  @ApiProperty()
  code!: string
  @ApiProperty({ nullable: true, type: String })
  verifiedAt!: string | null
  @ApiProperty()
  dueForReverification!: boolean
}

class CollectionMetaDto {
  @ApiProperty()
  total!: number
  @ApiProperty()
  page!: number
  @ApiProperty()
  limit!: number
}

class DueForReverificationListDto {
  @ApiProperty({ type: [DueForReverificationItemDto] })
  data!: DueForReverificationItemDto[]
  @ApiProperty({ type: CollectionMetaDto })
  meta!: CollectionMetaDto
}

type SingleEnvelope<T> = { data: T; relationships: Record<string, never> }

@Controller('admin/certifications')
@Roles('admin')
export class CertSetupController {
  constructor(private readonly service: CertSetupService) {}

  @Post('discover-sources')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: DiscoverSourcesDetailDto })
  @ApiResponse({ status: 400, description: 'Invalid discovery request' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async discoverSources(@Body() body: unknown): Promise<SingleEnvelope<DiscoverSourcesResponse>> {
    return single(await this.service.discoverSources(parse(discoverSourcesRequestSchema, body)))
  }

  @Post('extract')
  @HttpCode(202)
  @ApiResponse({ status: 202, type: ExtractionEnqueuedDetailDto })
  @ApiResponse({ status: 400, description: 'Invalid extraction request' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async extract(@Body() body: unknown): Promise<{ data: ExtractionEnqueuedResponse }> {
    return { data: await this.service.enqueueExtraction(parse(extractRequestSchema, body)) }
  }

  @Get('extractions/:jobId')
  @ApiResponse({ status: 200, type: ExtractionStatusDetailDto })
  @ApiResponse({ status: 404, description: 'Extraction job not found' })
  async readExtraction(@Param('jobId') jobId: string): Promise<{ data: ExtractionStatusResponse }> {
    return { data: await this.service.readExtractionResult(jobId) }
  }

  @Get('due-for-reverification')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: DueForReverificationListDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  listDueForReverification(
    @Query() query: ListDueForReverificationQueryDto,
  ): Promise<CollectionResult<DueForReverificationItem>> {
    return this.service.listDueForReverification({ page: query.page, limit: query.limit })
  }

  @Post()
  @ApiResponse({ status: 201, type: CertificationDetailDto })
  @ApiResponse({ status: 400, description: 'Invalid certification payload' })
  @ApiResponse({ status: 409, description: 'Certification code already exists' })
  @ApiResponse({ status: 422, description: 'Domain weights must sum to 100' })
  async create(
    @CurrentUser() actor: CurrentUserPrincipal,
    @Body() body: unknown,
  ): Promise<SingleEnvelope<CertificationResponse>> {
    return single(
      await this.service.createDraft(actor.id, parse(createCertificationRequestSchema, body)),
    )
  }

  @Post(':id/reverify')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: CertificationDetailDto })
  @ApiResponse({ status: 404, description: 'Certification not found' })
  async reverify(
    @CurrentUser() actor: CurrentUserPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SingleEnvelope<CertificationResponse>> {
    return single(
      await this.service.reverify(actor.id, id, parse(reverifyCertificationRequestSchema, body)),
    )
  }
}

function single<T>(data: T): SingleEnvelope<T> {
  return { data, relationships: {} }
}

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new BadRequestException({
      errors: result.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.') || 'body',
        message: issue.message,
      })) satisfies ValidationErrorItem[],
    })
  }
  return result.data
}
