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

async function findMessage(mailpit: APIRequestContext, email: string) {
  const response = await mailpit.get('/api/v1/messages')
  if (!response.ok()) return null
  const body = (await response.json()) as MailpitMessagesResponse
  return (
    body.messages.find((m) => m.To.some((r) => r.Address.toLowerCase() === email.toLowerCase())) ??
    null
  )
}

async function waitForMessage(mailpit: APIRequestContext, email: string) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const message = await findMessage(mailpit, email)
    if (message !== null) return message
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for email to ${email}`)
}

export async function captureVerificationToken(
  mailpit: APIRequestContext,
  email: string,
): Promise<string> {
  const message = await waitForMessage(mailpit, email)
  const detailResponse = await mailpit.get(`/api/v1/message/${message.ID}`)
  const detail = (await detailResponse.json()) as MailpitMessageDetail
  const body = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`
  const match = body.match(/https?:\/\/[^\s"'<>]+/)
  if (!match) throw new Error(`Verification email for ${email} had no link`)
  const url = new URL(match[0])
  const token = url.searchParams.get('token')
  if (!token) throw new Error(`Verification link had no token param`)
  return token
}

export async function captureResetToken(
  mailpit: APIRequestContext,
  email: string,
): Promise<string> {
  const message = await waitForMessage(mailpit, email)
  const detailResponse = await mailpit.get(`/api/v1/message/${message.ID}`)
  const detail = (await detailResponse.json()) as MailpitMessageDetail
  const body = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`
  const match = body.match(/https?:\/\/[^\s"'<>]+/)
  if (!match) throw new Error(`Reset email for ${email} had no link`)
  const url = new URL(match[0])
  const token = url.searchParams.get('token')
  if (!token) throw new Error(`Reset link had no token param`)
  return token
}
