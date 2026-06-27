import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiProperty, ApiResponse } from '@nestjs/swagger'
import type { ExamOutcomeResponse, ValidationErrorItem } from '@readion/shared'
import { examOutcomeRequestSchema, examOutcomeResponses } from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { LifecycleEmailService } from './lifecycle-email.service'

class ExamOutcomeResultDto {
  @ApiProperty({ enum: examOutcomeResponses })
  response!: ExamOutcomeResponse
  @ApiProperty()
  respondedAt!: string
}

class ExamOutcomeResponseDto {
  @ApiProperty({ type: ExamOutcomeResultDto })
  data!: ExamOutcomeResultDto
}

@Controller('user-certifications')
export class ExamOutcomeController {
  constructor(private readonly lifecycleEmail: LifecycleEmailService) {}

  @Post(':id/exam-outcome')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: ExamOutcomeResponseDto })
  async record(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<{ data: ExamOutcomeResultDto }> {
    const { response } = parseExamOutcomeBody(body)
    await this.lifecycleEmail.recordExamOutcome(user.id, id, response)
    return { data: { response, respondedAt: new Date().toISOString() } }
  }
}

function parseExamOutcomeBody(body: unknown) {
  const result = examOutcomeRequestSchema.safeParse(body)
  if (!result.success) {
    throw new UnprocessableEntityException({
      errors: result.error.issues.map(
        (issue): ValidationErrorItem => ({
          field: issue.path.map(String).join('.') || 'body',
          message: issue.message,
        }),
      ),
    })
  }
  return result.data
}
