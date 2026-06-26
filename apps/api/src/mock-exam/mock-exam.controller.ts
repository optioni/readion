import { Controller, Get, Param, Post } from '@nestjs/common'
import { ApiParam, ApiResponse } from '@nestjs/swagger'
import type { MockExamResponse } from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { MockExamService } from './mock-exam.service'

@Controller('user-certifications')
export class EnrollmentMockExamController {
  constructor(private readonly service: MockExamService) {}

  @Post(':id/mock-exams')
  @ApiParam({ name: 'id', description: 'UserCertification id' })
  @ApiResponse({ status: 201, description: 'Mock exam attempt created and generation enqueued' })
  async create(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') enrollmentId: string,
  ): Promise<MockExamResponse> {
    return this.service.create(user.id, enrollmentId)
  }
}

@Controller('mock-exams')
export class MockExamController {
  constructor(private readonly service: MockExamService) {}

  @Get(':id')
  @ApiParam({ name: 'id', description: 'MockExam id' })
  @ApiResponse({ status: 200, description: 'Mock exam attempt with generation status and questions' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<MockExamResponse> {
    return this.service.findOne(user.id, id)
  }
}
