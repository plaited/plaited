import { isTypeOf } from '@plaited/utils'
import { PlaitedElement } from '@plaited/component-types'
export const isPlaited = (el: Element): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el
