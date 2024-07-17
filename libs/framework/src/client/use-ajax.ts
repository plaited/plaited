/** Utility function for enabling hypermedia patterns */
import type { UseAjax, PlaitedElement } from './types.js'
import { isTypeOf, canUseDOM } from '@plaited/utils'
import { displayContent } from './display-content.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { fetchHTML } from './fetch-html.js'
import { NAVIGATE_EVENT_TYPE } from './constants.js'
import { useEmit } from '../shared/use-emit.js'

if (canUseDOM()) {
  const navigate = async (event: CustomEvent<URL>) => {
    const { detail: url } = event
    const htmlString = await fetchHTML(url.href)
    if (htmlString) {
      history.pushState(htmlString, '', url.href)
      displayContent(htmlString)
    }
  }
  const pop = ({ state }: PopStateEvent) => {
    if (isTypeOf<string>(state, 'string')) {
      displayContent(state)
    }
  }
  const html = document.querySelector('html') as HTMLHtmlElement
  history.replaceState(new XMLSerializer().serializeToString(html), '', document.location.href)
  !delegates.has(window) && delegates.set(window, new DelegatedListener(pop))
  window.addEventListener('popstate', delegates.get(window))
  !delegates.has(html) && delegates.set(html, new DelegatedListener(navigate))
  html.addEventListener(NAVIGATE_EVENT_TYPE, delegates.get(html))
}

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
