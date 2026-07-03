import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse } from '@nestjs/swagger'
import {
  type QuarantinedItemStatus,
  type QuestionFormat,
  quarantinedItemStatuses,
  questionFormats,
} from '@readion/shared'
import { IsIn, IsOptional, IsUUID } from 'class-validator'
import { CurrentUser, type CurrentUserPrincipal, Roles } from '../auth/auth.guards'
import { ListQueryDto } from './admin.controller'
import { QuarantineAdminService } from './quarantine-admin.service'

class QuarantineListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  certificationId?: string

  @IsOptional()
  @IsIn(quarantinedItemStatuses)
  @ApiPropertyOptional({ enum: quarantinedItemStatuses })
  status?: QuarantinedItemStatus
}

class ListMetaDto {
  @ApiProperty()
  total!: number
  @ApiProperty()
  page!: number
  @ApiProperty()
  limit!: number
}

class QuarantinedItemListItemDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  certificationId!: string
  @ApiProperty()
  domain!: string
  @ApiProperty()
  verdict!: string
  @ApiProperty()
  reason!: string
  @ApiProperty({ enum: quarantinedItemStatuses })
  status!: QuarantinedItemStatus
  @ApiProperty({ type: Object })
  provenance!: Record<string, unknown>
  @ApiProperty()
  createdAt!: string
}

class QuarantinedItemListResponseDto {
  @ApiProperty({ type: [QuarantinedItemListItemDto] })
  data!: QuarantinedItemListItemDto[]
  @ApiProperty({ type: ListMetaDto })
  meta!: ListMetaDto
}

class QuarantinedItemDetailContentDto {
  @ApiProperty()
  question!: string
  @ApiProperty({ type: [String] })
  options!: string[]
  @ApiProperty()
  answerKey!: string
  @ApiProperty({ enum: questionFormats, nullable: true })
  format!: QuestionFormat | null
  @ApiProperty({ type: [String] })
  supportingSpans!: string[]
  @ApiProperty({ type: [String] })
  sourceChunkIds!: string[]
}

class QuarantinedItemDetailDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  certificationId!: string
  @ApiProperty()
  domain!: string
  @ApiProperty()
  verdict!: string
  @ApiProperty()
  reason!: string
  @ApiProperty({ enum: quarantinedItemStatuses })
  status!: QuarantinedItemStatus
  @ApiProperty({ type: Object })
  provenance!: Record<string, unknown>
  @ApiProperty()
  createdAt!: string
  @ApiProperty({ type: QuarantinedItemDetailContentDto, nullable: true })
  content!: QuarantinedItemDetailContentDto | null
}

class QuarantinedItemDetailResponseDto {
  @ApiProperty({ type: QuarantinedItemDetailDto })
  data!: QuarantinedItemDetailDto
}

class QuarantineResolutionDataDto {
  @ApiProperty()
  id!: string
  @ApiProperty({ enum: quarantinedItemStatuses })
  status!: QuarantinedItemStatus
}

class QuarantineResolutionResponseDto {
  @ApiProperty({ type: QuarantineResolutionDataDto })
  data!: QuarantineResolutionDataDto
}

@Controller('admin')
@Roles('admin')
export class QuarantineAdminController {
  constructor(private readonly service: QuarantineAdminService) {}

  @Get('quarantine')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'certificationId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: quarantinedItemStatuses })
  @ApiResponse({ status: 200, type: QuarantinedItemListResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  list(@Query() query: QuarantineListQueryDto) {
    return this.service.list({
      page: query.page,
      limit: query.limit ?? query.perPage,
      certificationId: query.certificationId,
      status: query.status,
    })
  }

  @Get('quarantine/:id')
  @ApiResponse({ status: 200, type: QuarantinedItemDetailResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Quarantined item not found' })
  async detail(@Param('id') id: string) {
    return { data: await this.service.getDetail(id) }
  }

  @Post('quarantine/:id/approve')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: QuarantineResolutionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Quarantined item not found' })
  @ApiResponse({ status: 409, description: 'Quarantined item has already been resolved' })
  async approve(@CurrentUser() actor: CurrentUserPrincipal, @Param('id') id: string) {
    return { data: await this.service.approve(actor.id, id) }
  }

  @Post('quarantine/:id/reject')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: QuarantineResolutionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Quarantined item not found' })
  @ApiResponse({ status: 409, description: 'Quarantined item has already been resolved' })
  async reject(@CurrentUser() actor: CurrentUserPrincipal, @Param('id') id: string) {
    return { data: await this.service.reject(actor.id, id) }
  }
}
