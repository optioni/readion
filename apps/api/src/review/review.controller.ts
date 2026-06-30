import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiBody, ApiParam, ApiProperty, ApiResponse } from '@nestjs/swagger'
import type {
  ReviewGrade,
  ReviewItemResponse,
  ReviewQueueMeta,
  StartReviewResponse,
  SuppressDomainResponse,
  ValidationErrorItem,
} from '@readion/shared'
import { gradeReviewItemRequestSchema, suppressDomainRequestSchema } from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { ReviewService } from './review.service'

class GradeReviewItemDto {
  // Literal mirrors `reviewGrades` from @readion/shared; the imported const is undefined
  // at decorator-eval time here (module-init order), so it cannot be referenced for swagger
  // metadata. Runtime validation still uses the canonical `gradeReviewItemRequestSchema`.
  @ApiProperty({ enum: ['again', 'hard', 'good', 'easy'] })
  grade!: ReviewGrade
}

@Controller('user-certifications')
export class EnrollmentReviewController {
  constructor(private readonly service: ReviewService) {}

  @Get(':enrollmentId/review')
  @ApiParam({ name: 'enrollmentId' })
  @ApiResponse({ status: 200, description: 'Due review queue for the enrollment' })
  async queue(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<{ items: ReviewItemResponse[]; meta: ReviewQueueMeta }> {
    return this.service.getQueue(user.id, enrollmentId)
  }

  @Post(':enrollmentId/review/start')
  @HttpCode(200)
  @ApiParam({ name: 'enrollmentId' })
  @ApiResponse({ status: 200, description: 'Five-minute review started or all caught up' })
  async start(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<{ data: StartReviewResponse }> {
    const data = await this.service.startReview(user.id, enrollmentId)
    return { data }
  }

  @Post(':enrollmentId/review/suppress-domain')
  @HttpCode(200)
  @ApiParam({ name: 'enrollmentId' })
  @ApiResponse({ status: 200, description: 'All review items in the domain suppressed' })
  async suppressDomain(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: unknown,
  ): Promise<{ data: SuppressDomainResponse }> {
    const parsed = parseBody(suppressDomainRequestSchema, body)
    const data = await this.service.suppressDomain(user.id, enrollmentId, parsed.domain)
    return { data }
  }
}

@Controller('review-items')
export class ReviewItemsController {
  constructor(private readonly service: ReviewService) {}

  @Post(':id/master')
  @HttpCode(200)
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Concept retired from review' })
  async master(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: ReviewItemResponse }> {
    const data = await this.service.masterItem(user.id, id)
    return { data }
  }

  @Post(':id/grade')
  @HttpCode(200)
  @ApiParam({ name: 'id' })
  @ApiBody({ type: GradeReviewItemDto })
  @ApiResponse({ status: 200, description: 'Grade applied; box/state/dueAt updated' })
  async grade(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<{ data: ReviewItemResponse }> {
    const parsed = parseBody(gradeReviewItemRequestSchema, body)
    const data = await this.service.gradeItem(user.id, id, parsed.grade)
    return { data }
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
