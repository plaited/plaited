/** Utility function for enabling hypermedia patterns */
import { canUseDOM } from '@plaited/utils'
import { displayContent } from './display-content.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { fetchHTML } from './fetch-html.js'
import { NAVIGATE_EVENT_TYPE } from '../shared/constants.js'

interface PlaitedPopStateEvent extends PopStateEvent { state: { plaited: string } }

export const initPlaited = (args?: { retry?: number; retryDelay?: number; cacheSize?: number }) => {
  const { retry = 3, retryDelay = 1000, cacheSize = 10 } = args || {}
  if (canUseDOM()) {
    const updatePage = async (event: CustomEvent<string> | PlaitedPopStateEvent) => {
      const isCustomEvent = event instanceof CustomEvent
      const href = isCustomEvent ? event.detail : event.state.plaited
      const res = await fetchHTML(href, { retry, retryDelay, cacheSize })
      if (res) {
        const text = await res.text()
        const title = displayContent(text)
        isCustomEvent && history.pushState({ plaited: href }, title, href)
      }
    }
    history.replaceState({ plaited: window.location.href }, document.title, window.location.href)
    !delegates.has(window) && delegates.set(window, new DelegatedListener(updatePage))
    window.addEventListener(NAVIGATE_EVENT_TYPE, delegates.get(window))
    window.addEventListener('popstate', delegates.get(window))
  }
}