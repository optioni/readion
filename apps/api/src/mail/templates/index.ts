export { wrapInBaseLayout } from './base-layout'
export { escapeHtml } from './escape'
export type {
  DigestEnrollmentSection,
  DigestTemplatePayload,
  ExamNudgeTemplatePayload,
  FoundationalTemplatePayload,
  MailTemplatePayloads,
  WelcomeTemplatePayload,
} from './registry'
export {
  digestTemplate,
  examNudgeTemplate,
  foundationalTemplate,
  mailTemplateRegistry,
  welcomeTemplate,
} from './registry'
export { renderTemplate } from './renderer'
export type {
  MailTemplate,
  MailTemplateRegistry,
  RenderedMailTemplate,
  TemplatePayload,
} from './types'
