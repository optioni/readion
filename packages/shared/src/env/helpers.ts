import { z } from 'zod'

export const zodRequiredUrl = () => z.string().url()

export const zodCoerceNumber = () =>
  z.union([
    z.number().refine(Number.isFinite, { message: 'Must be a finite number' }),
    z
      .string()
      .min(1)
      .refine((v) => Number.isFinite(Number(v)), { message: 'Must be a finite number' })
      .transform((v) => Number(v)),
  ])

export const zodCoerceBoolean = () =>
  z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')

// packages/db connects via these discrete vars (see mikro-orm.config.ts), not a DATABASE_URL —
// each app's env schema decides whether they're required (e.g. only in production).
export const dbConnectionEnvFragment = {
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: zodCoerceNumber().optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASSWORD: z.string().min(1).optional(),
  DB_NAME: z.string().min(1).optional(),
}

export const redisUrlFragment = {
  REDIS_URL: zodRequiredUrl(),
}
