import { describe, expect, test } from 'bun:test'
import { behavioral, type SnapshotMessage } from 'plaited/behavioral'
import { bSync, bThread } from '../behavioral.shared.ts'
import { onType } from './helpers.ts'

describe('reportSnapshot', () => {
  test('publishes custom runtime diagnostics through useSnapshot', () => {
    const seen: SnapshotMessage[] = []
    const { reportSnapshot, useSnapshot } = behavioral()

    useSnapshot((msg) => {
      seen.push(msg)
    })

    reportSnapshot({
      kind: 'extension_error',
      id: 'bootstrap#0',
      error: 'duplicate module id detected',
    })

    expect(seen).toEqual([
      {
        kind: 'extension_error',
        id: 'bootstrap#0',
        error: 'duplicate module id detected',
      },
    ])
  })

  test('does not alter event selection order', () => {
    const events: string[] = []
    const { addBThread, trigger, useFeedback, reportSnapshot } = behavioral()

    addBThread('producer', bThread([bSync({ request: { type: 'task' } })]))
    addBThread('consumer', bThread([bSync({ waitFor: onType('task') }), bSync({ request: { type: 'ack' } })]))

    useFeedback({
      task() {
        events.push('task')
      },
      ack() {
        events.push('ack')
      },
    })

    reportSnapshot({
      kind: 'extension_error',
      id: 'bootstrap#0',
      error: 'diagnostic only',
    })
    trigger({ type: 'kickoff' })

    expect(events).toEqual(['task', 'ack'])
  })
})
