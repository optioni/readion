export type MailTemplate<Payload> = {
  subject(payload: Payload): string
  text(payload: Payload): string
  html(payload: Payload): string
}

export type RenderedMailTemplate = {
  subject: string
  text: string
  html: string
}

export type TemplatePayload<Template> =
  Template extends MailTemplate<infer Payload> ? Payload : never

export type MailTemplateRegistry<Payloads extends Record<string, object>> = {
  [Name in keyof Payloads]: MailTemplate<Payloads[Name]>
}
