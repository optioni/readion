import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse } from '@nestjs/swagger'
import type { AgentConversation, AgentMessage } from '@readion/db'
import type {
  AgentConversationMode,
  AgentConversationResponse,
  AgentMessageResponse,
  RelationshipRef,
  ValidationErrorItem,
} from '@readion/shared'
import { agentMessageRequestSchema } from '@readion/shared'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Counter } from 'prom-client'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { SkipEnvelope } from '../common/interceptors/response.interceptor'
import { AGENT_TURNS_METRIC } from './agent.metrics'
import { AgentService, type SseEvent } from './agent.service'

type StreamResponse = {
  setHeader(name: string, value: string): void
  flushHeaders?(): void
  write(chunk: string): void
  end(): void
}

type StatusResponse = {
  status(code: number): unknown
}

class AgentConversationResponseDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  mode!: AgentConversationMode
  @ApiPropertyOptional({ nullable: true })
  studySessionId!: string | null
  @ApiPropertyOptional({ nullable: true })
  certificationId!: string | null
  @ApiProperty()
  lastActivityAt!: string
  @ApiProperty()
  createdAt!: string
}

class AgentConversationRelationshipsDto {
  @ApiProperty()
  messages!: RelationshipRef
}

class AgentConversationDetailResponseDto {
  @ApiProperty({ type: AgentConversationResponseDto })
  data!: AgentConversationResponse
  @ApiProperty({ type: AgentConversationRelationshipsDto })
  relationships!: AgentConversationRelationshipsDto
}

@Controller('agent-conversations')
export class AgentController {
  constructor(
    private readonly service: AgentService,
    @InjectMetric(AGENT_TURNS_METRIC)
    private readonly turnsCounter: Counter,
  ) {}

  @Post()
  @ApiResponse({ status: 201, type: AgentConversationDetailResponseDto })
  async createStandalone(
    @CurrentUser() user: CurrentUserPrincipal,
    @Res({ passthrough: true }) res: StatusResponse,
  ): Promise<{
    data: AgentConversationResponse
    relationships: AgentConversationRelationshipsDto
  }> {
    const conversation = await this.service.createStandaloneConversation(user.id)
    res.status(201)
    return {
      data: toConversationResponse(conversation),
      relationships: buildRelationships(conversation.id),
    }
  }

  @Get(':id')
  @ApiQuery({ name: 'include', required: false })
  @ApiResponse({ status: 200, type: AgentConversationDetailResponseDto })
  async detail(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Query('include') include?: string,
  ): Promise<{
    data: AgentConversationResponse
    relationships: AgentConversationRelationshipsDto
  }> {
    const includes = include?.split(',').map((s) => s.trim()) ?? []
    const includeMessages = includes.includes('messages')
    const { conversation, messages } = await this.service.getConversation(
      user.id,
      id,
      includeMessages,
    )
    return {
      data: toConversationResponse(conversation),
      relationships: buildRelationships(
        conversation.id,
        includeMessages ? messages.map(toMessageResponse) : undefined,
      ),
    }
  }

  @Post(':id/messages')
  @HttpCode(200)
  @SkipEnvelope()
  async streamTurn(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res() res: StreamResponse,
  ): Promise<void> {
    const content = parseMessageBody(body)
    const generator = this.service.runTurn({ userId: user.id, conversationId: id, content })

    let first: IteratorResult<SseEvent>
    try {
      first = await generator.next()
    } catch (error) {
      this.turnsCounter.inc({ outcome: 'error' })
      throw error
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    try {
      let result = first
      while (!result.done) {
        writeEvent(res, result.value)
        result = await generator.next()
      }
      this.turnsCounter.inc({ outcome: 'success' })
    } catch (error) {
      this.turnsCounter.inc({ outcome: 'error' })
      writeEvent(res, {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }

    res.write('data: [DONE]\n\n')
    res.end()
  }
}

@Controller('sessions')
export class SessionAgentConversationsController {
  constructor(private readonly service: AgentService) {}

  @Post(':id/agent-conversations')
  @ApiResponse({ status: 201, type: AgentConversationDetailResponseDto })
  async createInSession(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: StatusResponse,
  ): Promise<{
    data: AgentConversationResponse
    relationships: AgentConversationRelationshipsDto
  }> {
    const conversation = await this.service.createInSessionConversation(user.id, id)
    res.status(201)
    return {
      data: toConversationResponse(conversation),
      relationships: buildRelationships(conversation.id),
    }
  }
}

function writeEvent(res: StreamResponse, event: SseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}

function buildRelationships(
  conversationId: string,
  messages?: AgentMessageResponse[],
): AgentConversationRelationshipsDto {
  const ref: RelationshipRef = {
    href: `/api/v1/agent-conversations/${conversationId}/messages`,
  }
  if (messages !== undefined) {
    ref.data = messages
  }
  return { messages: ref }
}

function toConversationResponse(conversation: AgentConversation): AgentConversationResponse {
  return {
    id: conversation.id,
    mode: conversation.mode,
    studySessionId: conversation.studySessionId,
    certificationId: conversation.certificationId,
    lastActivityAt: conversation.lastActivityAt.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
  }
}

function toMessageResponse(message: AgentMessage): AgentMessageResponse {
  return {
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }
}

function parseMessageBody(body: unknown): string {
  const result = agentMessageRequestSchema.safeParse(body)
  if (!result.success) {
    throw new UnprocessableEntityException({
      errors: result.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.') || 'body',
        message: issue.message,
      })) satisfies ValidationErrorItem[],
    })
  }
  return result.data.content
}
