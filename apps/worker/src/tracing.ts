import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'
import type { SpanExporter } from '@opentelemetry/sdk-trace-base'
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'

let sdk: NodeSDK | null = null

export function initTracing(options?: { exporter?: SpanExporter; endpoint?: string }): void {
  if (sdk) return

  const instrumentations = [getNodeAutoInstrumentations()]
  const serviceName = process.env.SERVICE_NAME ?? 'readion-worker'

  if (options?.exporter) {
    sdk = new NodeSDK({
      serviceName,
      spanProcessors: [new SimpleSpanProcessor(options.exporter)],
      instrumentations,
    })
  } else if (options?.endpoint) {
    sdk = new NodeSDK({
      serviceName,
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: options.endpoint }))],
      instrumentations,
    })
  } else {
    sdk = new NodeSDK({ serviceName, instrumentations })
  }

  sdk.start()
}

export function shutdownTracing(): Promise<void> {
  const instance = sdk
  sdk = null
  return instance?.shutdown() ?? Promise.resolve()
}
