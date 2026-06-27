import { describe, expect, test } from 'bun:test'
import { behavioral } from '../behavioral.ts'
import { sync, thread } from '../behavioral.utils.ts'

const onType = (type: string) => ({ type })

describe('trigger', () => {
  test('routes triggered events into the BP engine', () => {
    const { addThread, trigger, addHandler } = behavioral()
    const received: string[] = []

    addThread('listener', thread([sync({ waitFor: onType('allowed_event') })], true))
    addHandler('allowed_event', () => {
      received.push('allowed_event')
    })

    trigger({ type: 'allowed_event' })

    expect(received).toEqual(['allowed_event'])
  })

  test('preserves detail payload on triggered events', () => {
    const { addThread, trigger, addHandler } = behavioral()
    const received: Array<{ id: number }> = []

    addThread('listener', thread([sync({ waitFor: onType('payload_event') })], true))
    addHandler<{ id: number }>('payload_event', (detail) => {
      received.push(detail)
    })

    trigger({ type: 'payload_event', detail: { id: 99 } })

    expect(received).toEqual([{ id: 99 }])
  })
})
