import { isTypeOf, canUseDOM } from '@plaited/utils'
import { displayContent } from './display-content.js'
import { DelegatedListener, delegates } from '../../shared/delegated-listener.js'
import { fetchHTML } from './fetch-html.js'
import { NAVIGATE_EVENT_TYPE } from '../../shared/constants.js'

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

