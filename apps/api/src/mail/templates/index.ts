export { wrapInBaseLayout } from './base-layout'
export { escapeHtml } from './escape'
export type {
  FoundationalTemplatePayload,
  MailTemplatePayloads,
  WelcomeTemplatePayload,
} from './registry'
export { foundationalTemplate, mailTemplateRegistry, welcomeTemplate } from './registry'
export { renderTemplate } from './renderer'
export type {
  MailTemplate,
  MailTemplateRegistry,
  RenderedMailTemplate,
  TemplatePayload,
} from './types'
