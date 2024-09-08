import type { PlaitedElement } from './define-plaited-element.js'
import { isTypeOf } from '../utils.js'

export const isPlaitedElement = (el: unknown): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el

export const getPlaitedChildren = (slot: HTMLSlotElement) => [...slot.assignedElements()].filter(isPlaitedElement)
