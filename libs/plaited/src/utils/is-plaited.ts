import { isTypeOf } from '@plaited/utils'
import type { PlaitedElement } from '../types.js'
export const isPlaited = (el: Element): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el
