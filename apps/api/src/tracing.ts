import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'
import type { SpanExporter } from '@opentelemetry/sdk-trace-base'
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'

let sdk: NodeSDK | null = null

export function initTracing(options?: { exporter?: SpanExporter; endpoint?: string }): void {
  if (sdk) return

  const instrumentations = [getNodeAutoInstrumentations()]

  if (options?.exporter) {
    // Test mode: use synchronous SimpleSpanProcessor so spans are immediately available
    sdk = new NodeSDK({
      serviceName: process.env.SERVICE_NAME ?? 'readion-api',
      spanProcessors: [new SimpleSpanProcessor(options.exporter)],
      instrumentations,
    })
  } else if (options?.endpoint) {
    sdk = new NodeSDK({
      serviceName: process.env.SERVICE_NAME ?? 'readion-api',
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: options.endpoint }))],
      instrumentations,
    })
  } else {
    // No-op: no OTLP endpoint and no test exporter
    sdk = new NodeSDK({
      serviceName: process.env.SERVICE_NAME ?? 'readion-api',
      instrumentations,
    })
  }

  sdk.start()
}

export function shutdownTracing(): Promise<void> {
  const instance = sdk
  sdk = null
  return instance?.shutdown() ?? Promise.resolve()
}
