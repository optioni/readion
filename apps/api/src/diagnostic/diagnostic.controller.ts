import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ApiParam, ApiResponse } from '@nestjs/swagger'
import type { DiagnosticOfferResponse, MockExamResponse } from '@readion/shared'
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

  @Get(':id/diagnostic-offer')
  @ApiParam({ name: 'id', description: 'UserCertification id' })
  @ApiResponse({ status: 200, description: 'Diagnostic offer' })
  @ApiResponse({ status: 404, description: 'Enrollment not found or not owned' })
  async getOffer(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') enrollmentId: string,
  ): Promise<DiagnosticOfferResponse> {
    return this.service.getOffer(user.id, enrollmentId)
  }

  @Post(':id/diagnostic-offer/dismiss')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'UserCertification id' })
  @ApiResponse({ status: 200, description: 'Offer dismissed' })
  @ApiResponse({ status: 404, description: 'Enrollment not found or not owned' })
  async dismissOffer(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') enrollmentId: string,
  ): Promise<void> {
    return this.service.dismissOffer(user.id, enrollmentId)
  }
}
