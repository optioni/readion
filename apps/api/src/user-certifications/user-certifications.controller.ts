import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse } from '@nestjs/swagger'
import type {
  EnrollmentResponse,
  EnrollmentSessionOverrides,
  EnrollmentStatus,
  ValidationErrorItem,
} from '@readion/shared'
import { enrollCertificationRequestSchema } from '@readion/shared'
import { IsEnum, IsOptional } from 'class-validator'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import type { WeakAreaDto } from '../weak-areas/weak-areas.service'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import { UserCertificationsService } from './user-certifications.service'

export class ListEnrollmentsQueryDto {
  @IsOptional()
  @IsEnum(['active', 'archived'])
  @ApiPropertyOptional({ enum: ['active', 'archived'] })
  status?: EnrollmentStatus
}

class EnrollmentSessionOverridesDto {
  @ApiProperty({ nullable: true, type: Number })
  duration!: number | null
  @ApiProperty({ nullable: true })
  contentMix!: string | null
  @ApiProperty({ nullable: true })
  difficulty!: string | null
  @ApiProperty({ nullable: true })
  focusArea!: string | null
  @ApiProperty({ nullable: true })
  learningStyle!: string | null
}

class EnrollmentResponseDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  certificationId!: string
  @ApiProperty({ enum: ['active', 'archived'] })
  status!: EnrollmentStatus
  @ApiProperty()
  enrolledAt!: string
  @ApiProperty({ type: EnrollmentSessionOverridesDto })
  sessionDefaults!: EnrollmentSessionOverrides
}

class WeakAreaResponseDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  domain!: string
  @ApiProperty()
  score!: number
  @ApiProperty()
  accuracy!: number
  @ApiProperty()
  meanConfidence!: number
  @ApiProperty()
  responseCount!: number
}

class WeakAreaRelationshipDto {
  @ApiProperty()
  href!: string
  @ApiPropertyOptional({ type: [WeakAreaResponseDto] })
  data?: WeakAreaDto[]
}

class EnrollmentRelationshipsDto {
  @ApiProperty({ type: WeakAreaRelationshipDto })
  weakAreas!: WeakAreaRelationshipDto
}

class EnrollmentDetailResponseDto {
  @ApiProperty({ type: EnrollmentResponseDto })
  data!: EnrollmentResponse
  @ApiProperty({ type: EnrollmentRelationshipsDto })
  relationships!: EnrollmentRelationshipsDto
}

class EnrollmentListMetaDto {
  @ApiProperty()
  total!: number
  @ApiProperty()
  page!: number
  @ApiProperty()
  limit!: number
}

class EnrollmentListResponseDto {
  @ApiProperty({ type: [EnrollmentResponseDto] })
  data!: EnrollmentResponse[]
  @ApiProperty({ type: EnrollmentListMetaDto })
  meta!: EnrollmentListMetaDto
}

class WeakAreaListMetaDto {
  @ApiProperty()
  total!: number
  @ApiProperty()
  page!: number
  @ApiProperty()
  limit!: number
}

class WeakAreaListResponseDto {
  @ApiProperty({ type: [WeakAreaResponseDto] })
  data!: WeakAreaDto[]
  @ApiProperty({ type: WeakAreaListMetaDto })
  meta!: WeakAreaListMetaDto
}

@Controller('user-certifications')
export class UserCertificationsController {
  constructor(
    private readonly service: UserCertificationsService,
    private readonly weakAreas: WeakAreasService,
  ) {}

  @Post()
  @ApiResponse({ status: 201, type: EnrollmentDetailResponseDto })
  async enroll(
    @CurrentUser() user: CurrentUserPrincipal,
    @Body() body: unknown,
  ): Promise<{ data: EnrollmentResponse; relationships: EnrollmentRelationshipsDto }> {
    const parsed = parseEnrollBody(body)
    const data = await this.service.enroll(user.id, parsed.certificationId, parsed.sessionDefaults)
    return { data, relationships: buildRelationships(data.id) }
  }

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'archived'] })
  @ApiResponse({ status: 200, type: EnrollmentListResponseDto })
  list(@CurrentUser() user: CurrentUserPrincipal, @Query() query: ListEnrollmentsQueryDto) {
    return this.service.list(user.id, query.status)
  }

  @Get(':id')
  @ApiQuery({ name: 'include', required: false })
  @ApiResponse({ status: 200, type: EnrollmentDetailResponseDto })
  async detail(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Query('include') include?: string,
  ): Promise<{ data: EnrollmentResponse; relationships: EnrollmentRelationshipsDto }> {
    const data = await this.service.findOne(user.id, id)
    const relationships = await this.buildRelationships(user.id, id, include)
    return { data, relationships }
  }

  @Get(':id/weak-areas')
  @ApiResponse({ status: 200, type: WeakAreaListResponseDto })
  async listWeakAreas(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: WeakAreaDto[]; meta: WeakAreaListMetaDto }> {
    const items = await this.weakAreas.listWithRecompute(user.id, id)
    return {
      data: items,
      meta: { total: items.length, page: 1, limit: items.length },
    }
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: EnrollmentDetailResponseDto })
  async updateOverrides(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<{ data: EnrollmentResponse; relationships: EnrollmentRelationshipsDto }> {
    const data = await this.service.updateOverrides(user.id, id, body)
    return { data, relationships: buildRelationships(id) }
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: EnrollmentDetailResponseDto })
  async archive(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: EnrollmentResponse; relationships: EnrollmentRelationshipsDto }> {
    const data = await this.service.archive(user.id, id)
    return { data, relationships: buildRelationships(id) }
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: EnrollmentDetailResponseDto })
  async restore(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: EnrollmentResponse; relationships: EnrollmentRelationshipsDto }> {
    const data = await this.service.restore(user.id, id)
    return { data, relationships: buildRelationships(id) }
  }

  private async buildRelationships(
    userId: string,
    enrollmentId: string,
    include?: string,
  ): Promise<EnrollmentRelationshipsDto> {
    const href = `/api/v1/user-certifications/${enrollmentId}/weak-areas`
    const includes = include?.split(',').map((s) => s.trim()) ?? []

    if (includes.includes('weakAreas')) {
      await this.weakAreas.recompute(enrollmentId)
      const data = await this.weakAreas.listForEnrollment(userId, enrollmentId)
      return { weakAreas: { href, data } }
    }

    return { weakAreas: { href } }
  }
}

function buildRelationships(enrollmentId: string): EnrollmentRelationshipsDto {
  return {
    weakAreas: { href: `/api/v1/user-certifications/${enrollmentId}/weak-areas` },
  }
}

function parseEnrollBody(body: unknown) {
  const result = enrollCertificationRequestSchema.safeParse(body)

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
