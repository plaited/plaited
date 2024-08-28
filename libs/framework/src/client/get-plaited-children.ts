import type { PlaitedElement } from './types.js'
import { isTypeOf } from '@plaited/utils'

const isPlaitedElement = (el: unknown): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el

export const getPlaitedChildren = (slot: HTMLSlotElement) => [...slot.assignedElements()].filter(isPlaitedElement)

export const useSlots = (slot: HTMLSlotElement) => {
  const getPlaited = () => [...slot.assignedElements()].filter(isPlaitedElement)
  const forEachPlaited = (cb: (...el: PlaitedElement[]) => void | Promise<void>) => cb(...getPlaited())
  return { getPlaited, forEachPlaited }
}
