/** Utility function for enabling hypermedia patterns */
import { isTypeOf } from '@plaited/utils'
import { displayContent } from './display-content.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { fetchHTML, FetchHTMLOptions } from './fetch-html.js'
import { NavigateEventType, PLAITED_HDA_HOOK } from '../shared/constants.js'
import { connectShadowroot } from './connect-shadowroot.js'

export const useHDA = ({ retry, retryDelay, ...options }: FetchHTMLOptions = { retry: 3, retryDelay: 1_000 }) => {
  const html = document.querySelector('html')
  if (html) {
    const navigate = async (event: CustomEvent<URL>) => {
      const { detail: url } = event
      const htmlString = await fetchHTML(url.href, { retry, retryDelay, ...options })
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

    Object.assign(window, {
      [PLAITED_HDA_HOOK]: connectShadowroot,
    })

    history.replaceState(new XMLSerializer().serializeToString(html), '', document.location.href)
    !delegates.has(window) && delegates.set(window, new DelegatedListener(pop))
    window.addEventListener('popstate', delegates.get(window))
    !delegates.has(html) && delegates.set(html, new DelegatedListener(navigate))
    html.addEventListener(NavigateEventType, delegates.get(html))
  }
}
