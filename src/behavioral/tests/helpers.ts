import type { BPListener } from 'plaited/behavioral'
import * as z from 'zod'

const sourceSchema = z.enum(['trigger', 'request', 'emit'])

export const onType = (type: string): BPListener => ({
  kind: 'match',
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
  kind: 'match',
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
  kind: 'match',
  type,
  sourceSchema,
  detailSchema: z.unknown().refine(predicate),
})
