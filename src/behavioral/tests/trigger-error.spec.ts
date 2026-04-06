import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread } from 'plaited/behavioral'

describe('trigger', () => {
  test('routes triggered events into the BP engine', () => {
    const { bThreads, trigger, useFeedback } = behavioral()
    const received: string[] = []

    bThreads.set({
      listener: bThread([bSync({ waitFor: 'allowed_event' })]),
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
    const { bThreads, trigger, useFeedback } = behavioral()
    const received: Array<{ id: number }> = []

    bThreads.set({
      listener: bThread([bSync({ waitFor: 'payload_event' })]),
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
