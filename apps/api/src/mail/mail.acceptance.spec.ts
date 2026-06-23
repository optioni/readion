import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiConfigModule } from '../config/config.module'
import { MailModule } from './mail.module'
import { type ConfiguredMailService, MailService } from './mail.service'
import { type CapturedMailMessage, MAIL_CAPTURED_MESSAGES } from './transport'

const MAIL_FROM = 'Readion <no-reply@readion.app>'

describe('MailModule acceptance', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://readion:readion@localhost:5432/readion_test'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.NODE_ENV = 'test'
    process.env.SMTP_HOST = 'mail.smtp2go.com'
    process.env.SMTP_PORT = '2525'
    process.env.SMTP_USERNAME = 'smtp-user'
    process.env.SMTP_PASSWORD = 'smtp-password'
    process.env.MAIL_FROM = MAIL_FROM
  })

  it('sends the foundational template through the injectable service with a captured rendered message', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiConfigModule, MailModule],
    }).compile()

    const mailService = moduleRef.get<ConfiguredMailService>(MailService)
    const messages = moduleRef.get<ReadonlyArray<CapturedMailMessage>>(MAIL_CAPTURED_MESSAGES)

    await mailService.send('foundational', 'user@example.com', {
      name: 'Ava Learner',
      productName: 'Readion',
      actionUrl: 'https://readion.app/study',
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      to: 'user@example.com',
      from: MAIL_FROM,
    })
    expect(messages[0]?.subject).toContain('Readion')
    expect(messages[0]?.text).toContain('Ava Learner')
    expect(messages[0]?.text).toContain('https://readion.app/study')
    expect(messages[0]?.html).toContain('<html')
    expect(messages[0]?.html).toContain('Ava Learner')
    expect(messages[0]?.html).toContain('https://readion.app/study')
  })
})

function assertInjectedServiceTemplateTypes(mailService: ConfiguredMailService) {
  void mailService.send('foundational', 'user@example.com', {
    name: 'Ava Learner',
    productName: 'Readion',
    actionUrl: 'https://readion.app/study',
  })
  // @ts-expect-error payload must match the injected service template name
  void mailService.send('foundational', 'user@example.com', { name: 'Ava Learner' })
}

void assertInjectedServiceTemplateTypes
