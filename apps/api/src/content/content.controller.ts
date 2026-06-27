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
  ContentSourceResponse,
  ContentSourceType,
  EnqueuedJobResponse,
  IngestionJobState,
  IngestionJobStatus,
  ValidationErrorItem,
} from '@readion/shared'
import { registerSourceRequestSchema } from '@readion/shared'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator'
import { CurrentUser, type CurrentUserPrincipal, Roles } from '../auth/auth.guards'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { ContentSourceService } from './content-source.service'

export class ListContentSourcesQueryDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional()
  certificationId?: string

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

class ContentSourceResponseDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  certificationId!: string
  @ApiProperty()
  type!: ContentSourceType
  @ApiProperty()
  url!: string
  @ApiProperty()
  enabled!: boolean
  @ApiProperty({ nullable: true, type: String })
  lastFetchedAt!: string | null
  @ApiProperty()
  recheckIntervalMinutes!: number
  @ApiProperty()
  createdAt!: string
}

class ContentSourceDetailDto {
  @ApiProperty({ type: ContentSourceResponseDto })
  data!: ContentSourceResponseDto
  @ApiProperty({ type: Object })
  relationships!: Record<string, never>
}

class CollectionMetaDto {
  @ApiProperty()
  total!: number
  @ApiProperty()
  page!: number
  @ApiProperty()
  limit!: number
}

class ContentSourceListDto {
  @ApiProperty({ type: [ContentSourceResponseDto] })
  data!: ContentSourceResponseDto[]
  @ApiProperty({ type: CollectionMetaDto })
  meta!: CollectionMetaDto
}

class EnqueuedJobResponseDto {
  @ApiProperty()
  jobId!: string
  @ApiProperty()
  contentSourceId!: string
  @ApiProperty()
  state!: string
}

class EnqueuedJobDetailDto {
  @ApiProperty({ type: EnqueuedJobResponseDto })
  data!: EnqueuedJobResponseDto
}

class IngestionJobStatusDto {
  @ApiProperty()
  jobId!: string
  @ApiProperty()
  state!: IngestionJobState
  @ApiProperty()
  progress!: number
  @ApiProperty()
  attemptsMade!: number
  @ApiProperty({ nullable: true, type: String })
  failedReason!: string | null
  @ApiProperty({ nullable: true, type: Number })
  timestamp!: number | null
  @ApiProperty({ nullable: true, type: Number })
  processedOn!: number | null
  @ApiProperty({ nullable: true, type: Number })
  finishedOn!: number | null
}

class IngestionJobListDto {
  @ApiProperty({ type: [IngestionJobStatusDto] })
  data!: IngestionJobStatusDto[]
  @ApiProperty({ type: CollectionMetaDto })
  meta!: CollectionMetaDto
}

class IngestionJobDetailDto {
  @ApiProperty({ type: IngestionJobStatusDto })
  data!: IngestionJobStatusDto
}

type SingleEnvelope<T> = { data: T; relationships: Record<string, never> }

@Controller('admin/content-sources')
@Roles('admin')
export class ContentController {
  constructor(private readonly service: ContentSourceService) {}

  @Post()
  @ApiResponse({ status: 201, type: ContentSourceDetailDto })
  @ApiResponse({ status: 400, description: 'Invalid source registration payload' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async register(
    @CurrentUser() actor: CurrentUserPrincipal,
    @Body() body: unknown,
  ): Promise<SingleEnvelope<ContentSourceResponse>> {
    const input = parseRegisterBody(body)
    return single(await this.service.register(actor.id, input))
  }

  @Get()
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: ContentSourceListDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  list(
    @Query() query: ListContentSourcesQueryDto,
  ): Promise<CollectionResult<ContentSourceResponse>> {
    return this.service.list({
      certificationId: query.certificationId,
      page: query.page,
      limit: query.limit,
    })
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: ContentSourceDetailDto })
  @ApiResponse({ status: 404, description: 'Content source not found' })
  async findOne(@Param('id') id: string): Promise<SingleEnvelope<ContentSourceResponse>> {
    return single(await this.service.findOne(id))
  }

  @Post(':id/disable')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: ContentSourceDetailDto })
  @ApiResponse({ status: 404, description: 'Content source not found' })
  async disable(
    @CurrentUser() actor: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<SingleEnvelope<ContentSourceResponse>> {
    return single(await this.service.setEnabled(actor.id, id, false))
  }

  @Post(':id/enable')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: ContentSourceDetailDto })
  @ApiResponse({ status: 404, description: 'Content source not found' })
  async enable(
    @CurrentUser() actor: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<SingleEnvelope<ContentSourceResponse>> {
    return single(await this.service.setEnabled(actor.id, id, true))
  }

  @Post(':id/reingest')
  @HttpCode(202)
  @ApiResponse({ status: 202, type: EnqueuedJobDetailDto })
  @ApiResponse({ status: 404, description: 'Content source not found' })
  @ApiResponse({ status: 409, description: 'Cannot re-ingest a disabled source' })
  async reingest(
    @CurrentUser() actor: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: EnqueuedJobResponse }> {
    return { data: await this.service.reingest(actor.id, id) }
  }

  @Get(':id/jobs')
  @ApiResponse({ status: 200, type: IngestionJobListDto })
  @ApiResponse({ status: 404, description: 'Content source not found' })
  listJobs(@Param('id') id: string): Promise<CollectionResult<IngestionJobStatus>> {
    return this.service.listJobs(id)
  }

  @Get(':id/jobs/:jobId')
  @ApiResponse({ status: 200, type: IngestionJobDetailDto })
  @ApiResponse({ status: 404, description: 'Content source or job not found' })
  async jobStatus(
    @Param('id') id: string,
    @Param('jobId') jobId: string,
  ): Promise<{ data: IngestionJobStatus }> {
    return { data: await this.service.getJobStatus(id, jobId) }
  }
}

function single<T>(data: T): SingleEnvelope<T> {
  return { data, relationships: {} }
}

function parseRegisterBody(body: unknown) {
  const result = registerSourceRequestSchema.safeParse(body)
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
