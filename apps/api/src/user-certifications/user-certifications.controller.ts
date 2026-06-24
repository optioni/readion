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

class EnrollmentDetailResponseDto {
  @ApiProperty({ type: EnrollmentResponseDto })
  data!: EnrollmentResponse
  @ApiProperty()
  relationships!: Record<string, never>
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

@Controller('user-certifications')
export class UserCertificationsController {
  constructor(private readonly service: UserCertificationsService) {}

  @Post()
  @ApiResponse({ status: 201, type: EnrollmentDetailResponseDto })
  async enroll(
    @CurrentUser() user: CurrentUserPrincipal,
    @Body() body: unknown,
  ): Promise<{ data: EnrollmentResponse; relationships: Record<string, never> }> {
    const parsed = parseEnrollBody(body)
    const data = await this.service.enroll(user.id, parsed.certificationId, parsed.sessionDefaults)
    return { data, relationships: {} }
  }

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'archived'] })
  @ApiResponse({ status: 200, type: EnrollmentListResponseDto })
  list(@CurrentUser() user: CurrentUserPrincipal, @Query() query: ListEnrollmentsQueryDto) {
    return this.service.list(user.id, query.status)
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: EnrollmentDetailResponseDto })
  async detail(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: EnrollmentResponse; relationships: Record<string, never> }> {
    const data = await this.service.findOne(user.id, id)
    return { data, relationships: {} }
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: EnrollmentDetailResponseDto })
  async updateOverrides(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<{ data: EnrollmentResponse; relationships: Record<string, never> }> {
    const data = await this.service.updateOverrides(user.id, id, body)
    return { data, relationships: {} }
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: EnrollmentDetailResponseDto })
  async archive(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: EnrollmentResponse; relationships: Record<string, never> }> {
    const data = await this.service.archive(user.id, id)
    return { data, relationships: {} }
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: EnrollmentDetailResponseDto })
  async restore(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: EnrollmentResponse; relationships: Record<string, never> }> {
    const data = await this.service.restore(user.id, id)
    return { data, relationships: {} }
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
