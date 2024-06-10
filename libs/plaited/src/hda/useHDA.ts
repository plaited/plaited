/** Utility function for enabling hypermedia patterns */
import type { Logger } from '../types.js'
import { isTypeOf } from '@plaited/utils'
import { displayContent } from './display-content.js'
import { DelegatedListener, delegates } from '../component/delegated-listener.js'
import { createDoc } from '../shared/parser-utils.js'
import { fetchHTML } from './fetch-html.js'
import { NavigateEventType, PLAITED_HDA_HOOK } from '../shared/constants.js'
import { connectShadowroot } from './connect-shadowroot.js'
/**
 * Initializes the Hypermedia Driven Application (HDA) by setting up event listeners for navigation and popstate events.
 * It also serializes the current HTML document and replaces the current history state with it.
 *
 * The module returns a cleanup function that removes the event listeners when called.
 *
 */
export const useHDA = <T>(logger: Logger<T>) => {
  const html = document.querySelector('html')
  if (html) {
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
