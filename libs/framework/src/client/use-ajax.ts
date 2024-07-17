/** Utility function for enabling hypermedia patterns */
import type { UseAjax, PlaitedElement } from './types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { NAVIGATE_EVENT_TYPE } from '../shared/constants.js'
import { useEmit } from './use-emit.js'

export const useAjax: UseAjax = (shadowRoot) => {
  delegates.set(
    shadowRoot,
    new DelegatedListener((event) => {
      if (event.type === 'submit') {
        event.preventDefault()
      }
      if (event.type === 'click') {
        const path = event.composedPath()
        for (const element of path) {
          if (element instanceof HTMLAnchorElement && element.href) {
            const href = element.href
            let local = false
            try {
              new URL(href)
              break
            } catch (_) {
              local = true
            }
            if (local) {
              event.preventDefault()
              event.stopPropagation()
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
  shadowRoot.addEventListener('submit', delegates.get(shadowRoot))
  return () => {
    shadowRoot.removeEventListener('click', delegates.get(shadowRoot))
    shadowRoot.removeEventListener('submit', delegates.get(shadowRoot))
  }
}
