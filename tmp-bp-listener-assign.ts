import * as z from 'zod'
import type { ZodType } from 'zod'

type BPListener = {
  type: string
  detailSchema: ZodType<unknown>
}

const ok: BPListener = {
  type: 'x',
  detailSchema: z.undefined(),
}

void ok
