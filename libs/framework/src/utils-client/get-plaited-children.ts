import type { PlaitedElement } from '../component/types.js'
import { isTypeOf } from '../utils.js'

const isPlaitedElement = (el: Element): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el

export const getPlaitedChildren = (slot: HTMLSlotElement) => [...slot.assignedElements()].filter(isPlaitedElement)
