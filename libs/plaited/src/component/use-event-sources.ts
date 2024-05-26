import { noop } from '@plaited/utils'
import { bpAddress } from '../jsx/constants.js'
import { Messenger, SSE, WS, PostMessenger, Publisher, PlaitedElement, Disconnect, Trigger } from '../types.js'
import { DelegatedListener, delegates } from './delegated-listener.js'
import { NavigateEventType, PLAITED_HDA } from '../shared/constants.js'
import { emit } from './emit.js'

const hasPlaitedContext = (
  win: Window,
): win is Window & {
  [PLAITED_HDA]: true
} => PLAITED_HDA in win && win[PLAITED_HDA] === true

export const useEventSources = (
  root: ShadowRoot,
  trigger: Trigger,
): ((comm: Messenger | Publisher | SSE | WS | PostMessenger) => Disconnect) => {
  const host = root.host as PlaitedElement
  const disconnectCallbacks = new Set<() => void>() // holds unsubscribe callbacks
  if (hasPlaitedContext(window)) {
    delegates.set(
      root,
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
                emit(host)({
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
    root.addEventListener('click', delegates.get(root))
    root.addEventListener('submit', delegates.get(root))
    disconnectCallbacks.add(() => {
      root.removeEventListener('click', delegates.get(root))
      root.removeEventListener('submit', delegates.get(root))
    })
  }
  /** Manually disconnect connection to Messenger, Publisher, Web Socket, or Server Sent Events */
  const disconnectEventSource = (cb: (() => void) | undefined) => {
    const callback = cb ?? noop
    disconnectCallbacks.add(callback)
    return () => {
      callback()
      disconnectCallbacks.delete(callback)
    }
  }

  /** connect trigger to a Messenger, Publisher, Server Sent Event, Web Socket or PostMessenger */
  const connect = (comm: Messenger | Publisher | SSE | WS | PostMessenger) => {
    if (comm?.type === 'sse') return disconnectEventSource(comm(trigger))
    if (comm?.type === 'ws') return disconnectEventSource(comm.connect(trigger))
    if (comm?.type === 'publisher') return disconnectEventSource(comm.connect(trigger, host))
    if (comm?.type === 'post-messenger') return disconnectEventSource(comm.connect(trigger, host))
    if (comm?.type === 'messenger') {
      const recipient = host.getAttribute(bpAddress)
      if (!recipient) {
        console.error(`Component ${host.tagName.toLowerCase()} is missing an attribute [${bpAddress}]`)
        return noop // if we're missing an address on our component return noop and console.error msg
      }
      return disconnectEventSource(comm.connect({ recipient, trigger, observedTriggers: host }))
    }
    return noop
  }
  host.disconnectEventSources = () => {
    if (disconnectCallbacks.size) {
      disconnectCallbacks.forEach((unsubscribe) => {
        unsubscribe()
      })
      disconnectCallbacks.clear()
    }
  }
  return connect
}
