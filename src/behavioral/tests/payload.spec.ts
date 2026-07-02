import { describe, expect, test } from 'bun:test'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'
import { sync, thread } from '../behavioral.utils.ts'

describe('payload channel', () => {
  test('delivers non-JSON payload to handler as the third argument', () => {
    const { addThread, trigger, addHandler } = behavioral()

    const payload = new Blob(['hello'])
    let receivedPayload: unknown = null
    let receivedDetail: unknown = null

    addThread('producer', thread([sync({ request: { type: 'upload', detail: { name: 'file.txt' } } })], true))
    addHandler<{ name: string }>('upload', (detail, _disconnect, payload) => {
      receivedDetail = detail
      receivedPayload = payload
    })

    // An ingress trigger carries the opaque payload straight to the handler.
    trigger({ type: 'upload', detail: { name: 'file.txt' }, payload })

    expect(receivedDetail).toEqual({ name: 'file.txt' })
    expect(receivedPayload).toBe(payload)
  })

  test('payload is absent from every SnapshotMessage variant when selected', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const payload = { fn: () => {} }

    addThread('producer', thread([sync({ request: { type: 'work', detail: { id: 1 } } })], true))
    addHandler('work', () => {
      throw new Error('boom')
    })

    trigger({ type: 'work', detail: { id: 1 }, payload })

    // Assert every snapshot message is JSON-only: no `payload` key anywhere.
    for (const snapshot of snapshots) {
      const hasPayloadKey = Object.hasOwn(snapshot, 'payload')
      expect(hasPayloadKey).toBe(false)

      // Recursively guard nested objects (candidates, enabled, selected, threads).
      const found = JSON.stringify(snapshot, (_k, v) => (typeof v === 'function' ? '<fn>' : v))
      expect(found).not.toContain('<fn>')
    }

    // Sanity: the non-JSON payload never leaked into the selection's detail.
    const selection = snapshots.find((s) => s.kind === 'selection')
    expect(selection).toBeDefined()
    const selected = (selection as Extract<SnapshotMessage, { kind: 'selection' }>).selected
    expect(Object.hasOwn(selected, 'payload')).toBe(false)

    // Sanity: feedback_error fired (proves the handler ran with payload).
    const errors = snapshots.filter((s) => s.kind === 'feedback_error')
    expect(errors).toHaveLength(1)
    const err = errors[0] as Extract<SnapshotMessage, { kind: 'feedback_error' }>
    expect(Object.hasOwn(err, 'payload')).toBe(false)
  })

  test('payload never participates in matching (detail-only)', () => {
    const { addThread, trigger, addHandler } = behavioral()
    const log: string[] = []

    // waiter waits for a task with matching detail; payload differs but must still match
    addThread('waiter', thread([sync({ waitFor: { type: 'task' } }), sync({ request: { type: 'ack' } })], true))
    addHandler('task', () => {
      log.push('task')
    })
    addHandler('ack', () => {
      log.push('ack')
    })

    trigger({ type: 'task', detail: { id: 1 }, payload: new Blob(['a']) })

    expect(log).toEqual(['task', 'ack'])
  })
})
