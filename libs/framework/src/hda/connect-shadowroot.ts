import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { NavigateEventType } from '../shared/constants.js'
import { emit } from '../shared/emit.js'
import { PlaitedElement } from '../types.js'

export const connectShadowroot = (shadowRoot: ShadowRoot) => {
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
              emit(shadowRoot.host as PlaitedElement)({
                type: NavigateEventType,
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
