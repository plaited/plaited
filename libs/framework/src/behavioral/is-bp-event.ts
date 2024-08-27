import { isTypeOf } from '@plaited/utils'
import type { BPEvent } from './types.js'

export const isBPEvent = (data: unknown): data is BPEvent => {
  return isTypeOf<{ [key: string]: unknown }>(data, 'object') && 'type' in data && isTypeOf<string>(data.type, 'string')
}
