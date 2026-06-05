import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { SNAPSHOT_MESSAGE_KINDS } from '../../behavioral/behavioral.constants.ts'
import type {
  DeadlockSnapshot,
  FrontierSnapshot,
  SelectionSnapshot,
  SnapshotMessage,
} from '../../behavioral/behavioral.schemas.ts'
import { behavioral } from '../../behavioral.ts'
import { B_PROGRAM_IDENTIFIER } from '../agent.constants.ts'
import { defineBehavior } from '../define-behavior.ts'

describe('defineBehavior', () => {
  test('returns a function branded with B_PROGRAM_IDENTIFIER', () => {
    const program = defineBehavior(() => {})
    expect(program.$).toBe(B_PROGRAM_IDENTIFIER)
    expect(typeof program).toBe('function')
  })

  test('topic-scoped trigger and sync isolate events between programs', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const programA = defineBehavior(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      at('a', th([sy({ request: { type: 'done_a' } })], true))
      ah('done_a', () => {})
      return
    })

    const programB = defineBehavior(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      at('b', th([sy({ request: { type: 'done_b' } })], true))
      ah('done_b', () => {})
      return
    })

    programA({ trigger, addThread, addHandler, reportSnapshot, topic: 'topic-a' })
    programB({ trigger, addThread, addHandler, reportSnapshot, topic: 'topic-b' })

    trigger({ type: 'start' })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    expect(selected.some((e) => e.type === 'done_a' && e.topic === 'topic-a')).toBe(true)
    expect(selected.some((e) => e.type === 'done_b' && e.topic === 'topic-b')).toBe(true)
  })

  test('topic-scoped events are blocked when same-topic block exists but cross-topic events pass', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const programA = defineBehavior(({ addThread: at, sync: sy, thread: th }) => {
      at('a-blocker', th([sy({ block: { type: 'done_a' } })]))
      at('a-requester', th([sy({ request: { type: 'done_a' } })], true))
    })

    const programB = defineBehavior(({ addThread: at, sync: sy, thread: th }) => {
      at('b-requester', th([sy({ request: { type: 'done_b' } })], true))
    })

    programA({ trigger, addThread, addHandler, reportSnapshot, topic: 'topic-a' })
    programB({ trigger, addThread, addHandler, reportSnapshot, topic: 'topic-b' })

    trigger({ type: 'start' })

    expect(
      snapshots
        .filter((s) => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
        .some((s) => (s as SelectionSnapshot).selected.type === 'done_b'),
    ).toBe(true)

    const deadlocks = snapshots.filter((s): s is DeadlockSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.deadlock)
    expect(deadlocks.length).toBeGreaterThan(0)

    const deadlockFrontier = snapshots.find(
      (s): s is FrontierSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.frontier && s.status === 'deadlock',
    )
    expect(deadlockFrontier).toBeDefined()
    expect(deadlockFrontier!.candidates.some((c) => c.type === 'done_a')).toBe(true)
  })

  test('trigger inside the callback injects topic into detail', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const program = defineBehavior(({ addThread: at, addHandler: ah, trigger: tr, sync: sy, thread: th }) => {
      at('self-trigger', th([sy({ request: { type: 'do_it' } })], true))
      ah('do_it', () => {
        tr({ type: 'nested', detail: { key: 'val' } })
      })
      return
    })

    program({ trigger, addThread, addHandler, reportSnapshot, topic: 'my-topic' })
    trigger({ type: 'start' })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    const nested = selected.find((s) => s.type === 'nested')
    expect(nested).toBeDefined()
    expect(nested!.detail).toEqual({ key: 'val' })
    expect(nested!.topic).toBe('my-topic')
  })

  test('wrapped sync scopes waitFor listeners to the topic', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const program = defineBehavior(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      at(
        'waiter',
        th(
          [
            sy({ waitFor: { type: 'greeting', detailSchema: z.object({ name: z.string() }) } }),
            sy({ request: { type: 'ack' } }),
          ],
          true,
        ),
      )
      ah('ack', () => {})
      return
    })

    program({ trigger, addThread, addHandler, reportSnapshot, topic: 'my-topic' })

    trigger({ type: 'greeting', topic: 'my-topic', detail: { name: 'Alice' } })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    expect(selected.some((e) => e.type === 'ack')).toBe(true)
  })

  test('wrapped sync prevents waitFor from matching wrong-topic events', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const program = defineBehavior(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      at('waiter', th([sy({ waitFor: { type: 'greeting' } }), sy({ request: { type: 'ack' } })], true))
      ah('ack', () => {})
      return
    })

    program({ trigger, addThread, addHandler, reportSnapshot, topic: 'my-topic' })

    trigger({ type: 'greeting', topic: 'other-topic' })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    expect(selected.every((e) => e.type !== 'ack')).toBe(true)
  })

  test('bProgram can return a promise and the factory awaits it', async () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    let asyncWorkDone = false

    const program = defineBehavior(async ({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      await new Promise((r) => setTimeout(r, 5))
      asyncWorkDone = true

      at('async-request', th([sy({ request: { type: 'async_done' } })], true))
      ah('async_done', () => {})
      return
    })

    await program({ trigger, addThread, addHandler, reportSnapshot, topic: 'topic-async' })

    expect(asyncWorkDone).toBe(true)

    trigger({ type: 'start' })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    expect(selected.some((e) => e.type === 'async_done')).toBe(true)
  })

  test('topic-injected events match same-topic block and not cross-topic block', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const programA = defineBehavior(({ addThread: at, sync: sy, thread: th }) => {
      at('a-guard', th([sy({ block: { type: 'danger' } })]))
    })

    const programB = defineBehavior(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      at('b-requester', th([sy({ request: { type: 'danger' } })], true))
      ah('danger', () => {})
      return
    })

    programA({ trigger, addThread, addHandler, reportSnapshot, topic: 'topic-a' })
    programB({ trigger, addThread, addHandler, reportSnapshot, topic: 'topic-b' })

    trigger({ type: 'start' })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    expect(selected.some((e) => e.type === 'danger')).toBe(true)
  })
})
