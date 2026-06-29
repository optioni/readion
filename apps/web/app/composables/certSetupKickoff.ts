import type { DiscoverSourcesResponse } from '@readion/shared'
import { discoverSourcesRequestSchema, extractRequestSchema } from '@readion/shared'
import { readDataEnvelope, readDiscoverSourcesEnvelope } from '~/composables/adminEnvelope'
import {
  certSetupControllerDiscoverSources,
  certSetupControllerExtract,
} from '~~/src/api/cert-setup/cert-setup'

// Shared discovery/extraction kickoff used by both the cert-setup wizard (step 1) and the
// re-verification flow, so the request bodies (optional `code`, valid `confirmedSourceUrl`) and
// envelope narrowing stay defined in one place.
const jsonHeaders = { 'Content-Type': 'application/json' }

export async function discoverCertSources(
  name: string,
  code: string,
): Promise<DiscoverSourcesResponse> {
  const body = discoverSourcesRequestSchema.parse({ name, ...(code ? { code } : {}) })
  return readDiscoverSourcesEnvelope(
    await certSetupControllerDiscoverSources({ headers: jsonHeaders, body: JSON.stringify(body) }),
  )
}

export async function enqueueCertExtraction(
  name: string,
  code: string,
  confirmedSourceUrl: string,
): Promise<string> {
  const body = extractRequestSchema.parse({ name, ...(code ? { code } : {}), confirmedSourceUrl })
  return readDataEnvelope<{ jobId: string; state: string }>(
    await certSetupControllerExtract({ headers: jsonHeaders, body: JSON.stringify(body) }),
  ).jobId
}
