import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse } from '@nestjs/swagger'
import type {
  SessionFocusArea,
  SessionItemResponse,
  SessionKind,
  SessionListMeta,
  SessionResponse,
  SessionStatus,
  SessionWithItemsResponse,
  ValidationErrorItem,
} from '@readion/shared'
import { createSessionRequestSchema, sessionStatuses } from '@readion/shared'
import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { SessionsService } from './sessions.service'

type HttpResponse = { status(code: number): HttpResponse }

export class ListSessionsQueryDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional()
  certificationId?: string

  @IsOptional()
  @IsEnum(sessionStatuses)
  @ApiPropertyOptional({ enum: sessionStatuses })
  status?: SessionStatus

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @ApiPropertyOptional()
  page?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @ApiPropertyOptional()
  limit?: number
}

class SessionItemResponseDto {
  @ApiProperty()
  index!: number
  @ApiProperty()
  type!: string
  @ApiProperty()
  domain!: string
  @ApiProperty()
  content!: string
  @ApiProperty()
  completed!: boolean
  @ApiProperty({ type: [String] })
  sourceChunkIds!: string[]
  @ApiProperty({ type: [String] })
  supportingSpans!: string[]
}

class SessionResponseDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  userCertificationId!: string
  @ApiProperty()
  kind!: SessionKind
  @ApiProperty()
  status!: SessionStatus
  @ApiProperty()
  durationMinutes!: number
  @ApiProperty()
  contentMix!: string
  @ApiProperty()
  difficulty!: string
  @ApiProperty()
  focusArea!: SessionFocusArea
  @ApiProperty()
  learningStyle!: string
  @ApiProperty()
  lastItemIndex!: number
  @ApiProperty()
  startedAt!: string
  @ApiPropertyOptional({ nullable: true })
  endedAt!: string | null
  @ApiPropertyOptional({ type: [SessionItemResponseDto] })
  items?: SessionItemResponse[]
}

class SessionRelationshipsDto {
  @ApiProperty()
  items!: { href: string }
}

class SessionDetailResponseDto {
  @ApiProperty({ type: SessionResponseDto })
  data!: SessionResponse
  @ApiProperty({ type: SessionRelationshipsDto })
  relationships!: SessionRelationshipsDto
}

class SessionListMetaDto {
  @ApiProperty()
  total!: number
  @ApiProperty()
  page!: number
  @ApiProperty()
  limit!: number
}

class SessionListResponseDto {
  @ApiProperty({ type: [SessionResponseDto] })
  data!: SessionResponse[]
  @ApiProperty({ type: SessionListMetaDto })
  meta!: SessionListMeta
}

class GoDeeperResponseDto {
  @ApiProperty()
  expandedContent!: string
}

@Controller('sessions')
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  @Get()
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: SessionListResponseDto })
  async list(
    @CurrentUser() user: CurrentUserPrincipal,
    @Query() query: ListSessionsQueryDto,
  ): Promise<CollectionResult<SessionResponse>> {
    return this.service.list(user.id, {
      certificationId: query.certificationId,
      status: query.status,
      page: query.page,
      limit: query.limit,
    })
  }

  @Get(':id')
  @ApiQuery({ name: 'include', required: false })
  @ApiResponse({ status: 200, type: SessionDetailResponseDto })
  async detail(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Query('include') include?: string,
  ): Promise<{ data: SessionWithItemsResponse; relationships: SessionRelationshipsDto }> {
    const includes = include?.split(',').map((s) => s.trim()) ?? []
    const data = await this.service.findOne(user.id, id, includes.includes('items'))
    return { data, relationships: buildRelationships(id) }
  }

  @Post(':id/items/:index/complete')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: SessionDetailResponseDto })
  async completeItem(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Param('index') index: string,
  ): Promise<{ data: SessionResponse; relationships: SessionRelationshipsDto }> {
    const data = await this.service.completeItem(user.id, id, Number.parseInt(index, 10))
    return { data, relationships: buildRelationships(id) }
  }

  @Post(':id/items/:index/go-deeper')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: GoDeeperResponseDto })
  async goDeeper(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Param('index') index: string,
  ): Promise<{ data: GoDeeperResponseDto; relationships: SessionRelationshipsDto }> {
    const expandedContent = await this.service.goDeeper(user.id, id, Number.parseInt(index, 10))
    return { data: { expandedContent }, relationships: buildRelationships(id) }
  }

  @Post(':id/end')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: SessionDetailResponseDto })
  async end(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: SessionResponse; relationships: SessionRelationshipsDto }> {
    const data = await this.service.end(user.id, id)
    return { data, relationships: buildRelationships(id) }
  }
}

@Controller('user-certifications')
export class EnrollmentSessionsController {
  constructor(private readonly service: SessionsService) {}

  @Post(':enrollmentId/sessions')
  @ApiResponse({ status: 201, type: SessionDetailResponseDto })
  async create(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<{ data: SessionResponse; relationships: SessionRelationshipsDto }> {
    const request = parseCreateBody(body)
    const { session, statusCode } = await this.service.create(user.id, enrollmentId, request)
    res.status(statusCode)
    return { data: session, relationships: buildRelationships(session.id) }
  }
}

function buildRelationships(sessionId: string): SessionRelationshipsDto {
  return {
    items: { href: `/api/v1/sessions/${sessionId}/items` },
  }
}

function parseCreateBody(body: unknown) {
  const result = createSessionRequestSchema.safeParse(body)

  if (!result.success) {
    throw new UnprocessableEntityException({
      errors: result.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.') || 'body',
        message: issue.message,
      })) satisfies ValidationErrorItem[],
    })
  }

  return result.data
}
