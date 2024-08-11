import { Emit } from "./types.js"

/** @description emit a custom event cancelable and composed are true by default */
export const useEmit =
  (host: HTMLElement): Emit =>
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
