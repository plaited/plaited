import { describe, expect, test } from 'bun:test'
import { TRACE_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { DeadlockTrace, FrontierTrace, SelectionTrace, Trace } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

const onType = (type: string) => ({ type })

describe('addThread', () => {
  test('supports dynamic thread installation from feedback handlers', () => {
    const actual: string[] = []
    const { useAddThread, useTrigger, useAddHandler } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()

    addThread({ label: 'addHotOnce', rules: [{ request: { type: 'hot_1' } }], once: true })
    addThread({
      label: 'mixHotCold',
      rules: [
        {
          waitFor: [onType('hot_1'), onType('hot')],
          block: [onType('cold')],
        },
        {
          waitFor: [onType('cold')],
          block: [onType('hot_1'), onType('hot')],
        },
      ],
    })

    addHandler('hot_1', () => {
      actual.push('hot')
      trigger({ type: 'cold' })
      addThread({
        label: 'addMoreHot',
        rules: [{ request: { type: 'hot' } }, { request: { type: 'hot' } }],
        once: true,
      })
      addThread({
        label: 'addMoreCold',
        rules: [{ request: { type: 'cold' } }, { request: { type: 'cold' } }],
        once: true,
      })
    })
    addHandler('cold', () => {
      actual.push('cold')
    })
    addHandler('hot', () => {
      actual.push('hot')
    })

    trigger({ type: 'start' })

    expect(actual).toHaveLength(6)
    expect(actual.filter((event) => event === 'hot')).toHaveLength(3)
    expect(actual.filter((event) => event === 'cold')).toHaveLength(3)
  })

  test('frontier and selection traces include worker requests and selected events', () => {
    const traces: Trace[] = []
    const completions: string[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()

    useTrace((trace: Trace) => {
      traces.push(trace)
    })

    addThread({
      label: 'workerA',
      rules: [{ waitFor: [onType('start')] }, { request: { type: 'done_a' } }],
      once: true,
    })
    addThread({
      label: 'workerB',
      rules: [{ waitFor: [onType('start')] }, { request: { type: 'done_b' } }],
      once: true,
    })

    addHandler('done_a', () => {
      completions.push('done')
    })
    addHandler('done_b', () => {
      completions.push('done')
    })

    trigger({ type: 'start' })

    expect(completions).toHaveLength(2)
    const frontierTraces = traces.filter(
      (trace): trace is FrontierTrace => trace.kind === TRACE_MESSAGE_KINDS.frontier && trace.status === 'ready',
    )
    const doneCandidates = frontierTraces
      .flatMap((trace) => trace.candidates)
      .filter((candidate) => candidate.type === 'done_a' || candidate.type === 'done_b')
    expect(new Set(doneCandidates.map((candidate) => candidate.type))).toEqual(new Set(['done_a', 'done_b']))
    expect(doneCandidates.every((candidate) => candidate.ingress === undefined)).toBe(true)

    const selectionTraces = traces.filter(
      (trace): trace is SelectionTrace => trace.kind === TRACE_MESSAGE_KINDS.selection,
    )
    expect(selectionTraces.some((trace) => trace.selected.type === 'done_a')).toBe(true)
    expect(selectionTraces.some((trace) => trace.selected.type === 'done_b')).toBe(true)
  })

  test('deadlock traces publish frontier status and step continuity', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    useTrace((trace: Trace) => {
      traces.push(trace)
    })

    addThread({ label: 'guard', rules: [{ block: [onType('dangerous')] }] })
    addThread({ label: 'watchdog', rules: [{ interrupt: [onType('dangerous')] }] })
    addThread({ label: 'requester', rules: [{ request: { type: 'dangerous' } }], once: true })

    trigger({ type: 'start' })

    const deadlockFrontier = traces.find(
      (trace): trace is FrontierTrace => trace.kind === TRACE_MESSAGE_KINDS.frontier && trace.status === 'deadlock',
    )
    expect(deadlockFrontier).toBeDefined()
    expect(deadlockFrontier!.candidates.some((candidate) => candidate.type === 'dangerous')).toBe(true)
    expect(deadlockFrontier!.enabled).toEqual([])

    const deadlockSnapshot = traces.find((trace): trace is DeadlockTrace => trace.kind === TRACE_MESSAGE_KINDS.deadlock)
    expect(deadlockSnapshot).toBeDefined()
    expect(deadlockSnapshot!.step).toBe(deadlockFrontier!.step)
  })
})

describe('agent thread contract — JSON-only rules', () => {
  test('a thread with a generator function in rules is rejected (add_thread_error)', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrace } = behavioral()
    const addThread = useAddThread()

    useTrace((trace: Trace) => {
      traces.push(trace)
    })

    // A closure-bearing rule (generator function) is NOT JSON — ThreadScehama.safeParse rejects it.
    addThread({
      label: 'bad-closure',
      rules: [
        function* () {
          yield { request: { type: 'evil' } }
        },
      ] as unknown as import('../behavioral.schemas.ts').Thread['rules'],
    })

    const errors = traces.filter((t) => t.kind === TRACE_MESSAGE_KINDS.add_thread_error)
    expect(errors).toHaveLength(1)
  })

  test('a thread with valid JSON rules is accepted (no add_thread_error)', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    const received: string[] = []

    useTrace((trace: Trace) => {
      traces.push(trace)
    })

    addThread({ label: 'good', rules: [{ waitFor: [onType('ping')] }, { request: { type: 'pong' } }] })
    addHandler('pong', () => {
      received.push('pong')
    })

    trigger({ type: 'ping' })

    const errors = traces.filter((t) => t.kind === TRACE_MESSAGE_KINDS.add_thread_error)
    expect(errors).toHaveLength(0)
    expect(received).toEqual(['pong'])
  })
})
