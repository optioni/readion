import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiParam, ApiResponse } from '@nestjs/swagger'
import type {
  ExplanationResponse,
  InsufficientMaterialResponse,
  QuizQuestionResponse,
  SubmitAnswerResponse,
  ValidationErrorItem,
} from '@readion/shared'
import {
  explanationRequestSchema,
  generateQuizRequestSchema,
  reportRequestSchema,
  submitAnswerRequestSchema,
} from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { QuizService } from './quiz.service'

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('generate')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Quiz question generated or insufficient material' })
  async generate(
    @CurrentUser() user: CurrentUserPrincipal,
    @Body() body: unknown,
  ): Promise<InsufficientMaterialResponse | ({ type: 'question' } & QuizQuestionResponse)> {
    const parsed = parseBody(generateQuizRequestSchema, body)
    const result = await this.quizService.generate(user.id, parsed)

    if (result.type === 'insufficient_material') {
      return result
    }

    return { type: 'question', ...result.data }
  }

  @Post(':questionId/submit')
  @ApiParam({ name: 'questionId' })
  @ApiResponse({ status: 201, description: 'Answer submitted and scored' })
  async submitAnswer(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('questionId') questionId: string,
    @Body() body: unknown,
  ): Promise<{ data: SubmitAnswerResponse }> {
    const parsed = parseBody(submitAnswerRequestSchema, body)
    const data = await this.quizService.submitAnswer(user.id, questionId, parsed)
    return { data }
  }

  @Post(':questionId/explanation')
  @HttpCode(200)
  @ApiParam({ name: 'questionId' })
  @ApiResponse({ status: 200, description: 'Explanation generated for the question' })
  async generateExplanation(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('questionId') questionId: string,
    @Body() body: unknown,
  ): Promise<{ data: ExplanationResponse }> {
    const parsed = parseBody(explanationRequestSchema, body)
    const data = await this.quizService.generateExplanation(user.id, questionId, parsed)
    return { data }
  }

  @Post(':questionId/report')
  @HttpCode(204)
  @ApiParam({ name: 'questionId' })
  @ApiResponse({ status: 204, description: 'Question reported for review' })
  async reportQuestion(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('questionId') questionId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const parsed = parseBody(reportRequestSchema, body)
    await this.quizService.reportQuestion(user.id, questionId, parsed)
  }
}

function parseBody<T>(
  schema: {
    safeParse: (
      v: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }
  },
  body: unknown,
): T {
  const result = schema.safeParse(body)
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
