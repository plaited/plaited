/** Utility function for enabling hypermedia patterns */
import { isTypeOf, canUseDOM } from '../utils.js'
import { displayContent } from './display-content.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { fetchHTML } from './fetch-html.js'
import { NAVIGATE_EVENT_TYPE } from './constants.js'
import { captureHook } from './capture-hook.js'
import type { UseAjax } from './types.js'

export const useAjax: UseAjax = (args) => {
  if (canUseDOM()) {
    const navigate = async (event: CustomEvent<URL>) => {
      const { detail: url } = event
      const htmlString = await fetchHTML(url.href, args)
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
  return captureHook
}
