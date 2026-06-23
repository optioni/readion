import nodemailer from 'nodemailer'
import type { CapturedMailMessage, MailMessage, MailTransport } from './index'

export type SmtpTransportConfig = {
  NODE_ENV: 'production' | 'development' | 'test'
  SMTP_HOST?: string
  SMTP_PORT?: number
  SMTP_USERNAME?: string
  SMTP_PASSWORD?: string
}

export type SmtpTransportOptions = {
  host: string
  port: number
  auth: {
    user: string
    pass: string
  }
}

export type CapturingTransportOptions = {
  jsonTransport: true
}

export type NodemailerTransportOptions = CapturingTransportOptions | SmtpTransportOptions

export type CreateNodemailerTransport = (options: NodemailerTransportOptions) => MailTransport

const defaultCreateNodemailerTransport: CreateNodemailerTransport = (options) => {
  if ('jsonTransport' in options) {
    return nodemailer.createTransport(options)
  }

  return nodemailer.createTransport({
    host: options.host,
    port: options.port,
    auth: options.auth,
  })
}

function hasSmtpConfig(config: SmtpTransportConfig): config is Required<SmtpTransportConfig> {
  return Boolean(
    config.SMTP_HOST && config.SMTP_PORT && config.SMTP_USERNAME && config.SMTP_PASSWORD,
  )
}

export function createCapturingMailTransport(
  capturedMessages: CapturedMailMessage[],
  createNodemailerTransport: CreateNodemailerTransport = defaultCreateNodemailerTransport,
): MailTransport {
  const transport = createNodemailerTransport({ jsonTransport: true })

  return {
    async sendMail(message: MailMessage) {
      const result = await transport.sendMail(message)
      capturedMessages.push(message)
      return result
    },
  }
}

export function createMailTransport(
  config: SmtpTransportConfig,
  capturedMessages: CapturedMailMessage[],
  createNodemailerTransport: CreateNodemailerTransport = defaultCreateNodemailerTransport,
): MailTransport {
  if (config.NODE_ENV === 'test' || (config.NODE_ENV === 'development' && !hasSmtpConfig(config))) {
    return createCapturingMailTransport(capturedMessages, createNodemailerTransport)
  }

  if (!hasSmtpConfig(config)) {
    throw new Error('SMTP transport requires SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD')
  }

  return createNodemailerTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    auth: {
      user: config.SMTP_USERNAME,
      pass: config.SMTP_PASSWORD,
    },
  })
}
