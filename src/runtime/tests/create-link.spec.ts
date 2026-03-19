import { describe, expect, test } from 'bun:test'

import { behavioral } from '../../behavioral/behavioral.ts'
import { LinkActivitySchema, LinkMessageSchema } from '../runtime.schemas.ts'
import { createLink, linkToTrigger, triggerToLink } from '../runtime.ts'

describe('createLink', () => {
  test('accepts the public runtime link envelope in exported schemas', () => {
    const message = { type: 'pm_task', detail: { taskId: 'task-1', via: 'pm' } }
    const activity = {
      kind: 'publish' as const,
      linkId: 'pm-link',
      message,
    }

    expect(LinkMessageSchema.parse(message)).toEqual(message)
    expect(LinkActivitySchema.parse(activity)).toEqual(activity)
  })

  test('publishes typed messages to subscribers and observers', async () => {
    const activities: string[] = []
    const received: Array<{ type: 'task'; detail: { prompt: string } }> = []
    const link = createLink<{ type: 'task'; detail: { prompt: string } }>({
      id: 'pm-link',
      onActivity(activity) {
        activities.push(activity.kind)
      },
    })

    const disconnect = link.subscribe((message) => {
      received.push(message)
    })

    link.publish({ type: 'task', detail: { prompt: 'route this' } })
    disconnect()
    await Promise.resolve()

    expect(received).toEqual([{ type: 'task', detail: { prompt: 'route this' } }])
    expect(activities).toEqual(['subscribe', 'publish', 'unsubscribe', 'deliver'])
  })

  test('isolates subscriber failures so fan-out continues', async () => {
    const received: string[] = []
    const activities: string[] = []
    const link = createLink<{ type: 'task'; detail?: unknown }>({
      onActivity(activity) {
        activities.push(activity.kind)
      },
    })

    link.subscribe(() => {
      throw new Error('broken subscriber')
    })
    link.subscribe((message) => {
      received.push(message.type)
    })

    link.publish({ type: 'task' })
    await Promise.resolve()

    expect(received).toEqual(['task'])
    expect(activities).toContain('deliver_failed')
    expect(activities).toContain('deliver')
  })

  test('isolates observer failures so publish and destroy still complete', () => {
    const received: string[] = []
    const activities: string[] = []
    const link = createLink<{ type: 'task'; detail?: unknown }>()

    link.observe(() => {
      throw new Error('broken observer')
    })
    link.observe((activity) => {
      activities.push(activity.kind)
    })
    link.subscribe((message) => {
      received.push(message.type)
    })

    link.publish({ type: 'task' })
    link.destroy()

    expect(received).toEqual(['task'])
    expect(activities).toContain('publish')
    expect(activities).toContain('destroy')
  })

  test('cleans up subscribers after destroy', () => {
    const received: Array<{ type: 'task'; detail?: unknown }> = []
    const activities: string[] = []
    const link = createLink<{ type: 'task'; detail?: unknown }>({
      onActivity(activity) {
        activities.push(activity.kind)
      },
    })

    link.subscribe((message) => {
      received.push(message)
    })

    link.destroy()
    link.publish({ type: 'task' })

    expect(received).toEqual([])
    expect(activities).toContain('destroy')
    expect(activities).not.toContain('publish')
  })

  test('freezes the subscriber set for the current publish when subscriptions change mid-delivery', () => {
    const received: string[] = []
    const link = createLink<{ type: 'task'; detail: { id: string } }>({
      id: 'pm-link',
    })

    let lateReceived = 0
    let disconnectSecond = () => {}

    link.subscribe((message) => {
      received.push(`first:${message.detail.id}`)
      link.subscribe(() => {
        lateReceived += 1
      })
      disconnectSecond()
    })

    disconnectSecond = link.subscribe((message) => {
      received.push(`second:${message.detail.id}`)
    })

    link.publish({ type: 'task', detail: { id: 'task-1' } })
    link.publish({ type: 'task', detail: { id: 'task-2' } })

    expect(received).toEqual(['first:task-1', 'second:task-1', 'first:task-2'])
    expect(lateReceived).toBe(1)
  })
})

describe('linkToTrigger', () => {
  test('bridges link messages into the behavioral runtime', () => {
    const received: Array<{ type: string; detail: unknown }> = []
    const { trigger, useFeedback } = behavioral<{ routed: { taskId: string } }>()
    const link = createLink<{ type: 'routed'; detail: { taskId: string } }>()

    useFeedback({
      routed(detail) {
        received.push({ type: 'routed', detail })
      },
    })

    const disconnect = linkToTrigger({ link, trigger })

    link.publish({ type: 'routed', detail: { taskId: 'task-1' } })
    disconnect()
    link.publish({ type: 'routed', detail: { taskId: 'task-2' } })

    expect(received).toEqual([{ type: 'routed', detail: { taskId: 'task-1' } }])
  })
})

describe('triggerToLink', () => {
  test('bridges selected behavioral events into the link', () => {
    const received: Array<{ type: 'pm_event'; detail: { taskId: string } }> = []
    const { trigger, useFeedback } = behavioral<{ pm_event: { taskId: string } }>()
    const link = createLink<{ type: 'pm_event'; detail: { taskId: string } }>()

    link.subscribe((message) => {
      received.push(message)
    })

    const disconnect = triggerToLink({
      eventTypes: ['pm_event'],
      link,
      subscribe: useFeedback,
    })

    trigger({ type: 'pm_event', detail: { taskId: 'task-1' } })
    disconnect()
    trigger({ type: 'pm_event', detail: { taskId: 'task-2' } })

    expect(received).toEqual([{ type: 'pm_event', detail: { taskId: 'task-1' } }])
  })

  test('bridges directly from actor.subscribe without an out-of-band subscribe function', () => {
    const received: Array<{ type: 'pm_event'; detail: { taskId: string } }> = []
    const { trigger, useFeedback } = behavioral<{ pm_event: { taskId: string } }>()
    const link = createLink<{ type: 'pm_event'; detail: { taskId: string } }>()

    link.subscribe((message) => {
      received.push(message)
    })

    const actor = {
      subscribe: useFeedback,
    }

    const disconnect = triggerToLink({
      eventTypes: ['pm_event'],
      link,
      actor,
    })

    trigger({ type: 'pm_event', detail: { taskId: 'task-1' } })
    disconnect()

    expect(received).toEqual([{ type: 'pm_event', detail: { taskId: 'task-1' } }])
  })
})
