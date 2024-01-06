import { Emit } from '@plaited/types'

import { PlaitedContext } from './constants.js'

type WindowWithPlaitedContext = Window & {
  [PlaitedContext]: {
    hda?: boolean
    logger?: (param: unknown) => void
  }
}

export const hasPlaitedContext = (win: Window): win is WindowWithPlaitedContext => PlaitedContext in win

export const isMessageEvent = (event: MessageEvent | Event): event is MessageEvent => event.type === 'message'

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
