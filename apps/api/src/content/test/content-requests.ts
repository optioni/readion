import type { INestApplication } from '@nestjs/common'
import type { Response } from 'supertest'
import supertest from 'supertest'
import type { ContentAcceptanceHarness } from './content-acceptance-harness'

export const CONTENT_SOURCES_PATH = '/api/v1/admin/content-sources'
export const AUDIT_LOGS_PATH = '/api/v1/admin/audit-logs'

export type AdminContext = {
  auth: string
  certificationId: string
}

export async function bootstrapAdmin(
  harness: ContentAcceptanceHarness,
  domainNames: string[] = ['Security', 'Architecture'],
): Promise<AdminContext> {
  const token = await harness.registerAndLogin('admin@example.com', 'correcthorse')
  const certificationId = await harness.seedCertification(domainNames)
  return { auth: `Bearer ${token}`, certificationId }
}

export function createWebSource(
  app: INestApplication,
  auth: string,
  certificationId: string,
): Promise<Response> {
  return supertest(app.getHttpServer())
    .post(CONTENT_SOURCES_PATH)
    .set('Authorization', auth)
    .send({ certificationId, type: 'web', url: 'https://example.com/material' })
}

export type AuditEntry = {
  action: string
  targetId: string
  after: Record<string, unknown> | null
}

export async function listAudits(app: INestApplication, auth: string): Promise<AuditEntry[]> {
  const res = await supertest(app.getHttpServer())
    .get(AUDIT_LOGS_PATH)
    .query({ limit: 100 })
    .set('Authorization', auth)
  return res.body.data as AuditEntry[]
}

export async function listAuditCount(
  app: INestApplication,
  auth: string,
  action: string,
): Promise<number> {
  const audits = await listAudits(app, auth)
  return audits.filter((entry) => entry.action === action).length
}
