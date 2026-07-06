import { Controller } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { PrometheusController } from '@willsoto/nestjs-prometheus'
import { Public } from '../auth/auth.guards'
import { SkipEnvelope } from '../common/interceptors/response.interceptor'

// The tiers are named (auth/agent/general) with no `default`, so a bare
// SkipThrottle() would be a no-op — every named tier must be skipped by name.
@Controller()
@SkipThrottle({ auth: true, agent: true, general: true })
@SkipEnvelope()
@Public()
export class MetricsController extends PrometheusController {}
