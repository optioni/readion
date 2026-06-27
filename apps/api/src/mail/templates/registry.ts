import { wrapInBaseLayout } from './base-layout'
import { escapeHtml } from './escape'
import type { MailTemplate, MailTemplateRegistry } from './types'

export type FoundationalTemplatePayload = {
  name: string
  productName: string
  actionUrl: string
}

export type AuthLinkTemplatePayload = {
  productName: string
  actionUrl: string
}

export type WelcomeTemplatePayload = {
  name: string
  productName: string
  actionUrl: string
}

export type MailTemplatePayloads = {
  foundational: FoundationalTemplatePayload
  emailVerification: AuthLinkTemplatePayload
  passwordReset: AuthLinkTemplatePayload
  welcome: WelcomeTemplatePayload
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

export const emailVerificationTemplate = {
  subject: (payload) => `Verify your ${payload.productName} email`,
  text: (payload) =>
    `Verify your ${payload.productName} email address by opening this link: ${payload.actionUrl}`,
  html: (payload) =>
    wrapInBaseLayout(
      `<main>
        <p>Verify your ${escapeHtml(payload.productName)} email address.</p>
        <p><a href="${escapeHtml(payload.actionUrl)}">${escapeHtml(payload.actionUrl)}</a></p>
      </main>`,
    ),
} satisfies MailTemplate<AuthLinkTemplatePayload>

export const passwordResetTemplate = {
  subject: (payload) => `Reset your ${payload.productName} password`,
  text: (payload) =>
    `Reset your ${payload.productName} password by opening this link: ${payload.actionUrl}`,
  html: (payload) =>
    wrapInBaseLayout(
      `<main>
        <p>Reset your ${escapeHtml(payload.productName)} password.</p>
        <p><a href="${escapeHtml(payload.actionUrl)}">${escapeHtml(payload.actionUrl)}</a></p>
      </main>`,
    ),
} satisfies MailTemplate<AuthLinkTemplatePayload>

export const welcomeTemplate = {
  subject: (payload) => `Welcome to ${payload.productName}`,
  text: (payload) =>
    `Hi ${payload.name},\n\nWelcome to ${payload.productName}! Start your first study session here: ${payload.actionUrl}`,
  html: (payload) =>
    wrapInBaseLayout(
      `<main>
        <p>Hi ${escapeHtml(payload.name)},</p>
        <p>Welcome to ${escapeHtml(payload.productName)}! We're glad you're here.</p>
        <p><a href="${escapeHtml(payload.actionUrl)}">Start your first study session</a></p>
      </main>`,
    ),
} satisfies MailTemplate<WelcomeTemplatePayload>

export const mailTemplateRegistry = {
  foundational: foundationalTemplate,
  emailVerification: emailVerificationTemplate,
  passwordReset: passwordResetTemplate,
  welcome: welcomeTemplate,
} satisfies MailTemplateRegistry<MailTemplatePayloads>
