import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { B_PROGRAM_IDENTIFIER, SNAPSHOT_MESSAGE_KINDS } from '../../behavioral/behavioral.constants.ts'
import type {
  DeadlockSnapshot,
  FrontierSnapshot,
  SelectionSnapshot,
  SnapshotMessage,
} from '../../behavioral/behavioral.schemas.ts'
import { behavioral } from '../../behavioral.ts'
import { definePage } from '../define-page.ts'

const INIT = { workflow: 'test', cwd: '/tmp' } as const

describe('definePage', () => {
  test('returns a function branded with B_PROGRAM_IDENTIFIER', () => {
    const program = definePage(() => {})
    expect(program.$).toBe(B_PROGRAM_IDENTIFIER)
    expect(typeof program).toBe('function')
  })

  test('page-scoped trigger and sync isolate events between programs', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const programA = definePage(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      at('a', th([sy({ request: { type: 'done_a' } })], true))
      ah('done_a', () => {})
      return
    })

    const programB = definePage(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      at('b', th([sy({ request: { type: 'done_b' } })], true))
      ah('done_b', () => {})
      return
    })

    programA({ trigger, addThread, addHandler, reportSnapshot, page: 'page-a', ...INIT })
    programB({ trigger, addThread, addHandler, reportSnapshot, page: 'page-b', ...INIT })

    trigger({ type: 'start' })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    expect(selected.some((e) => e.type === 'done_a' && e.page === 'page-a')).toBe(true)
    expect(selected.some((e) => e.type === 'done_b' && e.page === 'page-b')).toBe(true)
  })

  test('page-scoped events are blocked when same-page block exists but cross-page events pass', () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const programA = definePage(({ addThread: at, sync: sy, thread: th }) => {
      at('a-blocker', th([sy({ block: { type: 'done_a' } })]))
      at('a-requester', th([sy({ request: { type: 'done_a' } })], true))
    })

    const programB = definePage(({ addThread: at, sync: sy, thread: th }) => {
      at('b-requester', th([sy({ request: { type: 'done_b' } })], true))
    })

    programA({ trigger, addThread, addHandler, reportSnapshot, page: 'page-a', ...INIT })
    programB({ trigger, addThread, addHandler, reportSnapshot, page: 'page-b', ...INIT })

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

  test('trigger inside the callback injects page into detail', async () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const program = definePage(({ addThread: at, addHandler: ah, trigger: tr, sync: sy, thread: th }) => {
      at('self-trigger', th([sy({ request: { type: 'do_it' } })], true))
      ah('do_it', () => {
        tr({ type: 'nested', detail: { key: 'val' } })
      })
      return
    })

    await program({ trigger, addThread, addHandler, reportSnapshot, page: 'my-page', ...INIT })
    trigger({ type: 'start' })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    const nested = selected.find((s) => s.type === 'nested')
    expect(nested).toBeDefined()
    expect(nested!.detail).toEqual({ key: 'val', _correlationId: expect.any(String) })
    expect(nested!.page).toBe('my-page')
  })

  test('wrapped sync scopes waitFor listeners to the page', async () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const program = definePage(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
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

    await program({ trigger, addThread, addHandler, reportSnapshot, page: 'my-page', ...INIT })

    trigger({ type: 'greeting', page: 'my-page', detail: { name: 'Alice' } })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    expect(selected.some((e) => e.type === 'ack')).toBe(true)
  })

  test('wrapped sync prevents waitFor from matching wrong-page events', async () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const program = definePage(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      at('waiter', th([sy({ waitFor: { type: 'greeting' } }), sy({ request: { type: 'ack' } })], true))
      ah('ack', () => {})
      return
    })

    await program({ trigger, addThread, addHandler, reportSnapshot, page: 'my-page', ...INIT })

    trigger({ type: 'greeting', page: 'other-page' })

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

    const program = definePage(async ({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      await new Promise((r) => setTimeout(r, 5))
      asyncWorkDone = true

      at('async-request', th([sy({ request: { type: 'async_done' } })], true))
      ah('async_done', () => {})
      return
    })

    await program({ trigger, addThread, addHandler, reportSnapshot, page: 'page-async', ...INIT })

    expect(asyncWorkDone).toBe(true)

    trigger({ type: 'start' })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    expect(selected.some((e) => e.type === 'async_done')).toBe(true)
  })

  test('page-injected events match same-page block and not cross-page block', async () => {
    const snapshots: SnapshotMessage[] = []
    const { addThread, trigger, addHandler, useSnapshot, reportSnapshot } = behavioral()
    useSnapshot((msg) => {
      snapshots.push(msg)
    })

    const programA = definePage(({ addThread: at, sync: sy, thread: th }) => {
      at('a-guard', th([sy({ block: { type: 'danger' } })]))
    })

    const programB = definePage(({ addThread: at, addHandler: ah, sync: sy, thread: th }) => {
      at('b-requester', th([sy({ request: { type: 'danger' } })], true))
      ah('danger', () => {})
      return
    })

    await programA({ trigger, addThread, addHandler, reportSnapshot, page: 'page-a', ...INIT })
    await programB({ trigger, addThread, addHandler, reportSnapshot, page: 'page-b', ...INIT })

    trigger({ type: 'start' })

    const selected = snapshots
      .filter((s): s is SelectionSnapshot => s.kind === SNAPSHOT_MESSAGE_KINDS.selection)
      .map((s) => s.selected)

    expect(selected.some((e) => e.type === 'danger')).toBe(true)
  })
})

describe('definePage Promise bridge', () => {
  test('trigger returns a promise that resolves when a handler calls resolve', async () => {
    const { addThread, trigger, addHandler, reportSnapshot } = behavioral()

    const program = definePage(async ({ addHandler: ah, trigger: tr, resolve }) => {
      ah<{ _correlationId: string }>('compute', (detail) => {
        resolve(detail._correlationId, { answer: 42 })
      })
      const result = await tr<{ answer: number }>({ type: 'compute' })
      expect(result).toEqual({ answer: 42 })
    })

    await program({ trigger, addThread, addHandler, reportSnapshot, page: 'api', ...INIT })
  })

  test('a unique correlation id is injected into detail._correlationId per trigger', async () => {
    const { addThread, trigger, addHandler, reportSnapshot } = behavioral()
    const ids: string[] = []

    const program = definePage(async ({ addHandler: ah, trigger: tr, resolve }) => {
      ah<{ _correlationId: string }>('echo', (detail) => {
        ids.push(detail._correlationId)
        resolve(detail._correlationId, undefined)
      })
      await tr({ type: 'echo' })
      await tr({ type: 'echo' })
    })

    await program({ trigger, addThread, addHandler, reportSnapshot, page: 'api', ...INIT })

    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
  })
})

describe('definePage.extractThreads', () => {
  test('returns every thread registered via addThread, in registration order', async () => {
    const program = definePage(({ addThread: at, sync: sy, thread: th }) => {
      at('first', th([sy({ request: { type: 'a' } })], true))
      at('second', th([sy({ request: { type: 'b' } })], true))
      at('third', th([sy({ request: { type: 'c' } })], true))
      return
    })

    const threads = await program.extractThreads()

    expect(threads.map(([label]) => label)).toEqual(['first', 'second', 'third'])
    // each entry is a callable thread generator
    for (const [, threadFn] of threads) {
      expect(typeof threadFn).toBe('function')
      const gen = threadFn()
      expect(gen.next().done).toBe(false)
    }
  })

  test('does not hang when the bProgram awaits trigger during setup', async () => {
    const program = definePage(async ({ addThread: at, sync: sy, thread: th, trigger: tr }) => {
      // bProgram awaits trigger during setup; the dummy promise must resolve
      await tr({ type: 'setup-query' })
      at('after-query', th([sy({ request: { type: 'ready' } })], true))
      return
    })

    const threads = await program.extractThreads()
    expect(threads.map(([label]) => label)).toEqual(['after-query'])
  })
})
