import type { APIRequestContext } from '@playwright/test'

type MailpitMessageSummary = {
  ID: string
  To: Array<{ Address: string }>
  Subject: string
}

type MailpitMessagesResponse = {
  messages: MailpitMessageSummary[]
}

type MailpitMessageDetail = {
  Text?: string
  HTML?: string
}

async function findMessage(mailpit: APIRequestContext, email: string, subject: RegExp) {
  const response = await mailpit.get('/api/v1/messages')
  if (!response.ok()) return null
  const body = (await response.json()) as MailpitMessagesResponse
  return (
    body.messages.find(
      (m) =>
        subject.test(m.Subject) &&
        m.To.some((r) => r.Address.toLowerCase() === email.toLowerCase()),
    ) ?? null
  )
}

async function waitForMessage(mailpit: APIRequestContext, email: string, subject: RegExp) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const message = await findMessage(mailpit, email, subject)
    if (message !== null) return message
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for "${subject}" email to ${email}`)
}

// Extracts the `?token=` value from the first link in the matching email. Registration now
// fans out more than one email (e.g. a welcome alongside the verification), so callers must
// scope by subject — otherwise a tokenless email can be picked first.
async function captureTokenFromLink(
  mailpit: APIRequestContext,
  email: string,
  subject: RegExp,
): Promise<string> {
  const message = await waitForMessage(mailpit, email, subject)
  const detailResponse = await mailpit.get(`/api/v1/message/${message.ID}`)
  const detail = (await detailResponse.json()) as MailpitMessageDetail
  const body = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`
  const match = body.match(/https?:\/\/[^\s"'<>]+token=[^\s"'<>]+/)
  if (!match) throw new Error(`Email "${subject}" for ${email} had no tokenized link`)
  const token = new URL(match[0]).searchParams.get('token')
  if (!token) throw new Error(`Email "${subject}" link for ${email} had no token param`)
  return token
}

export function captureVerificationToken(
  mailpit: APIRequestContext,
  email: string,
): Promise<string> {
  return captureTokenFromLink(mailpit, email, /verify/i)
}

export function captureResetToken(mailpit: APIRequestContext, email: string): Promise<string> {
  return captureTokenFromLink(mailpit, email, /reset|password/i)
}
