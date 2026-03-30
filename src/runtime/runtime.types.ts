import type { DefaultHandlers, Disconnect, Trigger } from '../behavioral/behavioral.types.ts'
import type {
  LINK_ACTIVITY_KINDS,
  MSS_BOUNDARIES,
  MSS_MECHANICS,
  MSS_SCALES,
  MSS_STRUCTURES,
} from './runtime.constants.ts'
import type { LinkActivity, MssObject, RuntimeArtifact, RuntimeContract } from './runtime.schemas.ts'

/**
 * MSS content type.
 *
 * @public
 */
export type ContentType = string

/**
 * MSS structure.
 *
 * @public
 */
export type Structure = (typeof MSS_STRUCTURES)[number]

/**
 * MSS mechanic.
 *
 * @public
 */
export type Mechanic = (typeof MSS_MECHANICS)[number]

/**
 * MSS boundary.
 *
 * @public
 */
export type Boundary = (typeof MSS_BOUNDARIES)[number]

/**
 * MSS scale.
 *
 * @public
 */
export type Scale = (typeof MSS_SCALES)[number]

/**
 * Observable link activity kind.
 *
 * @public
 */
export type LinkActivityKind = (typeof LINK_ACTIVITY_KINDS)[number]

/**
 * Canonical runtime message envelope.
 *
 * @public
 */
export type LinkMessage = { type: string; detail?: unknown }

/**
 * Runtime link subscriber.
 *
 * @public
 */
export type LinkSubscriber<Message extends LinkMessage = LinkMessage> = (message: Message) => void | Promise<void>

/**
 * Runtime link observer.
 *
 * @public
 */
export type LinkObserver<Message extends LinkMessage = LinkMessage> = (
  activity: LinkActivity & { message?: Message },
) => void | Promise<void>

/**
 * Transport-specific bridge for cross-process link delivery.
 *
 * @public
 */
export type LinkBridge<Message extends LinkMessage = LinkMessage> = {
  send: (message: Message) => void
  receive: (listener: LinkSubscriber<Message>) => Disconnect
  destroy?: () => void
}

/**
 * Transport adapter for IPC-backed runtime links.
 *
 * @public
 */
export type CreateIpcLinkBridgeOptions<Message extends LinkMessage = LinkMessage> = {
  send: (message: Message) => void
  subscribe: (listener: (message: unknown) => void) => Disconnect
  destroy?: () => void
  isMessage?: (message: unknown) => message is Message
}

/**
 * Event handler map derived from a message envelope union.
 *
 * @public
 */
export type MessageHandlers<Message extends LinkMessage = LinkMessage> = {
  [Type in Message['type']]: (detail: Extract<Message, { type: Type }>['detail']) => void | Promise<void>
} & DefaultHandlers

/**
 * Public createLink options.
 *
 * @public
 */
export type CreateLinkOptions<Message extends LinkMessage = LinkMessage> = {
  id?: string
  onActivity?: LinkObserver<Message>
  bridge?: LinkBridge<Message>
}

/**
 * Transport-neutral communication primitive.
 *
 * @public
 */
export type RuntimeLink<Message extends LinkMessage = LinkMessage> = {
  id: string
  publish: (message: Message) => void
  subscribe: (listener: LinkSubscriber<Message>) => Disconnect
  observe: (listener: LinkObserver<Message>) => Disconnect
  destroy: () => void
}

/**
 * Options for bridging link traffic into a BP trigger.
 *
 * @public
 */
export type LinkToTriggerOptions<Message extends LinkMessage = LinkMessage> = {
  link: RuntimeLink<Message>
  trigger: Trigger
  mapMessage?: (message: Message) => Message
}

/**
 * Options for bridging selected BP events into a link.
 *
 * @public
 */
export type TriggerToLinkOptions<Message extends LinkMessage = LinkMessage> = {
  eventTypes: Message['type'][]
  link: RuntimeLink<Message>
  createMessage?: (event: Message) => Message
} & (
  | {
      actor: {
        subscribe: (handlers: MessageHandlers<Message>) => Disconnect
      }
      subscribe?: (handlers: MessageHandlers<Message>) => Disconnect
    }
  | {
      actor?: {
        subscribe: (handlers: MessageHandlers<Message>) => Disconnect
      }
      subscribe: (handlers: MessageHandlers<Message>) => Disconnect
    }
)

export type { LinkActivity, MssObject, RuntimeArtifact, RuntimeContract }
