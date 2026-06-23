export const MAIL_CAPTURED_MESSAGES = Symbol('MAIL_CAPTURED_MESSAGES')
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT')

export type MailMessage = {
  from: string
  to: string
  subject: string
  text: string
  html: string
}

export type CapturedMailMessage = MailMessage

export type MailSendResult = {
  messageId?: string
}

export type MailTransport = {
  sendMail(message: MailMessage): Promise<MailSendResult>
}

export type {
  CapturingTransportOptions,
  CreateNodemailerTransport,
  NodemailerTransportOptions,
  SmtpTransportConfig,
  SmtpTransportOptions,
} from './factory'
export { createCapturingMailTransport, createMailTransport } from './factory'
