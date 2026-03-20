import { describe, expect, test } from 'bun:test'

import { behavioral } from '../../behavioral/behavioral.ts'
import {
  PmDescriptorSchema,
  SubAgentDescriptorSchema,
  TeamDescriptorSchema,
  TeamRouteActivitySchema,
} from '../runtime.schemas.ts'
import { createBehavioralActorRuntime, createPmRuntime, createSubAgentRuntime, createTeam } from '../runtime.ts'
import type { BehavioralActorDescriptor, PmDescriptor, SubAgentDescriptor, TeamDescriptor } from '../runtime.types.ts'

type DirectMessage = { type: 'direct_task'; detail: { taskId: string; route: 'direct' | 'mapped' } }

describe('createTeam', () => {
  test('exports PM, sub-agent, team, and route activity schemas', () => {
    const actor: BehavioralActorDescriptor = {
      kind: 'behavioral_actor' as const,
      id: 'actor-1',
      object: {
        kind: 'mss_object' as const,
        id: 'object-1',
        contentType: 'agent',
        structure: 'object' as const,
        mechanics: ['track'],
        boundary: 'ask' as const,
        scale: 'S2' as const,
      },
    }
    const subAgent: SubAgentDescriptor = {
      kind: 'sub_agent' as const,
      id: 'sub-agent-1',
      actor,
      parentActorId: 'actor-1',
    }
    const team: TeamDescriptor = {
      kind: 'team' as const,
      id: 'team-1',
      pmId: 'pm-1',
      members: [actor, subAgent],
    }
    const pm: PmDescriptor = {
      kind: 'pm' as const,
      id: 'pm-1',
    }
    const routeActivity = {
      kind: 'connect' as const,
      teamId: 'team-1',
      pmId: 'pm-1',
      sourceId: 'actor-1',
      targetId: 'sub-agent-1',
      eventTypes: ['direct_task'],
      linkId: 'link-1',
    }

    expect(SubAgentDescriptorSchema.parse(subAgent)).toEqual(subAgent)
    expect(TeamDescriptorSchema.parse(team)).toEqual(team)
    expect(PmDescriptorSchema.parse(pm)).toEqual(pm)
    expect(TeamRouteActivitySchema.parse(routeActivity)).toEqual(routeActivity)
  })

  test('opens a PM-governed direct route from an actor to a sub-agent without PM relay', async () => {
    const sourceRuntime = behavioral<{ direct_task: { taskId: string; route: 'direct' } }>()
    const targetRuntime = behavioral<{ direct_task: { taskId: string; route: 'mapped' } }>()
    const received: Array<{ taskId: string; route: 'mapped' }> = []
    const routeActivities: string[] = []

    targetRuntime.useFeedback({
      direct_task(detail) {
        received.push(detail)
      },
    })

    const actor = createBehavioralActorRuntime<DirectMessage>({
      kind: 'behavioral_actor',
      id: 'actor-1',
      object: {
        kind: 'mss_object',
        id: 'object-1',
        contentType: 'agent',
        structure: 'object',
        mechanics: ['track'],
        boundary: 'ask',
        scale: 'S2',
      },
      trigger: sourceRuntime.trigger,
      subscribe: sourceRuntime.useFeedback,
      snapshot: sourceRuntime.useSnapshot,
      destroy: () => {},
    })

    const subAgent = createSubAgentRuntime<DirectMessage>({
      kind: 'sub_agent',
      id: 'sub-agent-1',
      actor: {
        kind: 'behavioral_actor',
        id: 'actor-2',
        object: {
          kind: 'mss_object',
          id: 'object-2',
          contentType: 'agent',
          structure: 'object',
          mechanics: ['track'],
          boundary: 'ask',
          scale: 'S2',
        },
      },
      parentActorId: actor.id,
      trigger: targetRuntime.trigger,
      subscribe: targetRuntime.useFeedback,
      snapshot: targetRuntime.useSnapshot,
      destroy: () => {},
    })

    const pm = createPmRuntime<DirectMessage>({
      kind: 'pm',
      id: 'pm-1',
      authorizeRoute({ source, target, eventTypes }) {
        routeActivities.push(`authorize:${source.id}->${target.id}:${eventTypes.join(',')}`)
        return true
      },
      observeRoute(activity) {
        routeActivities.push(activity.kind)
      },
    })

    const team = createTeam<DirectMessage>({
      descriptor: {
        kind: 'team',
        id: 'team-1',
        pmId: pm.id,
        members: [actor, subAgent],
      },
      pm,
      members: [actor, subAgent],
    })

    const disconnect = team.openRoute({
      sourceId: actor.id,
      targetId: subAgent.id,
      eventTypes: ['direct_task'],
      mapMessage(message) {
        return {
          type: message.type,
          detail: {
            taskId: message.detail.taskId,
            route: 'mapped',
          },
        }
      },
    })

    sourceRuntime.trigger({
      type: 'direct_task',
      detail: { taskId: 'task-1', route: 'direct' },
    })
    await Promise.resolve()

    expect(received).toEqual([{ taskId: 'task-1', route: 'mapped' }])
    expect(actor.links?.size).toBe(1)
    expect(subAgent.links?.size).toBe(1)
    expect(routeActivities).toEqual(['authorize', 'authorize:actor-1->sub-agent-1:direct_task', 'connect'])

    disconnect()

    expect(actor.links?.size).toBe(0)
    expect(subAgent.links?.size).toBe(0)
    expect(routeActivities.at(-1)).toBe('disconnect')
  })

  test('keeps PM as route authority when direct routing is denied', () => {
    const runtime = behavioral<{ direct_task: { taskId: string; route: 'direct' } }>()
    const routeActivities: string[] = []

    const actor = createBehavioralActorRuntime<DirectMessage>({
      kind: 'behavioral_actor',
      id: 'actor-1',
      object: {
        kind: 'mss_object',
        id: 'object-1',
        contentType: 'agent',
        structure: 'object',
        mechanics: ['track'],
        boundary: 'ask',
        scale: 'S2',
      },
      trigger: runtime.trigger,
      subscribe: runtime.useFeedback,
      destroy: () => {},
    })

    const subAgent = createSubAgentRuntime<DirectMessage>({
      kind: 'sub_agent',
      id: 'sub-agent-1',
      actor,
      parentActorId: actor.id,
      trigger: runtime.trigger,
      subscribe: runtime.useFeedback,
      destroy: () => {},
    })

    const team = createTeam<DirectMessage>({
      descriptor: {
        kind: 'team',
        id: 'team-1',
        pmId: 'pm-1',
        members: [actor, subAgent],
      },
      pm: createPmRuntime({
        kind: 'pm',
        id: 'pm-1',
        authorizeRoute() {
          return false
        },
        observeRoute(activity) {
          routeActivities.push(activity.kind)
        },
      }),
      members: [actor, subAgent],
    })

    expect(() =>
      team.openRoute({
        sourceId: actor.id,
        targetId: subAgent.id,
        eventTypes: ['direct_task'],
      }),
    ).toThrow('PM denied direct route from actor-1 to sub-agent-1')
    expect(routeActivities).toEqual(['authorize', 'deny'])
    expect(actor.links?.size).toBe(0)
    expect(subAgent.links?.size).toBe(0)
  })
})
