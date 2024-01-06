import { Emit } from '@plaited/component-types'

export const navigateEventType = 'plaited-navigate'
export const Plaited_Context = '__PLAITED_CONTEXT__'

type WindowWithPlaitedContext = Window & {
  [Plaited_Context]: {
    hda?: boolean
    logger?: (param: unknown) => void
  }
}

export const isHDA = (win: Window): win is WindowWithPlaitedContext => Plaited_Context in win

export const isMessageEvent = (event: MessageEvent | Event): event is MessageEvent => event.type === 'message'

/** https://medium.com/@WebReflection/dom-handleevent-a-cross-platform-standard-since-year-2000-5bf17287fd38 */
export class DelegatedListener<T extends Event = Event> {
  callback: (ev: T) => void | Promise<void>
  constructor(callback: (ev: T) => void | Promise<void>) {
    this.callback = callback
  }
  handleEvent(evt: T) {
    void this.callback(evt)
  }
}

export const delegates = new WeakMap<EventTarget>()

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
