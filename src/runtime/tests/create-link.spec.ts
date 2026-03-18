import { describe, expect, test } from 'bun:test'

import { behavioral } from '../../behavioral/behavioral.ts'
import { createLink, linkToTrigger, triggerToLink } from '../runtime.ts'

describe('createLink', () => {
  test('publishes typed messages to subscribers and observers', () => {
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

    expect(received).toEqual([{ type: 'task', detail: { prompt: 'route this' } }])
    expect(activities).toEqual(['subscribe', 'publish', 'deliver', 'unsubscribe'])
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
})
