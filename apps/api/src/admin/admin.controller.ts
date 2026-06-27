import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse } from '@nestjs/swagger'
import type { RoleValue } from '@readion/shared'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Min } from 'class-validator'
import { CurrentUser, type CurrentUserPrincipal, Roles } from '../auth/auth.guards'
import { AdminService } from './admin.service'

export class ListQueryDto {
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ type: Number })
  perPage?: number
}

class ListMetaDto {
  @ApiProperty()
  total!: number
  @ApiProperty()
  page!: number
  @ApiProperty()
  limit!: number
}

class AdminUserListItemDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  email!: string
  @ApiProperty({ enum: ['user', 'admin'] })
  role!: RoleValue
  @ApiProperty()
  emailVerified!: boolean
  @ApiProperty()
  createdAt!: string
  @ApiProperty()
  enrollmentCount!: number
}

class AdminUserListResponseDto {
  @ApiProperty({ type: [AdminUserListItemDto] })
  data!: AdminUserListItemDto[]
  @ApiProperty({ type: ListMetaDto })
  meta!: ListMetaDto
}

class AuditLogEntryDto {
  @ApiProperty()
  id!: string
  @ApiProperty({ nullable: true, type: String })
  userId!: string | null
  @ApiProperty()
  action!: string
  @ApiProperty()
  targetType!: string
  @ApiProperty()
  targetId!: string
  @ApiProperty({ nullable: true, type: Object })
  before!: Record<string, unknown> | null
  @ApiProperty({ nullable: true, type: Object })
  after!: Record<string, unknown> | null
  @ApiProperty()
  createdAt!: string
}

class AuditLogListResponseDto {
  @ApiProperty({ type: [AuditLogEntryDto] })
  data!: AuditLogEntryDto[]
  @ApiProperty({ type: ListMetaDto })
  meta!: ListMetaDto
}

class RoleChangeDataDto {
  @ApiProperty()
  id!: string
  @ApiProperty({ enum: ['user', 'admin'] })
  role!: RoleValue
}

class RoleChangeResponseDto {
  @ApiProperty({ type: RoleChangeDataDto })
  data!: RoleChangeDataDto
}

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiResponse({ status: 200, type: AdminUserListResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  listUsers(@Query() query: ListQueryDto) {
    return this.service.listUsers(query.page, query.limit ?? query.perPage)
  }

  @Get('audit-logs')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiResponse({ status: 200, type: AuditLogListResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  listAuditLogs(@Query() query: ListQueryDto) {
    return this.service.listAuditLogs(query.page, query.limit ?? query.perPage)
  }

  @Post('users/:id/promote')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: RoleChangeResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async promote(@CurrentUser() actor: CurrentUserPrincipal, @Param('id') id: string) {
    return { data: await this.service.promote(actor.id, id) }
  }

  @Post('users/:id/demote')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: RoleChangeResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Cannot demote the last active admin' })
  async demote(@CurrentUser() actor: CurrentUserPrincipal, @Param('id') id: string) {
    return { data: await this.service.demote(actor.id, id) }
  }
}
