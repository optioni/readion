import { wrapInBaseLayout } from './base-layout'
import { escapeHtml } from './escape'
import type { MailTemplate, MailTemplateRegistry } from './types'

export type FoundationalTemplatePayload = {
  name: string
  productName: string
  actionUrl: string
}

export type MailTemplatePayloads = {
  foundational: FoundationalTemplatePayload
}

export const foundationalTemplate = {
  subject: (payload) => `Continue learning with ${payload.productName}`,
  text: (payload) =>
    `Hi ${payload.name},\n\n${payload.productName} is ready for your next study session: ${payload.actionUrl}`,
  html: (payload) =>
    wrapInBaseLayout(
      `<main>
        <p>Hi ${escapeHtml(payload.name)},</p>
        <p>${escapeHtml(payload.productName)} is ready for your next study session.</p>
        <p><a href="${escapeHtml(payload.actionUrl)}">${escapeHtml(payload.actionUrl)}</a></p>
      </main>`,
    ),
} satisfies MailTemplate<FoundationalTemplatePayload>

export const mailTemplateRegistry = {
  foundational: foundationalTemplate,
} satisfies MailTemplateRegistry<MailTemplatePayloads>
