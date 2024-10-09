import { type BPEvent } from '../behavioral/b-thread.ts'
import { type PlaitedElement } from './define-element.ts'

type Dispatch = <T = unknown>(
  args: BPEvent<T> & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

export const useDispatch =
  (element: PlaitedElement): Dispatch =>
  ({ type, detail, bubbles = false, cancelable = true, composed = true }) => {
    if (!type) return
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })
    element.dispatchEvent(event)
  }
