import { describe, expect, it, vi } from 'vitest'
import { type CreateNodemailerTransport, createMailTransport } from './factory'
import type { CapturedMailMessage, MailMessage, MailTransport } from './index'

const message = {
  from: 'Readion <no-reply@readion.app>',
  to: 'user@example.com',
  subject: 'Subject',
  text: 'Text',
  html: '<p>Text</p>',
} satisfies MailMessage

describe('mail transport factory', () => {
  it('builds an SMTP transport from validated config values instead of raw env', async () => {
    process.env.SMTP_HOST = 'wrong.example.com'
    const createTransport = vi.fn<CreateNodemailerTransport>(() => ({
      sendMail: vi.fn<MailTransport['sendMail']>().mockResolvedValue({ messageId: 'smtp-1' }),
    }))
    const config = {
      NODE_ENV: 'production',
      SMTP_HOST: 'mail.smtp2go.com',
      SMTP_PORT: 2525,
      SMTP_USERNAME: 'smtp-user',
      SMTP_PASSWORD: 'smtp-password',
    } as const

    const transport = createMailTransport(config, [], createTransport)
    await transport.sendMail(message)

    expect(createTransport).toHaveBeenCalledWith({
      host: 'mail.smtp2go.com',
      port: 2525,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-password',
      },
    })
  })

  it('uses a capturing transport in tests without contacting SMTP', async () => {
    const capturedMessages: CapturedMailMessage[] = []
    const sendMail = vi.fn<MailTransport['sendMail']>().mockResolvedValue({ messageId: 'json-1' })
    const createTransport = vi.fn<CreateNodemailerTransport>(() => ({ sendMail }))
    const config = {
      NODE_ENV: 'test',
    } as const

    const transport = createMailTransport(config, capturedMessages, createTransport)
    await transport.sendMail(message)

    expect(createTransport).toHaveBeenCalledWith({ jsonTransport: true })
    expect(sendMail).toHaveBeenCalledWith(message)
    expect(capturedMessages).toEqual([message])
  })

  it('uses a capturing transport in tests even when SMTP-looking config is present', async () => {
    const capturedMessages: CapturedMailMessage[] = []
    const sendMail = vi.fn<MailTransport['sendMail']>().mockResolvedValue({ messageId: 'json-1' })
    const createTransport = vi.fn<CreateNodemailerTransport>(() => ({ sendMail }))
    const config = {
      NODE_ENV: 'test',
      SMTP_HOST: 'mail.smtp2go.com',
      SMTP_PORT: 2525,
      SMTP_USERNAME: 'smtp-user',
      SMTP_PASSWORD: 'smtp-password',
    } as const

    const transport = createMailTransport(config, capturedMessages, createTransport)
    await transport.sendMail(message)

    expect(createTransport).toHaveBeenCalledWith({ jsonTransport: true })
    expect(sendMail).toHaveBeenCalledWith(message)
    expect(capturedMessages).toEqual([message])
  })

  it('builds unauthenticated SMTP transport for local development sinks', async () => {
    const createTransport = vi.fn<CreateNodemailerTransport>(() => ({
      sendMail: vi.fn<MailTransport['sendMail']>().mockResolvedValue({ messageId: 'smtp-1' }),
    }))
    const config = {
      NODE_ENV: 'development',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
    } as const

    const transport = createMailTransport(config, [], createTransport)
    await transport.sendMail(message)

    expect(createTransport).toHaveBeenCalledWith({
      host: 'localhost',
      port: 1025,
    })
  })
})
