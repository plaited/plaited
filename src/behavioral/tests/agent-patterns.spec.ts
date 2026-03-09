import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread } from 'plaited'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ============================================================================
// Exploration tests validating BP patterns for agent.ts refactor.
// Each test proves a specific mechanism works before using it in agent.ts.
// ============================================================================

// ============================================================================
// Pattern 1: doneGuard (stopGame pattern)
// waitFor terminal event → block everything. Replaces `if (done) return`.
// ============================================================================

describe('doneGuard pattern', () => {
  test('blocks all events after terminal event fires', () => {
    // NOTE: In the agent, events come from trigger() calls in async handlers,
    // NOT from continuously-requesting bThreads. A repeat=true thread that
    // only requests would create an infinite synchronous super-step (stack overflow).
    // This test models the agent's actual pattern: external triggers + doneGuard.
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      // doneGuard: after 'done' fires, block EVERYTHING
      doneGuard: bThread([bSync({ waitFor: 'done' }), bSync({ block: () => true })], true),
    })

    useFeedback({
      work() {
        log.push('work')
      },
      done() {
        log.push('done')
      },
    })

    // Before 'done', trigger events normally — they pass through
    trigger({ type: 'work' })
    trigger({ type: 'work' })
    expect(log).toEqual(['work', 'work'])

    // Now trigger 'done' — doneGuard should activate its block
    trigger({ type: 'done' })
    expect(log).toEqual(['work', 'work', 'done'])

    // After 'done', doneGuard blocks everything — trigger() calls are harmless
    trigger({ type: 'work' })
    trigger({ type: 'anything' })
    expect(log).toEqual(['work', 'work', 'done'])
  })

  test('doneGuard does not interfere before terminal event', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      // Request three sequential events
      sequence: bThread([
        bSync({ request: { type: 'A' } }),
        bSync({ request: { type: 'B' } }),
        bSync({ request: { type: 'C' } }),
      ]),

      doneGuard: bThread([bSync({ waitFor: 'terminal' }), bSync({ block: () => true })], true),
    })

    useFeedback({
      A() {
        log.push('A')
      },
      B() {
        log.push('B')
      },
      C() {
        log.push('C')
      },
    })

    trigger({ type: 'start' })

    // All three events should fire — doneGuard is dormant at waitFor
    expect(log).toEqual(['A', 'B', 'C'])
  })

  test('doneGuard blocks triggered events too (priority 0)', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    // State to track if done has been signaled
    let isDone = false

    bThreads.set({
      doneGuard: bThread([bSync({ waitFor: 'terminal' }), bSync({ block: () => true })], true),
    })

    useFeedback({
      terminal() {
        isDone = true
        log.push('terminal')
      },
      other() {
        log.push('other')
      },
    })

    trigger({ type: 'terminal' })
    expect(log).toEqual(['terminal'])
    expect(isDone).toBe(true)

    // After terminal, even external triggers should be blocked
    trigger({ type: 'other' })
    expect(log).toEqual(['terminal'])
  })
})

// ============================================================================
// Pattern 2: Shared state with block predicates
// Handlers modify state; bThread predicates read it during event selection.
// ============================================================================

describe('shared state with block predicates', () => {
  test('handler sets state that predicate reads between triggers', () => {
    // Models the agent pattern: handler modifies shared state (like simulatingIds),
    // and the bThread predicate reads it in the next event selection cycle.
    // Events come from trigger() calls, not from continuously-requesting threads.
    const log: string[] = []
    const blockedIds = new Set<string>()

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      // Block execute for IDs in the blockedIds set
      guard: bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'execute') return false
              return blockedIds.has(event.detail?.id)
            },
          }),
        ],
        true,
      ),
    })

    useFeedback({
      execute(detail) {
        log.push(`execute:${detail.id}`)
      },
    })

    // Execute with id '1' — not blocked, should pass
    trigger({ type: 'execute', detail: { id: '1' } })
    expect(log).toEqual(['execute:1'])

    // Now block ID '1' via shared state
    blockedIds.add('1')

    // Try to execute '1' again — guard predicate should block it
    trigger({ type: 'execute', detail: { id: '1' } })
    expect(log).toEqual(['execute:1']) // No new execute

    // Execute with id '2' — not in blockedIds, should pass
    trigger({ type: 'execute', detail: { id: '2' } })
    expect(log).toEqual(['execute:1', 'execute:2'])

    // Unblock ID '1'
    blockedIds.delete('1')

    // Now '1' should pass again
    trigger({ type: 'execute', detail: { id: '1' } })
    expect(log).toEqual(['execute:1', 'execute:2', 'execute:1'])
  })

  test('handler modifies shared state visible to next predicate evaluation', () => {
    const log: string[] = []
    const activeSimulations = new Set<string>()

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      // Block 'complete' while any simulation is active
      simulationGuard: bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'complete') return false
              return activeSimulations.size > 0
            },
          }),
        ],
        true,
      ),
    })

    useFeedback({
      start_sim(detail) {
        activeSimulations.add(detail.id)
        log.push(`sim_start:${detail.id}`)
      },
      end_sim(detail) {
        activeSimulations.delete(detail.id)
        log.push(`sim_end:${detail.id}`)
      },
      complete() {
        log.push('complete')
      },
    })

    // Start a simulation
    trigger({ type: 'start_sim', detail: { id: 'sim-1' } })
    expect(log).toEqual(['sim_start:sim-1'])

    // Try to trigger complete — should be blocked
    trigger({ type: 'complete' })
    expect(log).toEqual(['sim_start:sim-1'])

    // End the simulation
    trigger({ type: 'end_sim', detail: { id: 'sim-1' } })
    expect(log).toEqual(['sim_start:sim-1', 'sim_end:sim-1'])

    // Now complete should go through
    trigger({ type: 'complete' })
    expect(log).toEqual(['sim_start:sim-1', 'sim_end:sim-1', 'complete'])
  })
})

// ============================================================================
// Pattern 3: Counter-based completion via events
// Multiple parallel tasks each trigger a result event. After the last one,
// trigger a follow-up event (like invoke_inference).
// ============================================================================

describe('counter-based completion via events', () => {
  test('re-invoke after all parallel tasks complete', async () => {
    const log: string[] = []
    let pendingCount = 0

    const { trigger, useFeedback } = behavioral()

    useFeedback({
      // Dispatch N parallel tasks
      dispatch(detail) {
        pendingCount = detail.count
        log.push(`dispatch:${detail.count}`)
        for (let i = 0; i < detail.count; i++) {
          // Simulate async work — each triggers 'task_done' when complete
          setTimeout(
            () => {
              trigger({ type: 'task_done', detail: { id: `t-${i}` } })
            },
            10 * (i + 1),
          )
        }
      },

      // Each task completion decrements counter
      task_done(detail) {
        log.push(`done:${detail.id}`)
        pendingCount--
        if (pendingCount <= 0) {
          pendingCount = 0
          trigger({ type: 'all_complete' })
        }
      },

      all_complete() {
        log.push('all_complete')
      },
    })

    trigger({ type: 'dispatch', detail: { count: 3 } })
    expect(log).toEqual(['dispatch:3'])

    // Wait for all async tasks to complete
    await wait(100)

    expect(log).toEqual(['dispatch:3', 'done:t-0', 'done:t-1', 'done:t-2', 'all_complete'])
  })

  test('counter reaches 0 exactly once even with sync triggers', () => {
    const log: string[] = []
    let pendingCount = 0

    const { trigger, useFeedback } = behavioral()

    useFeedback({
      dispatch(detail) {
        pendingCount = detail.count
        log.push(`dispatch:${detail.count}`)
      },

      result() {
        pendingCount--
        log.push(`result:pending=${pendingCount}`)
        if (pendingCount <= 0) {
          trigger({ type: 'reinvoke' })
        }
      },

      reinvoke() {
        log.push('reinvoke')
      },
    })

    trigger({ type: 'dispatch', detail: { count: 3 } })
    trigger({ type: 'result' })
    trigger({ type: 'result' })
    trigger({ type: 'result' })

    expect(log).toEqual(['dispatch:3', 'result:pending=2', 'result:pending=1', 'result:pending=0', 'reinvoke'])
  })
})

// ============================================================================
// Pattern 4: Async handler chain
// Async handler → await → trigger → handler chain (agent inference loop)
// ============================================================================

describe('async handler chaining', () => {
  test('async handler triggers next event after await', async () => {
    const log: string[] = []
    const { trigger, useFeedback } = behavioral()

    useFeedback({
      async invoke() {
        log.push('invoke:start')
        await wait(20) // Simulate inference call
        log.push('invoke:done')
        trigger({ type: 'response', detail: { text: 'hello' } })
      },

      response(detail) {
        log.push(`response:${detail.text}`)
      },
    })

    trigger({ type: 'invoke' })

    // Synchronously, only invoke:start fires (async handler started but not resolved)
    expect(log).toEqual(['invoke:start'])

    await wait(50)

    // After async work completes, response fires
    expect(log).toEqual(['invoke:start', 'invoke:done', 'response:hello'])
  })

  test('multiple async handlers chain without interference', async () => {
    const log: string[] = []
    const { trigger, useFeedback } = behavioral()

    useFeedback({
      async step_1() {
        log.push('step_1:start')
        await wait(10)
        log.push('step_1:done')
        trigger({ type: 'step_2' })
      },

      async step_2() {
        log.push('step_2:start')
        await wait(10)
        log.push('step_2:done')
        trigger({ type: 'step_3' })
      },

      step_3() {
        log.push('step_3')
      },
    })

    trigger({ type: 'step_1' })
    expect(log).toEqual(['step_1:start'])

    await wait(50)
    expect(log).toEqual(['step_1:start', 'step_1:done', 'step_2:start', 'step_2:done', 'step_3'])
  })
})

// ============================================================================
// Pattern 5: doneGuard prevents async handler triggers
// After doneGuard activates, async handlers that complete later should
// have their trigger() calls be harmless (blocked by doneGuard).
// ============================================================================

describe('doneGuard + async handlers', () => {
  test('async handler trigger after doneGuard activates is blocked', async () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      doneGuard: bThread([bSync({ waitFor: 'terminal' }), bSync({ block: () => true })], true),
    })

    useFeedback({
      async slow_work() {
        log.push('slow_work:start')
        await wait(50)
        log.push('slow_work:done')
        // By now, terminal has fired and doneGuard is active
        trigger({ type: 'late_result' })
      },

      terminal() {
        log.push('terminal')
      },

      late_result() {
        log.push('late_result') // This should NOT fire
      },
    })

    // Start slow async work
    trigger({ type: 'slow_work' })
    expect(log).toEqual(['slow_work:start'])

    // Immediately fire terminal — doneGuard blocks everything
    trigger({ type: 'terminal' })
    expect(log).toEqual(['slow_work:start', 'terminal'])

    // Wait for slow_work to complete and attempt trigger
    await wait(100)

    // slow_work:done logged (handler ran to completion), but late_result NOT logged
    // because doneGuard blocks the trigger
    expect(log).toEqual(['slow_work:start', 'terminal', 'slow_work:done'])
  })
})

// ============================================================================
// Pattern 6: Event routing via bThreads (instead of if-statements in handlers)
// A bThread waits for an event, then requests a routed event based on state.
// ============================================================================

describe('event routing via threads', () => {
  test('thread routes event based on shared state', () => {
    const log: string[] = []
    const riskLevel = { current: 'safe' }

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      // Route: if risk is 'dangerous', block 'execute' and request 'reject'
      riskRouter: bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'execute') return false
              return riskLevel.current === 'dangerous'
            },
          }),
        ],
        true,
      ),
    })

    useFeedback({
      execute() {
        log.push('execute')
      },
      set_risk(detail) {
        riskLevel.current = detail.level
      },
    })

    // Safe — execute goes through
    trigger({ type: 'execute' })
    expect(log).toEqual(['execute'])

    // Change risk level
    trigger({ type: 'set_risk', detail: { level: 'dangerous' } })

    // Now execute should be blocked
    trigger({ type: 'execute' })
    expect(log).toEqual(['execute']) // No new execute

    // Reset risk level
    trigger({ type: 'set_risk', detail: { level: 'safe' } })

    // Execute goes through again
    trigger({ type: 'execute' })
    expect(log).toEqual(['execute', 'execute'])
  })
})

// ============================================================================
// Pattern 7: maxIterations with precise counting
// A finite bThread counts N events, then blocks further execution and
// requests a terminal event.
// ============================================================================

describe('maxIterations pattern', () => {
  test('counts N events then requests terminal (thread is done after)', () => {
    const log: string[] = []
    const maxIterations = 3

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      maxIter: bThread([
        ...Array.from({ length: maxIterations }, () => bSync({ waitFor: 'tool_result' })),
        bSync({
          block: 'execute',
          request: { type: 'terminal', detail: { content: `Max iterations (${maxIterations}) reached` } },
        }),
      ]),
    })

    useFeedback({
      execute() {
        log.push('execute')
      },
      tool_result() {
        log.push('tool_result')
      },
      terminal(detail) {
        log.push(`terminal:${detail.content}`)
      },
    })

    // Fire first 2 tool_result events — maxIter is still counting
    trigger({ type: 'tool_result' })
    trigger({ type: 'tool_result' })
    expect(log).toEqual(['tool_result', 'tool_result'])

    // 3rd tool_result advances maxIter to its final sync point.
    // That sync point has request: terminal, so terminal fires in the SAME super-step.
    trigger({ type: 'tool_result' })
    expect(log).toEqual(['tool_result', 'tool_result', 'tool_result', 'terminal:Max iterations (3) reached'])

    // IMPORTANT: After terminal fires, maxIter's generator is done (no more rules).
    // The thread is removed from pending — its block on 'execute' disappears!
    // This is why we need doneGuard: maxIterations is a counter + trigger,
    // not a persistent block. doneGuard provides the persistent block.
    trigger({ type: 'execute' })
    expect(log).toEqual([
      'tool_result',
      'tool_result',
      'tool_result',
      'terminal:Max iterations (3) reached',
      'execute', // Passes because maxIter thread is gone!
    ])
  })

  test('maxIterations + doneGuard together provide persistent blocking', () => {
    const log: string[] = []

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      // Counter: waits for 2 tool_results, then requests message
      maxIter: bThread([
        bSync({ waitFor: 'tool_result' }),
        bSync({ waitFor: 'tool_result' }),
        bSync({
          block: 'execute',
          request: { type: 'message', detail: { content: 'Max reached' } },
        }),
      ]),

      // doneGuard: after message fires, blocks EVERYTHING permanently
      doneGuard: bThread([bSync({ waitFor: 'message' }), bSync({ block: () => true })], true),
    })

    useFeedback({
      execute() {
        log.push('execute')
      },
      tool_result() {
        log.push('tool_result')
      },
      message(detail) {
        log.push(`message:${detail.content}`)
      },
    })

    trigger({ type: 'tool_result' })
    trigger({ type: 'tool_result' })

    // 2nd tool_result → maxIter requests message → doneGuard activates
    expect(log).toEqual(['tool_result', 'tool_result', 'message:Max reached'])

    // Now doneGuard blocks everything permanently
    trigger({ type: 'execute' })
    trigger({ type: 'tool_result' })
    trigger({ type: 'anything' })
    expect(log).toEqual(['tool_result', 'tool_result', 'message:Max reached'])
  })
})

// ============================================================================
// Pattern 8: Combining doneGuard + maxIterations + simulationGuard
// All three bThreads coexist — tests additive composition.
// ============================================================================

describe('multiple bThreads composing additively', () => {
  test('doneGuard + maxIterations + guard all work together', () => {
    const log: string[] = []
    const blockedIds = new Set<string>()

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      maxIter: bThread([
        bSync({ waitFor: 'tool_result' }),
        bSync({ waitFor: 'tool_result' }),
        bSync({
          block: 'execute',
          request: { type: 'message', detail: { content: 'Max reached' } },
        }),
      ]),

      doneGuard: bThread([bSync({ waitFor: 'message' }), bSync({ block: () => true })], true),

      guard: bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'execute') return false
              return blockedIds.has(event.detail?.id)
            },
          }),
        ],
        true,
      ),
    })

    useFeedback({
      execute(detail) {
        log.push(`execute:${detail.id}`)
      },
      tool_result() {
        log.push('tool_result')
      },
      message(detail) {
        log.push(`message:${detail.content}`)
      },
    })

    // Block id 'x' via guard
    blockedIds.add('x')

    // Execute with id 'y' — should pass guard
    trigger({ type: 'execute', detail: { id: 'y' } })
    expect(log).toEqual(['execute:y'])

    // Execute with id 'x' — blocked by guard
    trigger({ type: 'execute', detail: { id: 'x' } })
    expect(log).toEqual(['execute:y'])

    // Fire first tool_result — maxIter counts
    trigger({ type: 'tool_result' })
    expect(log).toEqual(['execute:y', 'tool_result'])

    // 2nd tool_result advances maxIter to final sync (block: 'execute', request: 'message').
    // 'message' fires immediately in same super-step.
    // doneGuard picks up 'message' via waitFor and activates block-all.
    trigger({ type: 'tool_result' })
    expect(log).toEqual(['execute:y', 'tool_result', 'tool_result', 'message:Max reached'])

    // Everything is now blocked — doneGuard is active
    trigger({ type: 'execute', detail: { id: 'y' } })
    trigger({ type: 'tool_result' })
    trigger({ type: 'anything' })
    expect(log).toEqual(['execute:y', 'tool_result', 'tool_result', 'message:Max reached'])
  })
})
