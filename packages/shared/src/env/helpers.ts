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

export const databaseUrlFragment = {
  DATABASE_URL: zodRequiredUrl(),
}

export const redisUrlFragment = {
  REDIS_URL: zodRequiredUrl(),
}
