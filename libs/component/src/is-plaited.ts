import { isTypeOf } from '@plaited/utils'
import { PlaitedElement } from '@plaited/component-types'

/** @description utility function to check if Element is Plaited Component */
export const isPlaited = (el: Element): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el
