import { bpAddress } from '@plaited/jsx/utils'
import { noop } from '@plaited/utils'
import { Messenger, SSE, WS, BPEventSourceHandler, PostMessenger, Publisher } from '@plaited/component-types'
import { delegates, DelegatedListener } from './delegated-listener.js'
import { PlaitedContext, NavigateEventType } from './constants.js'
import { hasPlaitedContext, emit } from './private-utils.js'

export const eventSourceHandler: BPEventSourceHandler = ({ root, host, trigger, observedTriggers }) => {
  const disconnectCallbacks = new Set<() => void>() // holds unsubscribe callbacks
  if (hasPlaitedContext(window) && window[PlaitedContext].hda) {
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

  /** connect trigger to a Messenger or Publisher */
  const connect = (comm: Messenger | Publisher | SSE | WS | PostMessenger) => {
    if (comm?.type === 'sse') return disconnectEventSource(comm(trigger))
    if (comm?.type === 'ws') return disconnectEventSource(comm.connect(trigger))
    if (comm?.type === 'publisher') return disconnectEventSource(comm.subscribe(trigger, observedTriggers))
    if (comm?.type === 'post-messenger') return disconnectEventSource(comm.connect(trigger, observedTriggers))
    if (comm?.type === 'messenger') {
      const recipient = host.getAttribute(bpAddress)
      if (!recipient) {
        console.error(`Component ${host.tagName.toLowerCase()} is missing an attribute [${bpAddress}]`)
        return noop // if we're missing an address on our component return noop and console.error msg
      }
      return disconnectEventSource(comm.connect({ recipient, trigger, observedTriggers }))
    }
    return noop
  }
  const disconnect = () => {
    if (disconnectCallbacks.size) {
      disconnectCallbacks.forEach((unsubscribe) => {
        unsubscribe()
      })
      disconnectCallbacks.clear()
    }
  }
  return { connect, disconnect }
}
