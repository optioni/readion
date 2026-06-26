import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiParam, ApiResponse } from '@nestjs/swagger'
import type { MockExamResponse, ValidationErrorItem } from '@readion/shared'
import { saveAnswerRequestSchema } from '@readion/shared'
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

  @Put(':id/answers/:questionIndex')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'MockExam id' })
  @ApiParam({ name: 'questionIndex', description: 'Zero-based index of the question in the attempt' })
  @ApiResponse({ status: 200, description: 'Answer saved; returns the updated attempt' })
  @ApiResponse({ status: 404, description: 'Attempt or question not found' })
  @ApiResponse({ status: 409, description: 'Attempt is terminal or past its deadline' })
  async saveAnswer(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Param('questionIndex') questionIndex: string,
    @Body() body: unknown,
  ): Promise<MockExamResponse> {
    const parsed = parseBody(body)
    return this.service.saveAnswer(user.id, id, Number.parseInt(questionIndex, 10), parsed.answer)
  }
}

function parseBody(body: unknown) {
  const result = saveAnswerRequestSchema.safeParse(body)
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
