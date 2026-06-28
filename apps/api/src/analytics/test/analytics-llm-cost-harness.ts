import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  AgentConversation,
  AgentMessage,
  Certification,
  ContentChunk,
  ContentSource,
  MockExam,
  SessionItem,
  StudySession,
  startPostgresContainer,
  startRedisContainer,
  User,
  UserCertification,
} from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type {
  AgentMessageRole,
  MockExamQuestion,
  QuestionFormat,
  SessionItemType,
} from '@readion/shared'
import {
  ANALYTICS_COST_AGENT_MESSAGE_DEFAULT,
  ANALYTICS_COST_MOCK_QUESTION_DEFAULT,
  ANALYTICS_COST_QUIZ_DEFAULT,
  ANALYTICS_COST_SESSION_ITEM_DEFAULT,
} from '@readion/shared'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { AnalyticsModule } from '../analytics.module'
import { AnalyticsService } from '../analytics.service'
import { configureAnalyticsTestEnv, truncateDomainTables } from './analytics-test-env'

const DAY_MS = 86_400_000
const DOMAIN = 'Cloud Concepts'

export type LlmCostExpectations = {
  // The coefficient-weighted artifact sum across the active population divided by the active-user
  // count. Inactive-user artifacts and an out-of-window quiz response are excluded.
  estimate: number
}

export type LlmCostHarness = {
  app: INestApplication
  moduleRef: TestingModule
  service: AnalyticsService
  expectations: LlmCostExpectations
  teardown: () => Promise<void>
}

export async function createLlmCostHarness(): Promise<LlmCostHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureAnalyticsTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, AnalyticsModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const em = moduleRef.get(EntityManager)
  const service = moduleRef.get(AnalyticsService)

  await truncateDomainTables(em)
  const expectations = await seedPopulation(em)

  return {
    app,
    moduleRef,
    service,
    expectations,
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
  }
}

async function seedPopulation(em: EntityManager): Promise<LlmCostExpectations> {
  const fork = em.fork()
  const conn = fork.getConnection()
  const now = Date.now()

  const certification = fork.create(Certification, {
    name: 'Cert LLMCOST',
    provider: 'AWS',
    code: 'LLMCOST',
    domains: [{ name: DOMAIN, weight: 100 }],
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: 'verified',
    state: 'live',
  })
  fork.persist(certification)
  await fork.flush()

  const contentSource = fork.create(ContentSource, {
    certificationId: certification.id,
    type: 'web',
    url: 'https://seed.test/llmcost',
    recheckIntervalMinutes: 1440,
  })
  fork.persist(contentSource)
  await fork.flush()

  const chunk = fork.create(ContentChunk, {
    contentSourceId: contentSource.id,
    certificationId: certification.id,
    text: 'seeded chunk',
    contentHash: 'b'.repeat(64),
    domainTags: [{ domain: DOMAIN, confidence: 1 }],
    primaryDomain: DOMAIN,
  })
  fork.persist(chunk)
  await fork.flush()

  const provenance = {
    sourceChunkIds: [chunk.id],
    supportingSpans: [],
    verdict: { pass: true, score: 1, distractorFindings: [] },
    score: 1,
  }

  const makeUser = async (email: string) => {
    const user = fork.create(User, { email, passwordHash: 'seeded-hash', emailVerified: true })
    const enrollment = fork.create(UserCertification, { user, certification, status: 'active' })
    fork.persist(user)
    fork.persist(enrollment)
    await fork.flush()
    return { user, enrollment }
  }

  const addSession = async (
    owner: { user: User; enrollment: UserCertification },
    daysAgo: number,
  ): Promise<StudySession> => {
    const at = new Date(now - daysAgo * DAY_MS)
    const session = fork.create(StudySession, {
      user: owner.user,
      userCertification: owner.enrollment,
      kind: 'study',
      status: 'completed',
      durationMinutes: 30,
      contentMix: 'balanced',
      difficulty: 'intermediate',
      focusArea: { mode: 'auto' },
      learningStyle: 'weak-area-focus',
      startedAt: at,
      endedAt: at,
    })
    fork.persist(session)
    await fork.flush()
    return session
  }

  const addQuizResponses = async (
    enrollment: UserCertification,
    count: number,
    daysAgo: number,
  ) => {
    const at = new Date(now - daysAgo * DAY_MS).toISOString()
    const snapshot = JSON.stringify({
      question: 'Q',
      options: ['A', 'B'],
      correctAnswer: 'A',
      provenance,
    })
    const format: QuestionFormat = 'multiple_choice'
    for (let i = 0; i < count; i++) {
      await conn.execute(
        `INSERT INTO quiz_responses
          (id, user_certification_id, answer, correct, confidence, time_taken_ms, question_snapshot, format, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)`,
        [enrollment.id, 'A', true, 5, 1000, snapshot, format, at, at],
      )
    }
  }

  const makeQuestion = (i: number): MockExamQuestion => ({
    id: `q-${i}`,
    question: 'Q',
    options: ['A', 'B'],
    correctAnswer: 'A',
    explanation: 'because',
    selectedAnswer: null,
    domain: DOMAIN,
    provenance,
  })

  const addMockExam = async (
    owner: { user: User; enrollment: UserCertification },
    questionCount: number,
  ) => {
    const exam = fork.create(MockExam, {
      user: owner.user,
      userCertification: owner.enrollment,
      type: 'mock',
      status: 'submitted',
      domainBreakdown: {},
      questions: Array.from({ length: questionCount }, (_, i) => makeQuestion(i)),
    })
    fork.persist(exam)
    await fork.flush()
  }

  const addSessionItems = async (session: StudySession, count: number) => {
    for (let i = 0; i < count; i++) {
      const type: SessionItemType = 'reading'
      const item = fork.create(SessionItem, {
        session,
        index: i,
        type,
        content: 'seeded item',
        completed: true,
        sourceChunkIds: [chunk.id],
        supportingSpans: [],
      })
      fork.persist(item)
    }
    await fork.flush()
  }

  const addAgentMessages = async (user: User, roles: AgentMessageRole[]) => {
    const conversation = fork.create(AgentConversation, {
      userId: user.id,
      mode: 'standalone',
      lastActivityAt: new Date(now),
    })
    fork.persist(conversation)
    await fork.flush()
    for (const role of roles) {
      const message = fork.create(AgentMessage, {
        conversationId: conversation.id,
        role,
        content: 'hello',
      })
      fork.persist(message)
    }
    await fork.flush()
  }

  // Two ACTIVE users: each has two completed sessions ended within the 14-day active window.
  const active1 = await makeUser('llmcost-active1@analytics.test')
  const active2 = await makeUser('llmcost-active2@analytics.test')
  // One INACTIVE user: a single completed session, below the 2-session activity threshold. All of
  // this user's artifacts must be excluded from the cost proxy.
  const inactive = await makeUser('llmcost-inactive@analytics.test')

  const active1Session = await addSession(active1, 2)
  await addSession(active1, 4)
  const active2Session = await addSession(active2, 3)
  await addSession(active2, 5)
  await addSession(inactive, 3)

  // Active-population artifacts inside the window (createdAt defaults to now).
  await addQuizResponses(active1.enrollment, 3, 1)
  await addQuizResponses(active2.enrollment, 1, 1)
  await addMockExam(active1, 4)
  await addMockExam(active2, 2)
  await addSessionItems(active1Session, 2)
  await addSessionItems(active2Session, 1)
  // Active-1 agent conversation: 2 assistant + 1 tool count (3); the user and system messages do
  // not (role filter).
  await addAgentMessages(active1.user, ['assistant', 'assistant', 'tool', 'user', 'system'])
  await addAgentMessages(active2.user, ['assistant'])

  // Excluded — out of window: an active user's quiz response created 20 days ago (before the
  // 14-day window start) is not counted toward cost over the window.
  await addQuizResponses(active1.enrollment, 5, 20)

  // Excluded — inactive population: artifacts attributable to the inactive user.
  await addQuizResponses(inactive.enrollment, 7, 1)
  await addMockExam(inactive, 10)
  await addAgentMessages(inactive.user, ['assistant', 'assistant', 'tool'])

  fork.clear()

  // Counted: quiz=4, mockQuestions=6, sessionItems=3, agentMessages=4.
  const weighted =
    4 * ANALYTICS_COST_QUIZ_DEFAULT +
    6 * ANALYTICS_COST_MOCK_QUESTION_DEFAULT +
    3 * ANALYTICS_COST_SESSION_ITEM_DEFAULT +
    4 * ANALYTICS_COST_AGENT_MESSAGE_DEFAULT
  return { estimate: weighted / 2 }
}
