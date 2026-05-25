import { describe, expect, test } from 'bun:test'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'
import { sync, thread } from '../behavioral.utils.ts'

const onType = (type: string) => ({ type })

describe('reportSnapshot', () => {
  test('publishes custom runtime diagnostics through useSnapshot', () => {
    const seen: SnapshotMessage[] = []
    const { reportSnapshot, useSnapshot } = behavioral()

    useSnapshot((msg) => {
      seen.push(msg)
    })

    reportSnapshot({
      kind: 'feedback_error',
      type: 'bootstrap',
      detail: { id: 'bootstrap#0' },
      error: 'duplicate module id detected',
    })

    expect(seen).toEqual([
      {
        kind: 'feedback_error',
        type: 'bootstrap',
        detail: { id: 'bootstrap#0' },
        error: 'duplicate module id detected',
      },
    ])
  })

  test('does not alter event selection order', () => {
    const events: string[] = []
    const { addThread, trigger, addHandler, reportSnapshot } = behavioral()

    addThread('producer', thread([sync({ request: { type: 'task' } })], true))
    addThread('consumer', thread([sync({ waitFor: onType('task') }), sync({ request: { type: 'ack' } })], true))

    addHandler('task', () => {
      events.push('task')
    })
    addHandler('ack', () => {
      events.push('ack')
    })

    reportSnapshot({
      kind: 'feedback_error',
      type: 'bootstrap',
      detail: { id: 'bootstrap#0' },
      error: 'diagnostic only',
    })
    trigger({ type: 'kickoff' })

    expect(events).toEqual(['task', 'ack'])
  })
})
