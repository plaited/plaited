/** Utility function for enabling hypermedia patterns */
import { isTypeOf } from '@plaited/utils'
import { displayContent } from './display-content.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { fetchHTML } from './fetch-html.js'
import { NAVIGATE_EVENT_TYPE } from './constants.js'
import { PLAITED_CAPTURE_HOOK, PLAITED_LOGGER, PLAITED_SOCKET_HOOK } from '../shared/constants.js'
import { captureHook } from './capture-hook.js'
import type { WireArgs } from './types.js'

export const wire = ({
  retry,
  retryDelay,
  logger,
  socket,
  ...options
}: WireArgs = { retry: 3, retryDelay: 1_000 }) => {
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
      [PLAITED_CAPTURE_HOOK]: captureHook,
      [PLAITED_LOGGER]: logger,
      [PLAITED_SOCKET_HOOK]: socket,
    })

    history.replaceState(new XMLSerializer().serializeToString(html), '', document.location.href)
    !delegates.has(window) && delegates.set(window, new DelegatedListener(pop))
    window.addEventListener('popstate', delegates.get(window))
    !delegates.has(html) && delegates.set(html, new DelegatedListener(navigate))
    html.addEventListener(NAVIGATE_EVENT_TYPE, delegates.get(html))
  }
}
