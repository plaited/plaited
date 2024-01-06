import type { PlaitedElementConstructor, PlaitedElement } from '@plaited/component-types'
import { isTypeOf } from '@plaited/utils'

export { connectHDA } from './connect-hda.js'
export { eventSourceHandler } from './event-source-handler.js'
export { fetchHTML } from './fetch-html.js'
export { fetchJSON } from './fetch-json.js'
export { indexedDB } from './indexed-db.js'
export { handlePostMessage } from './handle-post-message.js'
export { messenger } from './messenger.js'
export { postMessenger } from './post-messenger.js'
export { publisher } from './publisher.js'
export { sse } from './sse.js'
export { ws } from './ws.js'

export const defineRegistry = (registry: Set<PlaitedElementConstructor>, silent = false) => {
  for (const el of registry) {
    const elTag = el.tag
    if (customElements.get(elTag)) {
      !silent && console.error(`${elTag} already defined`)
      continue
    }
    customElements.define(elTag, el)
  }
}

/** @description utility function to check if Element is Plaited Component */
export const isPlaited = (el: Element): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el
