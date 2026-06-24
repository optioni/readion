import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { register } from 'prom-client'
import type { WorkerEnvConfig } from '../config/env.schema'

@Injectable()
export class WorkerMetricsServer implements OnApplicationBootstrap, OnApplicationShutdown {
  private server: http.Server | null = null
  private readonly logger = new Logger(WorkerMetricsServer.name)

  constructor(private readonly config: ConfigService<WorkerEnvConfig>) {}

  async onApplicationBootstrap(): Promise<void> {
    const port = this.config.get<number>('PROMETHEUS_PORT') ?? 9091

    this.server = http.createServer(async (req, res) => {
      if (req.url === '/metrics' && req.method === 'GET') {
        const metrics = await register.metrics()
        res.setHeader('Content-Type', register.contentType)
        res.writeHead(200)
        res.end(metrics)
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    const server = this.server
    await new Promise<void>((resolve, reject) => {
      server.listen(port, '0.0.0.0', () => {
        const addr = server.address() as AddressInfo
        this.logger.log(`Metrics server listening on port ${addr.port}`)
        resolve()
      })
      server.once('error', reject)
    })
  }

  async onApplicationShutdown(): Promise<void> {
    const server = this.server
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      this.server = null
    }
    register.clear()
  }
}
