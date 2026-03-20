import type { DefaultHandlers, Disconnect, SnapshotListener, Trigger } from '../behavioral/behavioral.types.ts'
import type {
  LINK_ACTIVITY_KINDS,
  MSS_BOUNDARIES,
  MSS_MECHANICS,
  MSS_SCALES,
  MSS_STRUCTURES,
  TEAM_ROUTE_ACTIVITY_KINDS,
} from './runtime.constants.ts'
import type {
  BehavioralActorDescriptor,
  LinkActivity,
  MssObject,
  PmDescriptor,
  RuntimeArtifact,
  RuntimeContract,
  SubAgentDescriptor,
  TeamDescriptor,
  TeamRouteActivity,
} from './runtime.schemas.ts'

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
 * Observable team route activity kind.
 *
 * @public
 */
export type TeamRouteActivityKind = (typeof TEAM_ROUTE_ACTIVITY_KINDS)[number]

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
 * Concrete runtime shape for a behavioral actor.
 *
 * @remarks
 * The structural MSS object remains separate from the runtime edge that coordinates it.
 *
 * @public
 */
export type BehavioralActor<Message extends LinkMessage = LinkMessage> = BehavioralActorDescriptor & {
  trigger: Trigger
  subscribe: (handlers: MessageHandlers<Message>) => Disconnect
  snapshot?: (listener: SnapshotListener) => Disconnect
  destroy: () => void
  links?: Set<RuntimeLink<Message>>
}

/**
 * Concrete runtime shape for an isolated sub-agent.
 *
 * @public
 */
export type SubAgent<Message extends LinkMessage = LinkMessage> = SubAgentDescriptor & {
  trigger: Trigger
  subscribe: (handlers: MessageHandlers<Message>) => Disconnect
  snapshot?: (listener: SnapshotListener) => Disconnect
  destroy: () => void
  links?: Set<RuntimeLink<Message>>
}

/**
 * PM authority surface for governed direct routes.
 *
 * @public
 */
export type PmRuntime<Message extends LinkMessage = LinkMessage> = PmDescriptor & {
  authorizeRoute?: (route: TeamRouteRequest<Message>) => boolean
  observeRoute?: (activity: TeamRouteActivity) => void | Promise<void>
}

/**
 * Team member runtime shape.
 *
 * @public
 */
export type TeamMember<Message extends LinkMessage = LinkMessage> = BehavioralActor<Message> | SubAgent<Message>

/**
 * Request to open a direct route inside a team.
 *
 * @public
 */
export type TeamRouteRequest<Message extends LinkMessage = LinkMessage> = {
  teamId: string
  source: TeamMember<Message>
  target: TeamMember<Message>
  eventTypes: Message['type'][]
}

/**
 * Team route observer.
 *
 * @public
 */
export type TeamRouteObserver = (activity: TeamRouteActivity) => void | Promise<void>

/**
 * Factory inputs shared by actor and sub-agent wrappers.
 *
 * @public
 */
export type CreateRuntimeParticipantOptions<
  Descriptor extends BehavioralActorDescriptor | SubAgentDescriptor,
  Message extends LinkMessage = LinkMessage,
> = Descriptor & {
  trigger: Trigger
  subscribe: (handlers: MessageHandlers<Message>) => Disconnect
  snapshot?: (listener: SnapshotListener) => Disconnect
  destroy: () => void
}

/**
 * Options for creating a governed team runtime.
 *
 * @public
 */
export type CreateTeamOptions<Message extends LinkMessage = LinkMessage> = {
  descriptor: TeamDescriptor
  pm: PmRuntime<Message>
  members: TeamMember<Message>[]
  onRouteActivity?: TeamRouteObserver
}

/**
 * Options for opening a direct route between team members.
 *
 * @public
 */
export type OpenTeamRouteOptions<Message extends LinkMessage = LinkMessage> = {
  id?: string
  sourceId: string
  targetId: string
  eventTypes: Message['type'][]
  mapMessage?: (message: Message) => Message
  createMessage?: (event: Message) => Message
}

/**
 * Concrete team runtime with PM-governed direct routes.
 *
 * @public
 */
export type Team<Message extends LinkMessage = LinkMessage> = Omit<TeamDescriptor, 'members'> & {
  pm: PmRuntime<Message>
  members: Map<string, TeamMember<Message>>
  openRoute: (options: OpenTeamRouteOptions<Message>) => Disconnect
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
      actor: Pick<BehavioralActor<Message>, 'subscribe'>
      subscribe?: (handlers: MessageHandlers<Message>) => Disconnect
    }
  | {
      actor?: Pick<BehavioralActor<Message>, 'subscribe'>
      subscribe: (handlers: MessageHandlers<Message>) => Disconnect
    }
)

export type {
  BehavioralActorDescriptor,
  LinkActivity,
  MssObject,
  PmDescriptor,
  RuntimeArtifact,
  RuntimeContract,
  SubAgentDescriptor,
  TeamDescriptor,
  TeamRouteActivity,
}
