import { describe, expect, test } from 'bun:test'
import { TRACE_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { FeedbackError, Trace } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

/**
 * Test suite for the FeedbackError trace message.
 * When a addHandler handler throws during side-effect execution,
 * the error surfaces through useTrace as a { kind: TRACE_MESSAGE_KINDS.feedback_error } message.
 */
describe(TRACE_MESSAGE_KINDS.feedback_error, () => {
  test('publishes feedback-error when handler throws synchronously', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useTrace((trace: Trace) => {
      traces.push(trace)
    })
    addThread({ label: 'requestAction', rules: [{ request: { type: 'doWork' } }], once: true })
    addHandler('doWork', () => {
      throw new Error('handler failed')
    })
    trigger({ type: 'start' })

    const errors = traces.filter((s) => s.kind === TRACE_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(1)

    const error = errors[0]!
    expect(error).toMatchObject({
      kind: TRACE_MESSAGE_KINDS.feedback_error,
      type: 'doWork',
      detail: undefined,
      error: 'handler failed',
    })
  })

  test('publishes feedback-error with event detail', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useTrace((trace: Trace) => {
      traces.push(trace)
    })
    addThread({ label: 'requestAction', rules: [{ request: { type: 'process', detail: { id: 42 } } }], once: true })
    addHandler('process', () => {
      throw new TypeError('invalid input')
    })
    trigger({ type: 'start' })

    const errors = traces.filter((s) => s.kind === TRACE_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(1)

    const error = errors[0]!
    expect(error).toMatchObject({
      kind: TRACE_MESSAGE_KINDS.feedback_error,
      type: 'process',
      detail: { id: 42 },
      error: 'invalid input',
    })
  })

  test('stringifies non-Error thrown values', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useTrace((trace: Trace) => {
      traces.push(trace)
    })
    addThread({ label: 'requestAction', rules: [{ request: { type: 'fail' } }], once: true })
    addHandler('fail', () => {
      throw 'string error'
    })
    trigger({ type: 'start' })

    const errors = traces.filter((s): s is FeedbackError => s.kind === TRACE_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.error).toBe('string error')
  })

  test('frontier and selection traces precede feedback-error in message order', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useTrace((trace: Trace) => {
      traces.push(trace)
    })
    addThread({ label: 'requestAction', rules: [{ request: { type: 'boom' } }], once: true })
    addHandler('boom', () => {
      throw new Error('exploded')
    })
    trigger({ type: 'start' })

    expect(traces.length).toBeGreaterThanOrEqual(2)

    const frontierIndex = traces.findIndex((s) => s.kind === TRACE_MESSAGE_KINDS.frontier)
    const selectionIndex = traces.findIndex((s) => s.kind === TRACE_MESSAGE_KINDS.selection)
    const errorIndex = traces.findIndex((s) => s.kind === TRACE_MESSAGE_KINDS.feedback_error)
    expect(frontierIndex).not.toBe(-1)
    expect(selectionIndex).not.toBe(-1)
    expect(errorIndex).not.toBe(-1)
    expect(frontierIndex).toBeLessThan(selectionIndex)
    expect(selectionIndex).toBeLessThan(errorIndex)
  })

  test('no feedback-error when handler succeeds', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useTrace((trace: Trace) => {
      traces.push(trace)
    })
    addThread({ label: 'requestAction', rules: [{ request: { type: 'ok' } }], once: true })
    addHandler('ok', () => {})
    trigger({ type: 'start' })

    const errors = traces.filter((s) => s.kind === TRACE_MESSAGE_KINDS.feedback_error)
    expect(errors).toHaveLength(0)
    expect(traces.some((s) => s.kind === TRACE_MESSAGE_KINDS.frontier)).toBe(true)
    expect(traces.some((s) => s.kind === TRACE_MESSAGE_KINDS.selection)).toBe(true)
  })
})
