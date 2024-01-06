/** Utility function for enabling hypermedia patterns */
import { fetchHTML, createDoc } from './fetch-html.js'
import { displayContent } from './display-content.js'
import { isTypeOf } from '@plaited/utils'
import { delegates, DelegatedListener } from './delegated-listener.js'
import { NavigateEventType, PlaitedContext } from './constants.js'

const navigate = async (event: CustomEvent<URL>) => {
  const { detail: url } = event
  const htmlContent = await fetchHTML(url.href, { partial: false })
  if (htmlContent) {
    history.pushState(new XMLSerializer().serializeToString(htmlContent), '', url.href)
    displayContent(htmlContent)
  }
}

const pop = ({ state }: PopStateEvent) => {
  if (isTypeOf<string>(state, 'string')) {
    const htmlContent = createDoc(state)
    displayContent(htmlContent)
  }
}

export const connectHDA = () => {
  const html = document.querySelector('html')
  if (html) {
    Object.assign(window, {
      [PlaitedContext]: {
        hda: true,
      },
    })
    history.replaceState(new XMLSerializer().serializeToString(html), '', document.location.href)
    !delegates.has(window) && delegates.set(window, new DelegatedListener(pop))
    window.addEventListener('popstate', delegates.get(window))
    !delegates.has(html) && delegates.set(html, new DelegatedListener(navigate))
    html.addEventListener(NavigateEventType, delegates.get(html))
    return () => {
      window.removeEventListener('popstate', delegates.get(window))
      html.removeEventListener(NavigateEventType, delegates.get(html))
    }
  }
}
