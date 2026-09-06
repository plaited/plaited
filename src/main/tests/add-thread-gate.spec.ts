import { describe, expect, test } from 'bun:test'
import { TRACE_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { AddThreadError, FrontierTrace, SelectionTrace, Trace } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

const onType = (type: string) => ({ type })

/**
 * Shape of the enriched verdict payload the frontier gate attaches to each
 * `add_thread_error` entry when `verifyFrontiers` rejects a thread:
 * `{ code, findings, livelocks, report }`. `error` is `unknown[]` on the trace
 * type, so this local type narrows the single verdict entry the test asserts on.
 */
type VerdictError = {
  code: string
  findings: unknown[]
  livelocks: unknown[]
  report: { truncated: boolean }
}

describe('useAddThread frontier gate', () => {
  test('rejects a self-deadlocking thread and emits the verdict payload', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrace } = behavioral()
    const addThread = useAddThread()

    useTrace((trace) => {
      traces.push(trace)
    })

    // A single thread that requests 'a' and blocks 'a' at the same sync point
    // deadlocks when explored alone — 'a' is a candidate but is always blocked,
    // with no other thread to resolve it (the request+block-same-type combo from
    // thread-validation.spec.ts).
    addThread({ label: 'self-deadlock', rules: [{ request: { type: 'a' }, block: [onType('a')] }] })

    const errors = traces.filter((s): s is AddThreadError => s.kind === TRACE_MESSAGE_KINDS.add_thread_error)
    expect(errors).toHaveLength(1)

    const error = errors[0]!.error
    expect(error).toHaveLength(1)

    const verdict = error[0] as VerdictError
    expect(verdict.code).toBe('failed')
    expect(Array.isArray(verdict.findings)).toBe(true)
    expect(verdict.findings.length).toBeGreaterThan(0)
    expect(verdict.report.truncated).toBe(false)
  })

  test('admits a verified thread (negative control)', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    useTrace((trace) => {
      traces.push(trace)
    })

    // A clean one-shot request/wait: requests 'a', waits for 'b'. With `once: true`
    // it runs once and completes, so the looping request does not self-cycle into a
    // livelock under the gate's `progress: [label]` check (verified, not rejected).
    addThread({ label: 'clean', rules: [{ request: { type: 'a' }, waitFor: [onType('b')] }], once: true })

    const errors = traces.filter((s): s is AddThreadError => s.kind === TRACE_MESSAGE_KINDS.add_thread_error)
    expect(errors).toHaveLength(0)

    // Confirm the thread actually registered: trigger its requested event and
    // observe a selection/frontier (pattern from deadlock.spec.ts:22). This proves
    // the gate is not spuriously rejecting verified threads.
    trigger({ type: 'a' })

    const frontiers = traces.filter((s): s is FrontierTrace => s.kind === TRACE_MESSAGE_KINDS.frontier)
    const selections = traces.filter((s): s is SelectionTrace => s.kind === TRACE_MESSAGE_KINDS.selection)
    expect(frontiers.length).toBeGreaterThan(0)
    expect(selections.length).toBeGreaterThan(0)
    expect(selections.some((s) => s.selected.type === 'a')).toBe(true)
  })

  test('rejected thread does not register — running.add is skipped', () => {
    const traces: Trace[] = []
    const log: string[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    useTrace((trace) => {
      traces.push(trace)
      // A registered self-deadlock thread would block the trigger's 'a' and emit a
      // deadlock trace; recording deadlocks makes `log` the "triggered effects"
      // probe that mirrors match-listener.spec.ts:747.
      if (trace.kind === TRACE_MESSAGE_KINDS.deadlock) log.push('deadlock')
    })

    addThread({ label: 'self-deadlock', rules: [{ request: { type: 'a' }, block: [onType('a')] }] })

    const errors = traces.filter((s): s is AddThreadError => s.kind === TRACE_MESSAGE_KINDS.add_thread_error)
    expect(errors).toHaveLength(1)

    // Trigger the event the rejected thread would have requested.
    trigger({ type: 'a' })

    // running.add was skipped: the rejected thread's own (non-ingress) request for
    // 'a' never appears as a frontier candidate — only the trigger's ingress 'a'
    // does. The thread never entered the scheduler.
    const threadA = traces
      .filter((s): s is FrontierTrace => s.kind === TRACE_MESSAGE_KINDS.frontier)
      .flatMap((f) => f.candidates)
      .filter((c) => c.type === 'a' && c.ingress !== true)
    expect(threadA).toHaveLength(0)

    // The rejected thread produced no effects: its block on 'a' is absent, so
    // triggering 'a' selects cleanly instead of deadlocking (the "trigger does
    // nothing" assertion from match-listener.spec.ts:747).
    expect(log).toEqual([])
  })

  test('rejects a truncating thread (proof incomplete) and emits the truncated verdict', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    useTrace((trace) => {
      traces.push(trace)
    })

    // An acyclic-but-deep chain: 15 linear sync points, each requesting a unique
    // event and waiting for it, run once. The chain never revisits a state, so
    // findLivelocks sees no cycle (no livelock) — but the state space is deeper
    // than the gate's maxDepth: 10 budget, so exploration truncates before
    // reaching the terminal state. The gate passes progress: [label], yet
    // truncation survives because the chain is acyclic, not a non-progressing
    // cycle. This is the defense-in-depth branch: !== 'verified' catches a
    // proof-incomplete thread even when no deadlock or livelock is found.
    const chain = Array.from({ length: 15 }, (_, i) => ({
      request: { type: `s${i}` },
      waitFor: [onType(`s${i}`)],
    }))
    addThread({ label: 'chain', rules: chain, once: true })

    const errors = traces.filter((s): s is AddThreadError => s.kind === TRACE_MESSAGE_KINDS.add_thread_error)
    expect(errors).toHaveLength(1)

    const error = errors[0]!.error
    expect(error).toHaveLength(1)

    const verdict = error[0] as VerdictError
    expect(verdict.code).toBe('truncated')
    expect(Array.isArray(verdict.findings)).toBe(true)
    expect(Array.isArray(verdict.livelocks)).toBe(true)
    expect(verdict.report.truncated).toBe(true)

    // running.add was skipped: trigger the event the thread would have requested
    // first ('s0') and confirm its own (non-ingress) request never appears as a
    // frontier candidate — same non-ingress probe as case 3.
    trigger({ type: 's0' })
    const threadS0 = traces
      .filter((s): s is FrontierTrace => s.kind === TRACE_MESSAGE_KINDS.frontier)
      .flatMap((f) => f.candidates)
      .filter((c) => c.type === 's0' && c.ingress !== true)
    expect(threadS0).toHaveLength(0)
  })
})
