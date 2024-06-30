import { BPEvent } from '../types.js'
import { isTypeOf } from '@plaited/utils'

export const isBPEvent = (data: unknown): data is BPEvent => {
  return isTypeOf<{ [key: string]: unknown }>(data, 'object') && 'type' in data && isTypeOf<string>(data.type, 'string')
}
