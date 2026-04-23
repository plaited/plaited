import { describe, expect, test } from 'bun:test'
import { behavioral, onType, sync, thread } from './helpers.ts'

describe('trigger', () => {
  test('routes triggered events into the BP engine', () => {
    const { addBThreads, trigger, useFeedback } = behavioral()
    const received: string[] = []

    addBThreads({
      listener: thread([sync({ waitFor: onType('allowed_event') })]),
    })
    useFeedback({
      allowed_event() {
        received.push('allowed_event')
      },
    })

    trigger({ type: 'allowed_event' })

    expect(received).toEqual(['allowed_event'])
  })

  test('preserves detail payload on triggered events', () => {
    const { addBThreads, trigger, useFeedback } = behavioral()
    const received: Array<{ id: number }> = []

    addBThreads({
      listener: thread([sync({ waitFor: onType('payload_event') })]),
    })
    useFeedback({
      payload_event(detail) {
        received.push(detail as { id: number })
      },
    })

    trigger({ type: 'payload_event', detail: { id: 99 } })

    expect(received).toEqual([{ id: 99 }])
  })
})
