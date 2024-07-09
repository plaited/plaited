import type { BPEvent } from '../behavioral/types.js'

export type UseEmit = (host: HTMLElement) => (
  args: BPEvent & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

/** @description emit a custom event cancelable and composed are true by default */
export const useEmit: UseEmit =
  (host) =>
  ({ type, detail, bubbles = false, cancelable = true, composed = true }) => {
    if (!type) return
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })
    host.dispatchEvent(event)
  }
