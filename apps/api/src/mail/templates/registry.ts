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

export type DigestEnrollmentSection =
  | {
      certName: string
      calibrated: true
      readiness: number
      delta: number | null
      weakestDomain: string
      dueReviewCount: number
    }
  | {
      certName: string
      calibrated: false
    }

export type DigestTemplatePayload = {
  productName: string
  unsubscribeUrl: string
  enrollments: DigestEnrollmentSection[]
}

export type ExamNudgeTemplatePayload = {
  productName: string
  certName: string
  surveyUrl?: string
}

export type MailTemplatePayloads = {
  foundational: FoundationalTemplatePayload
  emailVerification: AuthLinkTemplatePayload
  passwordReset: AuthLinkTemplatePayload
  welcome: WelcomeTemplatePayload
  digest: DigestTemplatePayload
  'exam-nudge': ExamNudgeTemplatePayload
}

function formatReadiness(readiness: number): string {
  return `${Math.round(readiness)}%`
}

function formatDelta(delta: number | null): string {
  if (delta === null) {
    return ''
  }
  const rounded = Math.round(delta)
  const sign = rounded >= 0 ? '+' : ''
  return `${sign}${rounded}%`
}

function digestSectionText(section: DigestEnrollmentSection): string {
  if (!section.calibrated) {
    return `${section.certName}: Keep going — a few more questions will unlock your readiness score.`
  }
  const delta = formatDelta(section.delta)
  const deltaText = delta === '' ? '' : ` (${delta} from last week)`
  return `${section.certName}: You're at ${formatReadiness(section.readiness)} readiness${deltaText}. Your best focus area is ${section.weakestDomain}, with ${section.dueReviewCount} review item(s) due.`
}

function digestSectionHtml(section: DigestEnrollmentSection): string {
  if (!section.calibrated) {
    return `<p><strong>${escapeHtml(section.certName)}</strong>: Keep going — a few more questions will unlock your readiness score.</p>`
  }
  const delta = formatDelta(section.delta)
  const deltaText = delta === '' ? '' : ` (${escapeHtml(delta)} from last week)`
  return `<p><strong>${escapeHtml(section.certName)}</strong>: You're at ${escapeHtml(
    formatReadiness(section.readiness),
  )} readiness${deltaText}. Your best focus area is ${escapeHtml(
    section.weakestDomain,
  )}, with ${section.dueReviewCount} review item(s) due.</p>`
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

export const digestTemplate = {
  subject: (payload) => `Your weekly progress on ${payload.productName}`,
  text: (payload) =>
    `Here's your weekly progress on ${payload.productName}:\n\n${payload.enrollments
      .map(digestSectionText)
      .join(
        '\n\n',
      )}\n\nKeep up the great work — you've got this!\n\nUnsubscribe: ${payload.unsubscribeUrl}`,
  html: (payload) =>
    wrapInBaseLayout(
      `<main>
        <p>Here's your weekly progress on ${escapeHtml(payload.productName)}:</p>
        ${payload.enrollments.map(digestSectionHtml).join('\n')}
        <p>Keep up the great work — you've got this!</p>
        <p><a href="${escapeHtml(payload.unsubscribeUrl)}">Unsubscribe</a></p>
      </main>`,
    ),
} satisfies MailTemplate<DigestTemplatePayload>

function examNudgeSurveyText(surveyUrl: string | undefined): string {
  return surveyUrl === undefined ? '' : `\n\nReply in one tap: ${surveyUrl}`
}

function examNudgeSurveyHtml(surveyUrl: string | undefined): string {
  return surveyUrl === undefined
    ? ''
    : `<p><a href="${escapeHtml(surveyUrl)}">Reply in one tap</a></p>`
}

export const examNudgeTemplate = {
  subject: (payload) => `Did you take your ${payload.certName} exam yet?`,
  text: (payload) =>
    `You've been crushing your ${payload.productName} prep for ${payload.certName}.\n\nDid you take the exam yet?\n\n- Passed\n- Didn't pass\n- Not yet${examNudgeSurveyText(
      payload.surveyUrl,
    )}`,
  html: (payload) =>
    wrapInBaseLayout(
      `<main>
        <p>You've been crushing your ${escapeHtml(payload.productName)} prep for ${escapeHtml(
          payload.certName,
        )}.</p>
        <p><strong>Did you take the exam yet?</strong></p>
        <ul>
          <li>Passed</li>
          <li>Didn't pass</li>
          <li>Not yet</li>
        </ul>
        ${examNudgeSurveyHtml(payload.surveyUrl)}
      </main>`,
    ),
} satisfies MailTemplate<ExamNudgeTemplatePayload>

export const mailTemplateRegistry = {
  foundational: foundationalTemplate,
  emailVerification: emailVerificationTemplate,
  passwordReset: passwordResetTemplate,
  welcome: welcomeTemplate,
  digest: digestTemplate,
  'exam-nudge': examNudgeTemplate,
} satisfies MailTemplateRegistry<MailTemplatePayloads>
