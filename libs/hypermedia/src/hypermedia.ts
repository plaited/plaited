/** Utility function for enabling hypermedia patterns */
import { DelegatedListener, delegates } from '@plaited/component/utils'
import { fetchHTML, createDoc } from './fetch-html.js'
import { displayContent } from './display-content.js'
import { isTypeOf } from '@plaited/utils'

const intercept = async (event: Event) => {
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
          const url = new URL(href, window.location.origin)
          const htmlContent = await fetchHTML(url.href, { partial: false })
          if (htmlContent) {
            history.pushState(new XMLSerializer().serializeToString(htmlContent), '', href)
            displayContent(htmlContent)
          }
        }
        break
      }
    }
  }
}

const pop = ({ state }: PopStateEvent) => {
  if (isTypeOf<string>(state, 'string')) {
    const htmlContent = createDoc(state)
    displayContent(htmlContent)
  }
}

export const hypermedia = () => {
  const html = document.querySelector('html')
  if (html) {
    history.replaceState(new XMLSerializer().serializeToString(html), '', document.location.href)
    !delegates.has(window) && delegates.set(window, new DelegatedListener(pop))
    window.addEventListener('popstate', delegates.get(window))
    !delegates.has(html) && delegates.set(html, new DelegatedListener(intercept))
    html.addEventListener('click', delegates.get(html))
    html.addEventListener('submit', delegates.get(html))
    return () => {
      window.removeEventListener('popstate', delegates.get(window))
      if (html) {
        html.removeEventListener('click', delegates.get(html))
        html.removeEventListener('submit', delegates.get(html))
      }
    }
  }
}
