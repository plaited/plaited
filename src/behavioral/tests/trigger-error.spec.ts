import { describe, expect, test } from 'bun:test'
import { behavioral } from '../behavioral.ts'

const onType = (type: string) => ({ type })

describe('trigger', () => {
  test('routes triggered events into the BP engine', () => {
    const { useAddThread, useTrigger, useAddHandler } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    const received: string[] = []

    addThread({ label: 'listener', rules: [{ waitFor: [onType('allowed_event')] }], once: true })
    addHandler('allowed_event', () => {
      received.push('allowed_event')
    })

    trigger({ type: 'allowed_event' })

    expect(received).toEqual(['allowed_event'])
  })

  test('preserves detail payload on triggered events', () => {
    const { useAddThread, useTrigger, useAddHandler } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    const received: Array<{ id: number }> = []

    addThread({ label: 'listener', rules: [{ waitFor: [onType('payload_event')] }], once: true })
    addHandler<{ id: number }>('payload_event', ({ detail }) => {
      received.push(detail)
    })

    trigger({ type: 'payload_event', detail: { id: 99 } })

    expect(received).toEqual([{ id: 99 }])
  })
})
