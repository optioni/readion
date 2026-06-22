import { Controller } from '@nestjs/common'
import { PrometheusController } from '@willsoto/nestjs-prometheus'
import { SkipEnvelope } from '../common/interceptors/response.interceptor'

@Controller()
@SkipEnvelope()
export class MetricsController extends PrometheusController {}
