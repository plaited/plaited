import type { Disconnect } from '../behavioral/behavioral.types.ts'
import type {
  CreateLinkOptions,
  LinkActivity,
  LinkBridge,
  LinkMessage,
  LinkObserver,
  LinkSubscriber,
  LinkToTriggerOptions,
  MessageHandlers,
  RuntimeLink,
  TriggerToLinkOptions,
} from './runtime.types.ts'

const createDisconnect = <T>(listeners: Set<T>, listener: T, onDisconnect?: () => void): Disconnect => {
  let disconnected = false

  return () => {
    if (disconnected) return
    disconnected = true
    const deleted = listeners.delete(listener)
    deleted && onDisconnect?.()
  }
}

const publishActivity = <Message extends LinkMessage>(
  observers: Set<LinkObserver<Message>>,
  activity: LinkActivity & { message?: Message },
) => {
  const observerSnapshot = [...observers]

  for (const observer of observerSnapshot) {
    try {
      const result = observer(activity)
      Promise.resolve(result).catch((error) => {
        console.error('Runtime link observer failed', error)
      })
    } catch (error) {
      console.error('Runtime link observer failed', error)
    }
  }
}

const isolateDelivery = <Message extends LinkMessage>({
  listener,
  message,
  onDelivered,
  onFailed,
}: {
  listener: LinkSubscriber<Message>
  message: Message
  onDelivered: () => void
  onFailed: (error: unknown) => void
}) => {
  try {
    const result = listener(message)
    Promise.resolve(result).then(onDelivered, onFailed)
  } catch (error) {
    onFailed(error)
  }
}

/**
 * Creates a transport-neutral BP event link.
 *
 * @public
 */
export const createLink = <Message extends LinkMessage = LinkMessage>({
  id = crypto.randomUUID(),
  onActivity,
  bridge,
}: CreateLinkOptions<Message> = {}): RuntimeLink<Message> => {
  const subscribers = new Set<LinkSubscriber<Message>>()
  const observers = new Set<LinkObserver<Message>>()
  let destroyed = false

  onActivity && observers.add(onActivity)

  const emitActivity = (activity: LinkActivity & { message?: Message }) => {
    publishActivity(observers, activity)
  }

  const deliverToSubscribers = (message: Message) => {
    const subscriberSnapshot = [...subscribers]

    for (const subscriber of subscriberSnapshot) {
      isolateDelivery({
        listener: subscriber,
        message,
        onDelivered: () => {
          emitActivity({ kind: 'deliver', linkId: id, message })
        },
        onFailed: (error) => {
          emitActivity({
            kind: 'deliver_failed',
            linkId: id,
            message,
            error: error instanceof Error ? error.message : String(error),
          })
        },
      })
    }
  }

  const publishToBridge = (message: Message, activeBridge: LinkBridge<Message>) => {
    try {
      activeBridge.send(message)
    } catch (error) {
      emitActivity({
        kind: 'bridge_failed',
        linkId: id,
        message,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const bridgeDisconnect = bridge?.receive((message) => {
    if (destroyed) return
    emitActivity({ kind: 'receive', linkId: id, message })
    deliverToSubscribers(message)
  })

  const publish = (message: Message) => {
    if (destroyed) return

    emitActivity({ kind: 'publish', linkId: id, message })
    deliverToSubscribers(message)
    bridge && publishToBridge(message, bridge)
  }

  const subscribe = (listener: LinkSubscriber<Message>) => {
    if (destroyed) return () => {}

    subscribers.add(listener)
    const subscriptionId = crypto.randomUUID()
    emitActivity({ kind: 'subscribe', linkId: id, subscriptionId })

    return createDisconnect(subscribers, listener, () => {
      emitActivity({ kind: 'unsubscribe', linkId: id, subscriptionId })
    })
  }

  const observe = (listener: LinkObserver<Message>) => {
    if (destroyed) return () => {}

    observers.add(listener)
    return createDisconnect(observers, listener)
  }

  const destroy = () => {
    if (destroyed) return
    destroyed = true
    bridgeDisconnect?.()
    bridge?.destroy?.()
    emitActivity({ kind: 'destroy', linkId: id })
    subscribers.clear()
    observers.clear()
  }

  return {
    id,
    publish,
    subscribe,
    observe,
    destroy,
  }
}

/**
 * Bridges link traffic into a BP trigger.
 *
 * @public
 */
export const linkToTrigger = <Message extends LinkMessage = LinkMessage>({
  link,
  trigger,
  mapMessage,
}: LinkToTriggerOptions<Message>): Disconnect => {
  return link.subscribe((message) => {
    trigger(mapMessage ? mapMessage(message) : message)
  })
}

/**
 * Bridges selected BP events into a runtime link.
 *
 * @public
 */
export const triggerToLink = <Message extends LinkMessage = LinkMessage>({
  eventTypes,
  link,
  actor,
  subscribe,
  createMessage,
}: TriggerToLinkOptions<Message>): Disconnect => {
  const handlers: Record<string, (detail: unknown) => void | Promise<void>> = {}
  const subscribeToActor = actor?.subscribe ?? subscribe

  if (!subscribeToActor) {
    throw new Error('triggerToLink requires either actor.subscribe or subscribe')
  }

  for (const eventType of eventTypes) {
    handlers[eventType] = (detail) => {
      const message = createMessage
        ? createMessage({ type: eventType, detail } as Message)
        : ({ type: eventType, detail } as Message)
      link.publish(message)
    }
  }

  return subscribeToActor(handlers as MessageHandlers<Message>)
}

export type { CreateLinkOptions, LinkBridge, RuntimeLink, TriggerToLinkOptions }
