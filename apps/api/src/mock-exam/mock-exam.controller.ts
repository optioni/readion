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
import { ApiParam, ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger'
import type {
  MockExamGeneration,
  MockExamResponse,
  MockExamStatus,
  MockExamType,
  ValidationErrorItem,
} from '@readion/shared'
import { saveAnswerRequestSchema } from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { MockExamService } from './mock-exam.service'

class MockExamCitationDto {
  @ApiProperty()
  chunkId!: string
  @ApiProperty()
  text!: string
}

class MockExamQuestionResponseDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  question!: string
  @ApiProperty({ type: [String] })
  options!: string[]
  @ApiProperty()
  domain!: string
  @ApiPropertyOptional({ nullable: true })
  userAnswer!: string | null
  @ApiPropertyOptional()
  correctAnswer?: string
  @ApiPropertyOptional()
  explanation?: string
  @ApiPropertyOptional({ type: [MockExamCitationDto] })
  citations?: MockExamCitationDto[]
}

class MockExamResponseDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  userCertificationId!: string
  @ApiProperty()
  type!: MockExamType
  @ApiProperty()
  status!: MockExamStatus
  @ApiProperty()
  generation!: MockExamGeneration
  @ApiPropertyOptional({ nullable: true })
  startedAt!: string | null
  @ApiPropertyOptional({ nullable: true })
  deadline!: string | null
  @ApiPropertyOptional({ nullable: true })
  remainingSeconds!: number | null
  @ApiPropertyOptional({ nullable: true })
  score!: number | null
  @ApiPropertyOptional({ nullable: true })
  passed!: boolean | null
  @ApiProperty({ type: 'object', additionalProperties: true })
  domainBreakdown!: Record<string, unknown>
  @ApiProperty({ type: [MockExamQuestionResponseDto] })
  questions!: MockExamQuestionResponseDto[]
}

class MockExamDetailResponseDto {
  @ApiProperty({ type: MockExamResponseDto })
  data!: MockExamResponseDto
}

class MockExamListMetaDto {
  @ApiProperty()
  total!: number
  @ApiProperty()
  page!: number
  @ApiProperty()
  limit!: number
}

class MockExamListResponseDto {
  @ApiProperty({ type: [MockExamResponseDto] })
  data!: MockExamResponseDto[]
  @ApiProperty({ type: MockExamListMetaDto })
  meta!: MockExamListMetaDto
}

@Controller('user-certifications')
export class EnrollmentMockExamController {
  constructor(private readonly service: MockExamService) {}

  @Post(':id/mock-exams')
  @ApiParam({ name: 'id', description: 'UserCertification id' })
  @ApiResponse({ status: 201, type: MockExamDetailResponseDto })
  async create(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') enrollmentId: string,
  ): Promise<MockExamResponse> {
    return this.service.create(user.id, enrollmentId)
  }

  @Get(':id/mock-exams')
  @ApiParam({ name: 'id', description: 'UserCertification id' })
  @ApiResponse({ status: 200, type: MockExamListResponseDto })
  @ApiResponse({ status: 404, description: 'Enrollment not found or not owned by the user' })
  async list(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') enrollmentId: string,
  ): Promise<CollectionResult<MockExamResponse>> {
    return this.service.listForEnrollment(user.id, enrollmentId)
  }
}

@Controller('mock-exams')
export class MockExamController {
  constructor(private readonly service: MockExamService) {}

  @Get(':id')
  @ApiParam({ name: 'id', description: 'MockExam id' })
  @ApiResponse({ status: 200, type: MockExamDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<MockExamResponse> {
    return this.service.findOne(user.id, id)
  }

  @Post(':id/submit')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'MockExam id' })
  @ApiResponse({ status: 200, type: MockExamDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Attempt is already submitted or expired' })
  async submit(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<MockExamResponse> {
    return this.service.submit(user.id, id)
  }

  @Put(':id/answers/:questionIndex')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'MockExam id' })
  @ApiParam({
    name: 'questionIndex',
    description: 'Zero-based index of the question in the attempt',
  })
  @ApiResponse({ status: 200, type: MockExamDetailResponseDto })
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
