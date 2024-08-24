/** Utility function for enabling hypermedia patterns */
import type { Disconnect } from '../shared/types.js'
import type { PlaitedElement } from './types.js'
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
          if (element instanceof HTMLAnchorElement && element.hasAttribute('href')) {
            const href = element.getAttribute('href')
            const target = element.getAttribute('target')
            const targetIsSelf = target === null || target === '_self'
            if (href?.startsWith(window.location.origin) && targetIsSelf) {
              event.preventDefault()
              event.stopPropagation()
              const emit = useEmit(shadowRoot.host as PlaitedElement)
              emit<string>({
                type: NAVIGATE_EVENT_TYPE,
                detail: href,
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
