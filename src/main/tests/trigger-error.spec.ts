import { describe, expect, test } from 'bun:test'
import { behavioral } from '../behavioral.ts'
import { onSelection } from './helpers.ts'

const onType = (type: string) => ({ type })

describe('trigger', () => {
  test('routes triggered events into the BP engine', () => {
    const program = behavioral()
    const { useAddThread, useTrigger } = program
    const addThread = useAddThread()
    const trigger = useTrigger()
    const received: string[] = []

    addThread({ label: 'listener', rules: [{ waitFor: [onType('allowed_event')] }], once: true })
    onSelection(program, (selected) => {
      if (selected.type === 'allowed_event') received.push('allowed_event')
    })

    trigger({ type: 'allowed_event' })

    expect(received).toEqual(['allowed_event'])
  })

  test('preserves detail payload on triggered events', () => {
    const program = behavioral()
    const { useAddThread, useTrigger } = program
    const addThread = useAddThread()
    const trigger = useTrigger()
    const received: Array<{ id: number }> = []

    addThread({ label: 'listener', rules: [{ waitFor: [onType('payload_event')] }], once: true })
    onSelection(program, (selected) => {
      if (selected.type === 'payload_event') received.push(selected.detail as { id: number })
    })

    trigger({ type: 'payload_event', detail: { id: 99 } })

    expect(received).toEqual([{ id: 99 }])
  })
})
