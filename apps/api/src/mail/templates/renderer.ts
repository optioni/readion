import type { MailTemplate, RenderedMailTemplate } from './types'

export function renderTemplate<Payload extends object>(
  template: MailTemplate<Payload>,
  payload: Payload,
): RenderedMailTemplate {
  return {
    subject: template.subject(payload),
    text: template.text(payload),
    html: template.html(payload),
  }
}
