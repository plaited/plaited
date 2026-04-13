import { describe, expect, test } from 'bun:test'
import { behavioral, type SnapshotMessage } from 'plaited/behavioral'
import { bSync, bThread } from '../behavioral.utils.ts'
import { onType } from './helpers.ts'

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
    const { addBThreads, trigger, useFeedback, reportSnapshot } = behavioral()

    addBThreads({
      producer: bThread([bSync({ request: { type: 'task' } })]),
      consumer: bThread([bSync({ waitFor: onType('task') }), bSync({ request: { type: 'ack' } })]),
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
