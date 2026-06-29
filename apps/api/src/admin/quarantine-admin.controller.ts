import { Controller, Get, Query } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse } from '@nestjs/swagger'
import { type QuarantinedItemStatus, quarantinedItemStatuses } from '@readion/shared'
import { IsIn, IsOptional, IsUUID } from 'class-validator'
import { Roles } from '../auth/auth.guards'
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
}
