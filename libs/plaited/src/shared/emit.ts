import { Emit } from '../types.js'

/** @description emit a custom event cancelable and composed are true by default */
export const emit =
  (host: HTMLElement) =>
  ({ type, detail, bubbles = false, cancelable = true, composed = true }: Parameters<Emit>[0]) => {
    if (!type) return
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })
    host.dispatchEvent(event)
  }
