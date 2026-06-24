import { Controller } from '@nestjs/common'
import { PrometheusController } from '@willsoto/nestjs-prometheus'
import { Public } from '../auth/auth.guards'
import { SkipEnvelope } from '../common/interceptors/response.interceptor'

@Controller()
@SkipEnvelope()
@Public()
export class MetricsController extends PrometheusController {}
