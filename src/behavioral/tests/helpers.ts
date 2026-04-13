import type { BPListener } from 'plaited/behavioral'
import * as z from 'zod'

const sourceSchema = z.enum(['trigger', 'request'])

export const onType = (type: string): BPListener => ({
  type,
  sourceSchema,
  detailSchema: z.unknown(),
})

export const onTypeWithDetail = ({
  type,
  detailSchema,
}: {
  type: string
  detailSchema: z.ZodType<unknown>
}): BPListener => ({
  type,
  sourceSchema,
  detailSchema,
})

export const onTypeWhere = ({
  type,
  predicate,
}: {
  type: string
  predicate: (detail: unknown) => boolean
}): BPListener => ({
  type,
  sourceSchema,
  detailSchema: z.unknown().refine(predicate),
})
