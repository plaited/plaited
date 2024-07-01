import { isTypeOf } from '@plaited/utils'
import type { PlaitedElement } from '../types.js'

const isPlaitedElement = (el: Element): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el

export const getPlaitedChildren = (slot: HTMLSlotElement) => [...slot.assignedElements()].filter(isPlaitedElement)
