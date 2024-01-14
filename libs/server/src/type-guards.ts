import { trueTypeOf } from '@plaited/utils'
import { PlaitedTemplate } from 'plaited'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isPlaitedComponent = (mod: any): mod is PlaitedTemplate =>
  trueTypeOf(mod) === 'function' && Boolean(mod?.tag)
