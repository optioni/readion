import { describe, expect, it, vi } from 'vitest'
import { MailService } from './mail.service'
import type { MailTransport } from './transport'

const MAIL_FROM = 'Readion <no-reply@readion.app>'

const registry = {
  welcome: {
    subject: (payload: { name: string }) => `Welcome, ${payload.name}`,
    text: (payload: { name: string }) => `Hello ${payload.name}`,
    html: (payload: { name: string }) => `<p>Hello ${payload.name}</p>`,
  },
}

describe('MailService', () => {
  it('renders the selected template, injects the configured from address, and delegates to transport', async () => {
    const transport = {
      sendMail: vi.fn<MailTransport['sendMail']>().mockResolvedValue({ messageId: 'message-1' }),
    }
    const service = new MailService({ mailFrom: MAIL_FROM, registry, transport })

    await service.send('welcome', 'user@example.com', { name: 'Ava Learner' })

    expect(transport.sendMail).toHaveBeenCalledWith({
      from: MAIL_FROM,
      to: 'user@example.com',
      subject: 'Welcome, Ava Learner',
      text: 'Hello Ava Learner',
      html: '<p>Hello Ava Learner</p>',
    })
  })

  it('propagates transport failures', async () => {
    const transport = {
      sendMail: vi.fn<MailTransport['sendMail']>().mockRejectedValue(new Error('SMTP failed')),
    }
    const service = new MailService({ mailFrom: MAIL_FROM, registry, transport })

    await expect(
      service.send('welcome', 'user@example.com', { name: 'Ava Learner' }),
    ).rejects.toThrow(/SMTP failed/)
  })
})

function assertTemplatePayloadTypes() {
  const transport = {
    sendMail: vi.fn<MailTransport['sendMail']>(),
  }
  const service = new MailService({ mailFrom: MAIL_FROM, registry, transport })

  void service.send('welcome', 'user@example.com', { name: 'Ava Learner' })
  // @ts-expect-error payload must match the selected template name
  void service.send('welcome', 'user@example.com', { actionUrl: 'https://readion.app/study' })
}

void assertTemplatePayloadTypes
