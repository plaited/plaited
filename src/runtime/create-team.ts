import { createLink, linkToTrigger, triggerToLink } from './create-link.ts'
import type {
  BehavioralActor,
  BehavioralActorDescriptor,
  CreateManagedTeamRuntimeOptions,
  CreateRuntimeParticipantOptions,
  CreateTeamOptions,
  LinkMessage,
  ManagedTeamRuntime,
  OpenTeamRouteOptions,
  PmRuntime,
  SubAgent,
  SubAgentDescriptor,
  Team,
  TeamMember,
  TeamRouteActivity,
  TeamRouteObserver,
} from './runtime.types.ts'

const notifyRouteObserver = (observer: TeamRouteObserver | undefined, activity: TeamRouteActivity) => {
  if (!observer) return

  try {
    const result = observer(activity)
    Promise.resolve(result).catch((error) => {
      console.error('Runtime team observer failed', error)
    })
  } catch (error) {
    console.error('Runtime team observer failed', error)
  }
}

const createParticipantLinks = <Message extends LinkMessage>() => new Set<ReturnType<typeof createLink<Message>>>()

/**
 * Wraps a behavioral runtime as an explicit runtime actor.
 *
 * @public
 */
export const createBehavioralActorRuntime = <Message extends LinkMessage = LinkMessage>({
  trigger,
  subscribe,
  snapshot,
  destroy,
  ...descriptor
}: CreateRuntimeParticipantOptions<BehavioralActorDescriptor, Message>): BehavioralActor<Message> => {
  return {
    ...descriptor,
    trigger,
    subscribe,
    snapshot,
    destroy,
    links: createParticipantLinks<Message>(),
  }
}

/**
 * Wraps an isolated behavioral runtime as a sub-agent.
 *
 * @public
 */
export const createSubAgentRuntime = <Message extends LinkMessage = LinkMessage>({
  trigger,
  subscribe,
  snapshot,
  destroy,
  ...descriptor
}: CreateRuntimeParticipantOptions<SubAgentDescriptor, Message>): SubAgent<Message> => {
  return {
    ...descriptor,
    trigger,
    subscribe,
    snapshot,
    destroy,
    links: createParticipantLinks<Message>(),
  }
}

/**
 * Creates a PM authority surface for governed team routes.
 *
 * @public
 */
export const createPmRuntime = <Message extends LinkMessage = LinkMessage>({
  id,
  authorizeRoute,
  observeRoute,
}: PmRuntime<Message>): PmRuntime<Message> => {
  return {
    kind: 'pm',
    id,
    authorizeRoute,
    observeRoute,
  }
}

const assertTeamMember = <Message extends LinkMessage>(
  members: Map<string, TeamMember<Message>>,
  memberId: string,
  role: 'source' | 'target',
) => {
  const member = members.get(memberId)

  if (!member) {
    throw new Error(`Unknown ${role} team member: ${memberId}`)
  }

  return member
}

const observeRoute = (observers: Array<TeamRouteObserver | undefined>, activity: TeamRouteActivity) => {
  for (const observer of observers) {
    notifyRouteObserver(observer, activity)
  }
}

const assertUniqueMemberId = <Message extends LinkMessage>(
  members: Map<string, TeamMember<Message>>,
  memberId: string,
) => {
  if (members.has(memberId)) {
    throw new Error(`Duplicate team member: ${memberId}`)
  }
}

/**
 * Creates a governed team runtime where PM authorizes direct actor routes.
 *
 * @public
 */
export const createTeam = <Message extends LinkMessage = LinkMessage>({
  descriptor,
  pm,
  members,
  onRouteActivity,
}: CreateTeamOptions<Message>): Team<Message> => {
  const memberMap = new Map(members.map((member) => [member.id, member]))
  const activeRouteDisconnects = new Set<() => void>()
  const routeObservers = [pm.observeRoute, onRouteActivity]

  const openRoute = ({
    id,
    sourceId,
    targetId,
    eventTypes,
    mapMessage,
    createMessage,
  }: OpenTeamRouteOptions<Message>) => {
    const source = assertTeamMember(memberMap, sourceId, 'source')
    const target = assertTeamMember(memberMap, targetId, 'target')

    observeRoute(routeObservers, {
      kind: 'authorize',
      teamId: descriptor.id,
      pmId: pm.id,
      sourceId,
      targetId,
      eventTypes: [...eventTypes],
    })

    if (pm.authorizeRoute && !pm.authorizeRoute({ teamId: descriptor.id, source, target, eventTypes })) {
      observeRoute(routeObservers, {
        kind: 'deny',
        teamId: descriptor.id,
        pmId: pm.id,
        sourceId,
        targetId,
        eventTypes: [...eventTypes],
      })
      throw new Error(`PM denied direct route from ${sourceId} to ${targetId}`)
    }

    const link = createLink<Message>({ id })
    source.links?.add(link)
    target.links?.add(link)

    const disconnectSource = triggerToLink({
      eventTypes,
      link,
      actor: source,
      createMessage,
    })
    const disconnectTarget = linkToTrigger({
      link,
      trigger: target.trigger,
      mapMessage,
    })

    observeRoute(routeObservers, {
      kind: 'connect',
      teamId: descriptor.id,
      pmId: pm.id,
      sourceId,
      targetId,
      eventTypes: [...eventTypes],
      linkId: link.id,
    })

    let disconnected = false
    const disconnectRoute = () => {
      if (disconnected) return
      disconnected = true
      activeRouteDisconnects.delete(disconnectRoute)
      disconnectSource()
      disconnectTarget()
      source.links?.delete(link)
      target.links?.delete(link)
      link.destroy()
      observeRoute(routeObservers, {
        kind: 'disconnect',
        teamId: descriptor.id,
        pmId: pm.id,
        sourceId,
        targetId,
        eventTypes: [...eventTypes],
        linkId: link.id,
      })
    }

    activeRouteDisconnects.add(disconnectRoute)
    return disconnectRoute
  }

  return {
    ...descriptor,
    pm,
    members: memberMap,
    openRoute,
    destroy() {
      for (const disconnect of [...activeRouteDisconnects]) {
        disconnect()
      }
    },
  }
}

/**
 * Creates one integrated PM-owned actor/sub-agent/team runtime path.
 *
 * @public
 */
export const createManagedTeamRuntime = <Message extends LinkMessage = LinkMessage>({
  actor,
  teamId = `team:${actor.id}`,
  pmId = `pm:${actor.id}`,
  authorizeRoute = () => true,
  observeRoute,
  onRouteActivity,
}: CreateManagedTeamRuntimeOptions<Message>): ManagedTeamRuntime<Message> => {
  const managedSubAgentIds = new Set<string>()
  const pm = createPmRuntime<Message>({
    kind: 'pm',
    id: pmId,
    authorizeRoute,
    observeRoute,
  })
  const team = createTeam<Message>({
    descriptor: {
      kind: 'team',
      id: teamId,
      pmId: pm.id,
      members: [actor],
    },
    pm,
    members: [actor],
    onRouteActivity,
  })

  const attachSubAgent = (subAgent: SubAgent<Message>) => {
    assertUniqueMemberId(team.members, subAgent.id)
    team.members.set(subAgent.id, subAgent)
    managedSubAgentIds.add(subAgent.id)
    return subAgent
  }

  const openDirectRoute: ManagedTeamRuntime<Message>['openDirectRoute'] = ({ sourceId = actor.id, ...options }) => {
    return team.openRoute({
      sourceId,
      ...options,
    })
  }

  const destroy = () => {
    team.destroy()

    for (const subAgentId of managedSubAgentIds) {
      const member = team.members.get(subAgentId)
      member?.destroy()
      team.members.delete(subAgentId)
    }
  }

  return {
    pm,
    actor,
    team,
    attachSubAgent,
    openDirectRoute,
    destroy,
  }
}
