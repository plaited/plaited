import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread } from 'plaited/behavioral'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ============================================================================
// Per-task lifecycle: interrupt + dynamic threads + repeat
// Proves the persistent-session agent pattern where tasks come and go
// but the BP program stays alive.
// ============================================================================

describe('per-task lifecycle', () => {
  test('dynamic threads are interrupted by message, then re-added for next task', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    // Session-level thread: persists across tasks
    bThreads.set({
      simulationGuard: bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'execute') return false
              return event.detail?.blocked === true
            },
          }),
        ],
        true,
      ),
    })

    useFeedback({
      task(detail) {
        log.push(`task:${detail.prompt}`)
        // Dynamically add per-task threads — interrupted by 'message'
        bThreads.set({
          maxIterations: bThread([
            bSync({ waitFor: 'tool_result', interrupt: ['message'] }),
            bSync({ waitFor: 'tool_result', interrupt: ['message'] }),
            bSync({
              block: 'execute',
              request: { type: 'message', detail: { content: 'Max reached' } },
              interrupt: ['message'],
            }),
          ]),
        })
      },

      tool_result() {
        log.push('tool_result')
      },

      execute() {
        log.push('execute')
      },

      message(detail) {
        log.push(`message:${detail.content}`)
      },
    })

    // === Task 1 ===
    trigger({ type: 'task', detail: { prompt: 'hello' } })
    expect(log).toEqual(['task:hello'])

    // maxIterations thread is now active
    expect(bThreads.has('maxIterations')).toEqual({ running: false, pending: true })

    trigger({ type: 'tool_result' })
    trigger({ type: 'tool_result' })
    // After 2 tool_results, maxIter requests message
    expect(log).toEqual(['task:hello', 'tool_result', 'tool_result', 'message:Max reached'])

    // maxIterations thread is done (finished its rules + message interrupted it)
    expect(bThreads.has('maxIterations')).toEqual({ running: false, pending: false })

    // === Task 2 ===
    // Same thread name — OK because old one was interrupted/done
    trigger({ type: 'task', detail: { prompt: 'world' } })
    expect(log).toEqual(['task:hello', 'tool_result', 'tool_result', 'message:Max reached', 'task:world'])

    // Fresh maxIterations thread is active again
    expect(bThreads.has('maxIterations')).toEqual({ running: false, pending: true })

    // Session-level thread still alive
    expect(bThreads.has('simulationGuard')).toEqual({ running: false, pending: true })
  })

  test('message interrupts mid-sequence threads (not just at end)', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    useFeedback({
      task() {
        log.push('task')
        bThreads.set({
          maxIterations: bThread([
            bSync({ waitFor: 'tool_result', interrupt: ['message'] }),
            bSync({ waitFor: 'tool_result', interrupt: ['message'] }),
            bSync({ waitFor: 'tool_result', interrupt: ['message'] }),
            bSync({
              block: 'execute',
              request: { type: 'message', detail: { content: 'Max reached' } },
            }),
          ]),
        })
      },

      tool_result() {
        log.push('tool_result')
      },
      message(detail) {
        log.push(`message:${detail.content}`)
      },
    })

    // Start task, count 1 tool_result
    trigger({ type: 'task' })
    trigger({ type: 'tool_result' })
    expect(log).toEqual(['task', 'tool_result'])

    // Thread is mid-sequence (1 of 3 tool_results counted)
    expect(bThreads.has('maxIterations')).toEqual({ running: false, pending: true })

    // Message fires early — interrupts mid-sequence
    trigger({ type: 'message', detail: { content: 'early finish' } })
    expect(log).toEqual(['task', 'tool_result', 'message:early finish'])

    // Thread is gone — interrupted mid-sequence
    expect(bThreads.has('maxIterations')).toEqual({ running: false, pending: false })

    // Can start a new task
    trigger({ type: 'task' })
    expect(bThreads.has('maxIterations')).toEqual({ running: false, pending: true })
  })

  test('repeat function form: thread self-terminates when predicate returns false', () => {
    const log: string[] = []
    let taskActive = true

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      conditionalWorker: bThread([bSync({ waitFor: 'ping' })], () => taskActive),
    })

    useFeedback({
      ping() {
        log.push('ping')
      },
    })

    // Thread is active, responds to pings
    trigger({ type: 'ping' })
    trigger({ type: 'ping' })
    expect(log).toEqual(['ping', 'ping'])
    expect(bThreads.has('conditionalWorker')).toEqual({ running: false, pending: true })

    // Deactivate — next time thread finishes its rules, it checks repeat predicate
    taskActive = false
    trigger({ type: 'ping' })
    expect(log).toEqual(['ping', 'ping', 'ping'])

    // Thread is now gone — repeat() returned false
    expect(bThreads.has('conditionalWorker')).toEqual({ running: false, pending: false })
  })
})

// ============================================================================
// Task gate: blocks task events between tasks (stale async protection)
// ============================================================================

describe('task gate', () => {
  test('blocks task-related events between tasks', () => {
    const log: string[] = []
    const TASK_EVENTS = new Set(['model_response', 'execute', 'tool_result', 'proposed_action'])

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      taskGate: bThread(
        [
          // Phase 1: block task events, wait for 'task' to start
          bSync({
            waitFor: 'task',
            block: (event) => TASK_EVENTS.has(event.type),
          }),
          // Phase 2: allow everything, wait for 'message' to end task
          bSync({
            waitFor: 'message',
          }),
        ],
        true, // loops: after message → back to blocking
      ),
    })

    useFeedback({
      task() {
        log.push('task')
      },
      model_response() {
        log.push('model_response')
      },
      execute() {
        log.push('execute')
      },
      tool_result() {
        log.push('tool_result')
      },
      message() {
        log.push('message')
      },
    })

    // Before any task: task events are blocked
    trigger({ type: 'model_response' })
    trigger({ type: 'execute' })
    expect(log).toEqual([])

    // Start task — unblocks task events
    trigger({ type: 'task' })
    expect(log).toEqual(['task'])

    // During task: events flow freely
    trigger({ type: 'model_response' })
    trigger({ type: 'execute' })
    trigger({ type: 'tool_result' })
    expect(log).toEqual(['task', 'model_response', 'execute', 'tool_result'])

    // End task
    trigger({ type: 'message' })
    expect(log).toEqual(['task', 'model_response', 'execute', 'tool_result', 'message'])

    // Between tasks: task events blocked again
    trigger({ type: 'model_response' })
    trigger({ type: 'execute' })
    expect(log).toEqual(['task', 'model_response', 'execute', 'tool_result', 'message'])

    // Start new task — unblocks again
    trigger({ type: 'task' })
    trigger({ type: 'execute' })
    expect(log).toEqual(['task', 'model_response', 'execute', 'tool_result', 'message', 'task', 'execute'])
  })

  test('stale async triggers after task ends are blocked', async () => {
    const log: string[] = []
    const TASK_EVENTS = new Set(['model_response', 'execute', 'tool_result'])

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      taskGate: bThread(
        [
          bSync({
            waitFor: 'task',
            block: (event) => TASK_EVENTS.has(event.type),
          }),
          bSync({ waitFor: 'message' }),
        ],
        true,
      ),
    })

    useFeedback({
      task() {
        log.push('task')
      },
      message() {
        log.push('message')
      },
      async execute() {
        log.push('execute:start')
        await wait(50) // Simulate slow tool execution
        log.push('execute:done')
        trigger({ type: 'tool_result' })
      },
      tool_result() {
        log.push('tool_result')
      },
    })

    // Start task, trigger execute (starts async work)
    trigger({ type: 'task' })
    trigger({ type: 'execute' })
    expect(log).toEqual(['task', 'execute:start'])

    // End task before execute finishes
    trigger({ type: 'message' })
    expect(log).toEqual(['task', 'execute:start', 'message'])

    // Wait for async execute to finish
    await wait(100)

    // execute:done runs (async handler completes), but tool_result is BLOCKED
    // because taskGate is back at phase 1
    expect(log).toEqual(['task', 'execute:start', 'message', 'execute:done'])
    // tool_result was silently blocked — no corruption of next task's state
  })
})
