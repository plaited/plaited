/** Utility function for enabling hypermedia patterns */
import type { Disconnect, PlaitedElement } from './types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { NAVIGATE_EVENT_TYPE } from '../shared/constants.js'
import { useEmit } from './use-emit.js'

export const navigationListener = (shadowRoot: ShadowRoot): Disconnect => {
  delegates.set(
    shadowRoot,
    new DelegatedListener((event) => {
      if (event.type === 'click') {
        const path = event.composedPath()
        for (const element of path) {
          if (element instanceof HTMLAnchorElement && element.hasAttribute('bp-href')) {
            const href = element.getAttribute('bp-href') ?? ''
            const local = href?.includes(window.location.origin)
            if (local) {
              useEmit(shadowRoot.host as PlaitedElement)({
                type: NAVIGATE_EVENT_TYPE,
                detail: new URL(href, window.location.href),
                bubbles: true,
                composed: true,
              })
            }
          }
        }
      }
    }),
  )
  shadowRoot.addEventListener('click', delegates.get(shadowRoot))
  return () => {
    shadowRoot.removeEventListener('click', delegates.get(shadowRoot))
  }
}
