import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import { HttpException, Injectable } from '@nestjs/common'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Histogram } from 'prom-client'
import type { Observable } from 'rxjs'
import { throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'

export const HTTP_REQUEST_DURATION_METRIC = 'readion_http_request_duration_seconds'

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUEST_DURATION_METRIC)
    private readonly histogram: Histogram,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = process.hrtime.bigint()
    const req = context.switchToHttp().getRequest<{
      method: string
      route?: { path?: string }
      url: string
    }>()
    const res = context.switchToHttp().getResponse<{ statusCode: number }>()

    return next.handle().pipe(
      tap({
        next: () => this.record(start, req, res),
      }),
      catchError((error: unknown) => {
        this.record(start, req, res, this.statusForError(error))
        return throwError(() => error)
      }),
    )
  }

  private statusForError(error: unknown): number {
    return error instanceof HttpException ? error.getStatus() : 500
  }

  private record(
    start: bigint,
    req: { method: string; route?: { path?: string }; url: string },
    res: { statusCode: number },
    statusCode = res.statusCode,
  ): void {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9
    const route = req.route?.path ?? 'unknown'
    this.histogram.observe(
      { method: req.method, route, status_code: String(statusCode) },
      durationSeconds,
    )
  }
}
