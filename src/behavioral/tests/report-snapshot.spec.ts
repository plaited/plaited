import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread, type SnapshotMessage } from 'plaited/behavioral'

describe('reportSnapshot', () => {
  test('publishes custom runtime diagnostics through useSnapshot', () => {
    const seen: SnapshotMessage[] = []
    const { reportSnapshot, useSnapshot } = behavioral()

    useSnapshot((msg) => {
      seen.push(msg)
    })

    reportSnapshot({
      kind: 'module_warning',
      moduleId: 'bootstrap#0',
      lane: 'bootstrap',
      code: 'duplicate_module_id',
      warning: 'duplicate module id detected',
    })

    expect(seen).toEqual([
      {
        kind: 'module_warning',
        moduleId: 'bootstrap#0',
        lane: 'bootstrap',
        code: 'duplicate_module_id',
        warning: 'duplicate module id detected',
      },
    ])
  })

  test('does not alter event selection order', () => {
    const events: string[] = []
    const { bThreads, trigger, useFeedback, reportSnapshot } = behavioral()

    bThreads.set({
      producer: bThread([bSync({ request: { type: 'task' } })]),
      consumer: bThread([bSync({ waitFor: 'task' }), bSync({ request: { type: 'ack' } })]),
    })

    useFeedback({
      task() {
        events.push('task')
      },
      ack() {
        events.push('ack')
      },
    })

    reportSnapshot({
      kind: 'module_warning',
      moduleId: 'bootstrap#0',
      warning: 'diagnostic only',
    })
    trigger({ type: 'kickoff' })

    expect(events).toEqual(['task', 'ack'])
  })
})
