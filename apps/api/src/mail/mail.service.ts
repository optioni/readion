import type { MailTemplatePayloads, MailTemplateRegistry } from './templates'
import type { MailTransport } from './transport'

type MailServiceOptions<Payloads extends Record<string, object>> = {
  mailFrom: string
  registry: MailTemplateRegistry<Payloads>
  transport: MailTransport
}

export class MailService<const Payloads extends Record<string, object>> {
  constructor(private readonly options: MailServiceOptions<Payloads>) {}

  async send<Name extends Extract<keyof Payloads, string>>(
    templateName: Name,
    to: string,
    payload: Payloads[Name],
  ) {
    const template = this.options.registry[templateName]
    const message = {
      from: this.options.mailFrom,
      to,
      subject: template.subject(payload),
      text: template.text(payload),
      html: template.html(payload),
    }

    return this.options.transport.sendMail(message)
  }
}

export type ConfiguredMailService = MailService<MailTemplatePayloads>
