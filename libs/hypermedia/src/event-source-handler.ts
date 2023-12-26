import { Publisher } from '@plaited/behavioral'
import { bpAddress } from '@plaited/jsx/utils'
import { noop } from '@plaited/utils'
import { Messenger, SSE, WS, BPEventSourceHandler } from '@plaited/component-types'
import { delegates, DelegatedListener, emit } from '@plaited/component/utils'
import { Plaited_Context, navigateEventType } from './constants.js'
import { isHDA } from './type-checks.js'

export const eventSourceHandler: BPEventSourceHandler = ({ root, host, privateTrigger, publicTrigger }) => {
  const disconnectCallbacks = new Set<() => void>() // holds unsubscribe callbacks
  if (isHDA(window) && window[Plaited_Context].hda) {
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
                  type: navigateEventType,
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
  const connect = (comm: Messenger | Publisher | SSE | WS) => {
    if (comm?.type === 'sse') return disconnectEventSource(comm(privateTrigger))
    if (comm?.type === 'ws') return disconnectEventSource(comm.connect(privateTrigger))
    if (comm?.type === 'publisher') return disconnectEventSource(comm.subscribe(publicTrigger))
    if (comm?.type === 'messenger') {
      const recipient = host.getAttribute(bpAddress)
      if (!recipient) {
        console.error(`Component ${host.tagName.toLowerCase()} is missing an attribute [${bpAddress}]`)
        return noop // if we're missing an address on our component return noop and console.error msg
      }
      return disconnectEventSource(comm.connect(recipient, publicTrigger))
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
