import { Controller, Param, Post } from '@nestjs/common'
import { ApiParam, ApiResponse } from '@nestjs/swagger'
import type { MockExamResponse } from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { DiagnosticService } from './diagnostic.service'

@Controller('user-certifications')
export class DiagnosticController {
  constructor(private readonly service: DiagnosticService) {}

  @Post(':id/diagnostic')
  @ApiParam({ name: 'id', description: 'UserCertification id' })
  @ApiResponse({ status: 201, description: 'Diagnostic attempt created' })
  @ApiResponse({ status: 404, description: 'Enrollment not found or not owned' })
  @ApiResponse({ status: 409, description: 'Certification is not live' })
  async create(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') enrollmentId: string,
  ): Promise<MockExamResponse> {
    return this.service.create(user.id, enrollmentId)
  }
}
