import { describe, expect, test } from 'bun:test'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral, onType, sync, thread } from './helpers.ts'

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
    const { addBThread, trigger, useFeedback, reportSnapshot } = behavioral()

    addBThread('producer', thread([sync({ request: { type: 'task' } })]))
    addBThread('consumer', thread([sync({ waitFor: onType('task') }), sync({ request: { type: 'ack' } })]))

    useFeedback({
      task() {
        events.push('task')
      },
      ack() {
        events.push('ack')
      },
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
