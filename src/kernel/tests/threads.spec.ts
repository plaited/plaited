import { describe, expect, test } from 'bun:test'
import { TRACE_MESSAGE_KINDS } from '../../behavioral/behavioral.constants.ts'
import type { Thread, Trace } from '../../behavioral/behavioral.types.ts'
import { frontierReplay, frontierVerify } from '../../tools/frontier.ts'
import { createScriptedModelTools } from '../../tools/model.ts'
import type { DispatchableTool } from '../dispatch.ts'
import { createKernel } from '../kernel.ts'

const tool = (name: string, fn: (input: unknown) => Promise<unknown>): DispatchableTool =>
  Object.defineProperty(fn, 'name', { value: name, configurable: true }) as DispatchableTool

const echoTool = tool('echo', async (input) => ({ echoed: input }))

const assistantMessage = (text: string) => ({
  id: `msg_${text}`,
  type: 'message' as const,
  status: 'completed' as const,
  role: 'assistant' as const,
  content: [{ type: 'output_text' as const, text }],
})

// A simple candidate thread that requests an event and completes.
const candidateThread: Thread = {
  label: 'candidate',
  once: true,
  rules: [{ request: { type: 'greeting', detail: { hello: 'world' } } }],
}

describe('runThreads — register + run arbitrary threads, capture trace', () => {
  test('registers an arbitrary thread and returns a captured trace + frontier', async () => {
    const kernel = createKernel()
    try {
      const { trace, frontier } = await kernel.runThreads({
        space: 's1',
        threads: [candidateThread],
      })
      // The trace is non-empty — the engine ran at least one super-step.
      expect(trace.length).toBeGreaterThan(0)
      // The candidate's 'greeting' event was selected during the run.
      const selectionTypes = trace
        .filter((t) => t.kind === TRACE_MESSAGE_KINDS.selection)
        .map((t) => (t as { selected: { type: string } }).selected.type)
      expect(selectionTypes).toContain('greeting')
      // The candidate thread (once: true, single request) completes after its
      // event is selected, so the final frontier is idle.
      expect(frontier).not.toBeNull()
      expect(frontier!.status).toBe('idle')
      expect(frontier!.enabled).toHaveLength(0)
    } finally {
      await kernel.shutdown()
    }
  })

  test('trace contains selection/frontier/deadlock trace kinds for a known program', async () => {
    const kernel = createKernel()
    try {
      const { trace } = await kernel.runThreads({
        space: 's2',
        threads: [
          { label: 'req', rules: [{ request: { type: 'a' } }] },
          { label: 'blk', rules: [{ block: [{ type: 'a' }] }] },
        ],
      })
      const kinds = trace.map((t) => t.kind)
      // Deadlock traces appear when all candidates are blocked.
      expect(kinds).toContain(TRACE_MESSAGE_KINDS.deadlock)
      // Frontier traces appear at each super-step.
      expect(kinds).toContain(TRACE_MESSAGE_KINDS.frontier)
    } finally {
      await kernel.shutdown()
    }
  })

  test('an idle program returns an idle frontier', async () => {
    const kernel = createKernel()
    try {
      const { frontier } = await kernel.runThreads({
        space: 's3',
        threads: [{ label: 'idle', once: true, rules: [{ waitFor: [{ type: 'never' }] }] }],
      })
      expect(frontier!.status).toBe('idle')
      expect(frontier!.enabled).toHaveLength(0)
    } finally {
      await kernel.shutdown()
    }
  })
})

describe('runTurn with candidate threads — co-registration + trace capture', () => {
  test('co-registers the turn loop + a candidate thread and returns the trace', async () => {
    const kernel = createKernel({
      modelTools: createScriptedModelTools({
        script: [{ items: [assistantMessage('done')], status: 'completed' }],
      }),
      dispatchTools: { echo: echoTool },
    })
    try {
      const result = await kernel.runTurn({
        space: 'turn1',
        prompt: 'hello',
        threads: [candidateThread],
      })
      expect(result.ok).toBe(true)
      expect(result.status).toBe('completed')
      // The trace is captured and non-empty.
      expect(result.trace.length).toBeGreaterThan(0)
      // The trace contains at least one selection trace (the engine selected events).
      const kinds = result.trace.map((t) => t.kind)
      expect(kinds).toContain(TRACE_MESSAGE_KINDS.selection)
    } finally {
      await kernel.shutdown()
    }
  })

  test('runTurn with no candidate threads still works (backward compat)', async () => {
    const kernel = createKernel()
    try {
      const result = await kernel.runTurn({ space: 'compat', prompt: 'hello' })
      expect(result.ok).toBe(true)
      expect(result.status).toBe('completed')
    } finally {
      await kernel.shutdown()
    }
  })

  test('the trace contains selection/frontier events for a known turn', async () => {
    const kernel = createKernel()
    try {
      const result = await kernel.runTurn({ space: 'trace1', prompt: 'hello' })
      const kinds = result.trace.map((t) => t.kind)
      // The turn loop selects at least: user.prompt, model.respond, model.result, etc.
      expect(kinds).toContain(TRACE_MESSAGE_KINDS.selection)
      expect(kinds).toContain(TRACE_MESSAGE_KINDS.frontier)
    } finally {
      await kernel.shutdown()
    }
  })
})

describe('gate integration — frontierVerify on a captured trace thread set', () => {
  test('a candidate thread passed to frontierVerify yields the expected verdict', async () => {
    const kernel = createKernel()
    try {
      // Run the candidate thread to get its trace.
      const { trace } = await kernel.runThreads({
        space: 'gate1',
        threads: [candidateThread],
      })
      // The candidate thread is verified: it requests one event, then completes.
      // No deadlocks; small state space.
      const verifyResult = await frontierVerify({
        threads: [candidateThread],
        maxDepth: 5,
      })
      expect(verifyResult.status).toBe('verified')
      expect(verifyResult.findings).toHaveLength(0)

      // Replay the captured selection traces against the same thread set.
      // Filter out the harness `threads.registered` event — it is not part of
      // the candidate thread's program, so replay only the candidate's own
      // selections. After replaying, the candidate has completed → idle frontier.
      const selectionTraces = trace.filter(
        (t): t is Extract<Trace, { kind: 'selection' }> =>
          t.kind === TRACE_MESSAGE_KINDS.selection &&
          (t as { selected: { type: string } }).selected.type !== 'threads.registered',
      )
      const replayResult = await frontierReplay({
        threads: [candidateThread],
        messages: selectionTraces,
        space: 'gate1',
      })
      expect(replayResult.isError).toBeFalsy()
      expect(replayResult.frontier).not.toBeNull()
      expect(replayResult.frontier!.status).toBe('idle')
    } finally {
      await kernel.shutdown()
    }
  })
})
