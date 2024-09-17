import type { PlaitedTemplate } from '../index.js'
import { isTypeOf } from '../utils/true-type-of.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from '../client/client.constants.js'

export const isPlaitedTemplate = (mod: unknown): mod is PlaitedTemplate =>
  isTypeOf<PlaitedTemplate>(mod, 'function') && mod?.$ === PLAITED_TEMPLATE_IDENTIFIER
