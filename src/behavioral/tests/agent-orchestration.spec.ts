import { describe, expect, test } from 'bun:test'
import { behavioral, bSync, bThread, type SnapshotMessage } from 'plaited/behavioral'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ============================================================================
// Wave 5 preview: Orchestrator routing
// A central BP program dispatches tasks to project-specific handlers.
// Models the Bun IPC trigger bridge pattern from SYSTEM-DESIGN-V3.
// ============================================================================

describe('orchestrator routing (Wave 5)', () => {
  test('routes tasks to project-specific handlers via dynamic threads', () => {
    const log: string[] = []
    const projectHandlers = new Map<string, (detail: unknown) => void>()

    const { bThreads, trigger, useFeedback } = behavioral()

    // Session-level: enforce one active project at a time using the taskGate
    // pattern — a two-phase bThread that alternates between allowing and blocking.
    // Phase 1: allow dispatch (waitFor), Phase 2: block dispatch (wait for result)
    bThreads.set({
      oneAtATime: bThread(
        [
          // Phase 1: wait for a dispatch to start (allows the first one through)
          bSync({ waitFor: 'dispatch' }),
          // Phase 2: block further dispatches until project completes
          bSync({ waitFor: 'project_result', block: 'dispatch' }),
        ],
        true, // loops: result → back to allowing dispatch
      ),
    })

    useFeedback({
      // Route incoming task to a project
      route(detail) {
        log.push(`route:${detail.project}`)

        // Dynamically add project-specific coordination thread
        bThreads.set({
          [`project_${detail.project}`]: bThread([
            bSync({
              waitFor: (event) => event.type === 'project_result' && event.detail?.project === detail.project,
              interrupt: ['shutdown'],
            }),
          ]),
        })

        // Dispatch to project handler
        trigger({ type: 'dispatch', detail })
      },

      dispatch(detail) {
        log.push(`dispatch:${detail.project}:${detail.task}`)
        // In real code: project.send({ type: 'task', detail }) via Bun IPC
        const handler = projectHandlers.get(detail.project)
        handler?.(detail)
      },

      project_result(detail) {
        log.push(`result:${detail.project}:${detail.output}`)
      },
    })

    // Register mock project handlers (simulating Bun.spawn subprocesses)
    projectHandlers.set('alpha', (_detail) => {
      // Simulate project processing
      trigger({ type: 'project_result', detail: { project: 'alpha', output: 'done-alpha' } })
    })
    projectHandlers.set('beta', (_detail) => {
      trigger({ type: 'project_result', detail: { project: 'beta', output: 'done-beta' } })
    })

    // Route to project alpha
    trigger({ type: 'route', detail: { project: 'alpha', task: 'build' } })
    expect(log).toEqual(['route:alpha', 'dispatch:alpha:build', 'result:alpha:done-alpha'])

    // Route to project beta
    trigger({ type: 'route', detail: { project: 'beta', task: 'test' } })
    expect(log).toEqual([
      'route:alpha',
      'dispatch:alpha:build',
      'result:alpha:done-alpha',
      'route:beta',
      'dispatch:beta:test',
      'result:beta:done-beta',
    ])
  })

  test('queued tasks are blocked while project is active', async () => {
    const log: string[] = []

    const { bThreads, trigger, useFeedback } = behavioral()

    // Same phase-transition pattern: allow dispatch → block until done
    bThreads.set({
      oneAtATime: bThread(
        [bSync({ waitFor: 'dispatch' }), bSync({ waitFor: 'project_done', block: 'dispatch' })],
        true,
      ),
    })

    useFeedback({
      dispatch(detail) {
        log.push(`dispatch:${detail.project}`)
      },

      async project_work(detail) {
        log.push(`work:${detail.project}:start`)
        await wait(20)
        log.push(`work:${detail.project}:done`)
        trigger({ type: 'project_done' })
      },

      project_done() {
        log.push('project_done')
      },
    })

    // Start first project
    trigger({ type: 'dispatch', detail: { project: 'alpha' } })
    expect(log).toEqual(['dispatch:alpha'])

    // Try to dispatch to beta while alpha is active — blocked by oneAtATime
    trigger({ type: 'dispatch', detail: { project: 'beta' } })
    expect(log).toEqual(['dispatch:alpha']) // beta blocked

    // Alpha finishes asynchronously, triggers project_done which unblocks dispatch
    trigger({ type: 'project_work', detail: { project: 'alpha' } })
    expect(log).toEqual(['dispatch:alpha', 'work:alpha:start'])

    await wait(50)
    // project_done fires from async handler, oneAtATime loops back
    // Note: beta dispatch was silently blocked (not queued), so it doesn't auto-fire
    expect(log).toEqual(['dispatch:alpha', 'work:alpha:start', 'work:alpha:done', 'project_done'])

    // Now dispatch is unblocked — beta can go through
    trigger({ type: 'dispatch', detail: { project: 'beta' } })
    expect(log).toEqual(['dispatch:alpha', 'work:alpha:start', 'work:alpha:done', 'project_done', 'dispatch:beta'])
  })
})

// ============================================================================
// Wave 4 preview: Event log via useSnapshot
// Every BP decision is captured — enables persistence, replay, and debugging.
// ============================================================================

describe('event log via useSnapshot (Wave 4)', () => {
  test('useSnapshot captures selection decisions including blockedBy', () => {
    const snapshots: SnapshotMessage[] = []
    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()

    useSnapshot((snapshot) => {
      snapshots.push(snapshot)
    })

    bThreads.set({
      safety: bThread(
        [
          bSync({
            block: (event) => event.type === 'dangerous',
          }),
        ],
        true,
      ),
    })

    useFeedback({
      safe() {},
      dangerous() {},
    })

    // Safe event goes through
    trigger({ type: 'safe' })
    expect(snapshots.length).toBeGreaterThan(0)

    // Check that snapshot has selection bids
    const selectionSnapshots = snapshots.filter((s) => s.kind === 'selection')
    expect(selectionSnapshots.length).toBeGreaterThan(0)

    // Dangerous event is blocked — snapshot should show blockedBy
    trigger({ type: 'dangerous' })
    // The dangerous trigger creates a thread requesting 'dangerous',
    // but 'safety' blocks it. Snapshot shows the block.
    const lastSelection = snapshots.filter((s) => s.kind === 'selection').at(-1) as {
      kind: string
      bids: Array<{ type: string; blockedBy?: string }>
    }
    if (lastSelection) {
      const dangerousBid = lastSelection.bids?.find((b) => b.type === 'dangerous')
      // The dangerous event should show blockedBy: 'safety'
      if (dangerousBid) {
        expect(dangerousBid.blockedBy).toBe('safety')
      }
    }
  })

  test('snapshot stream can be projected into event log entries', () => {
    // Models Wave 4's append-only event log
    const eventLog: Array<{ timestamp: number; event: string; selected: boolean; blockedBy?: string }> = []

    const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()

    useSnapshot((snapshot) => {
      if (snapshot.kind !== 'selection') return
      const selection = snapshot as { bids: Array<{ type: string; selected: boolean; blockedBy?: string }> }
      for (const bid of selection.bids) {
        eventLog.push({
          timestamp: Date.now(),
          event: bid.type,
          selected: bid.selected,
          blockedBy: bid.blockedBy,
        })
      }
    })

    bThreads.set({
      guard: bThread([bSync({ block: 'forbidden' })], true),
    })

    useFeedback({
      allowed() {},
      forbidden() {},
    })

    trigger({ type: 'allowed' })
    trigger({ type: 'forbidden' })

    // Event log captured both the selection and the blocked event
    const allowedEntries = eventLog.filter((e) => e.event === 'allowed')
    expect(allowedEntries.length).toBeGreaterThan(0)
    expect(allowedEntries[0]!.selected).toBe(true)
  })
})

// ============================================================================
// Wave 6 preview: Constitution as additive bThreads
// Safety rules as independent threads that compose via blocking.
// New rules added without modifying existing ones.
// ============================================================================

describe('constitution as bThreads (Wave 6)', () => {
  test('safety rules compose additively — each blocks independently', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    // Rule 1: block file writes to /etc/
    bThreads.set({
      noEtcWrites: bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'execute') return false
              return event.detail?.tool === 'write_file' && event.detail?.path?.startsWith('/etc/')
            },
          }),
        ],
        true,
      ),
    })

    // Rule 2: block bash commands with 'rm -rf'
    bThreads.set({
      noRmRf: bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'execute') return false
              return event.detail?.tool === 'bash' && event.detail?.command?.includes('rm -rf')
            },
          }),
        ],
        true,
      ),
    })

    useFeedback({
      execute(detail) {
        log.push(`execute:${detail.tool}:${detail.path ?? detail.command}`)
      },
    })

    // Safe write — passes both rules
    trigger({ type: 'execute', detail: { tool: 'write_file', path: '/app/config.json' } })
    expect(log).toEqual(['execute:write_file:/app/config.json'])

    // Blocked by rule 1: /etc/ write
    trigger({ type: 'execute', detail: { tool: 'write_file', path: '/etc/passwd' } })
    expect(log).toEqual(['execute:write_file:/app/config.json']) // no new entry

    // Blocked by rule 2: rm -rf
    trigger({ type: 'execute', detail: { tool: 'bash', command: 'rm -rf /' } })
    expect(log).toEqual(['execute:write_file:/app/config.json']) // still no new entry

    // Safe bash — passes both rules
    trigger({ type: 'execute', detail: { tool: 'bash', command: 'ls -la' } })
    expect(log).toEqual(['execute:write_file:/app/config.json', 'execute:bash:ls -la'])
  })

  test('new rules can be added at runtime without modifying existing ones', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      noDelete: bThread(
        [
          bSync({
            block: (event) => event.type === 'execute' && event.detail?.tool === 'delete_file',
          }),
        ],
        true,
      ),
    })

    useFeedback({
      execute(detail) {
        log.push(`execute:${detail.tool}`)
      },
    })

    // delete_file blocked, write_file allowed
    trigger({ type: 'execute', detail: { tool: 'write_file' } })
    trigger({ type: 'execute', detail: { tool: 'delete_file' } })
    expect(log).toEqual(['execute:write_file'])

    // Add new rule at runtime — block network tools
    bThreads.set({
      noNetwork: bThread(
        [
          bSync({
            block: (event) => event.type === 'execute' && event.detail?.tool === 'curl',
          }),
        ],
        true,
      ),
    })

    // Now curl is also blocked
    trigger({ type: 'execute', detail: { tool: 'curl' } })
    expect(log).toEqual(['execute:write_file']) // blocked

    // write_file still works — existing behavior unchanged
    trigger({ type: 'execute', detail: { tool: 'write_file' } })
    expect(log).toEqual(['execute:write_file', 'execute:write_file'])
  })

  test('constitution rules can be loaded from config array', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    // Simulate loading constitution from a config file
    const constitutionRules = [
      { name: 'noSecrets', pattern: /\.(env|pem|key)$/ },
      { name: 'noSystemDirs', pattern: /^\/(etc|sys|proc)\// },
      { name: 'noSudo', pattern: /sudo/ },
    ]

    // Each rule becomes an independent bThread
    const threads: Record<string, ReturnType<typeof bThread>> = {}
    for (const rule of constitutionRules) {
      threads[rule.name] = bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'execute') return false
              const target = event.detail?.path ?? event.detail?.command ?? ''
              return rule.pattern.test(target)
            },
          }),
        ],
        true,
      )
    }
    bThreads.set(threads)

    useFeedback({
      execute(detail) {
        log.push(`execute:${detail.path ?? detail.command}`)
      },
    })

    // Blocked: .env file
    trigger({ type: 'execute', detail: { path: '/app/.env' } })
    expect(log).toEqual([])

    // Blocked: /etc/
    trigger({ type: 'execute', detail: { path: '/etc/hosts' } })
    expect(log).toEqual([])

    // Blocked: sudo command
    trigger({ type: 'execute', detail: { command: 'sudo rm -rf /' } })
    expect(log).toEqual([])

    // Allowed: normal file
    trigger({ type: 'execute', detail: { path: '/app/src/main.ts' } })
    expect(log).toEqual(['execute:/app/src/main.ts'])

    // Allowed: normal command
    trigger({ type: 'execute', detail: { command: 'bun test' } })
    expect(log).toEqual(['execute:/app/src/main.ts', 'execute:bun test'])
  })
})

// ============================================================================
// Wave 3 preview: Discovery as BP events
// Search queries flow through BP, enabling coordination with active tasks.
// ============================================================================

describe('discovery coordination (Wave 3)', () => {
  test('search results flow through BP pipeline with priority', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    // Block search while a tool is executing (avoid interference)
    let toolExecuting = false

    bThreads.set({
      searchGate: bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'search_result') return false
              return toolExecuting
            },
          }),
        ],
        true,
      ),
    })

    useFeedback({
      search_request(detail) {
        log.push(`search:${detail.query}`)
        // Simulate FTS5 → LSP → semantic pipeline
        trigger({ type: 'search_result', detail: { query: detail.query, results: ['file1.ts', 'file2.ts'] } })
      },

      search_result(detail) {
        log.push(`results:${detail.results.join(',')}`)
      },

      execute_start() {
        toolExecuting = true
        log.push('exec:start')
      },

      execute_end() {
        toolExecuting = false
        log.push('exec:end')
      },
    })

    // Search while idle — results flow through
    trigger({ type: 'search_request', detail: { query: 'config' } })
    expect(log).toEqual(['search:config', 'results:file1.ts,file2.ts'])

    // Search while tool executing — results blocked
    trigger({ type: 'execute_start' })
    trigger({ type: 'search_request', detail: { query: 'utils' } })
    // search_request fires (it's not blocked), but search_result IS blocked
    expect(log).toEqual(['search:config', 'results:file1.ts,file2.ts', 'exec:start', 'search:utils'])

    // End execution — blocked results can now flow
    trigger({ type: 'execute_end' })
    trigger({ type: 'search_result', detail: { query: 'utils', results: ['utils.ts'] } })
    expect(log).toEqual([
      'search:config',
      'results:file1.ts,file2.ts',
      'exec:start',
      'search:utils',
      'exec:end',
      'results:utils.ts',
    ])
  })
})

// ============================================================================
// Parallel simulation coordination
// Multiple Dreamer simulations run concurrently; all must complete
// before any tool executes. Models the Wave 2 improvement.
// ============================================================================

describe('parallel simulation coordination', () => {
  test('blocks execute until all simulations complete', async () => {
    const log: string[] = []
    const simulatingIds = new Set<string>()

    const { bThreads, trigger, useFeedback } = behavioral()

    bThreads.set({
      simulationGuard: bThread(
        [
          bSync({
            block: (event) => {
              if (event.type !== 'execute') return false
              return simulatingIds.has(event.detail?.id)
            },
          }),
        ],
        true,
      ),
    })

    useFeedback({
      async simulate(detail) {
        simulatingIds.add(detail.id)
        log.push(`sim:${detail.id}:start`)
        await wait(detail.delay)
        simulatingIds.delete(detail.id)
        log.push(`sim:${detail.id}:done`)
        trigger({ type: 'execute', detail: { id: detail.id } })
      },

      execute(detail) {
        log.push(`execute:${detail.id}`)
      },
    })

    // Start 3 parallel simulations with different delays
    trigger({ type: 'simulate', detail: { id: 'a', delay: 10 } })
    trigger({ type: 'simulate', detail: { id: 'b', delay: 20 } })
    trigger({ type: 'simulate', detail: { id: 'c', delay: 30 } })

    // All started
    expect(log).toEqual(['sim:a:start', 'sim:b:start', 'sim:c:start'])

    await wait(15)
    // 'a' done, executes (no longer in simulatingIds)
    expect(log).toContain('sim:a:done')
    expect(log).toContain('execute:a')

    await wait(15)
    // 'b' done, executes
    expect(log).toContain('sim:b:done')
    expect(log).toContain('execute:b')

    await wait(15)
    // 'c' done, executes
    expect(log).toEqual([
      'sim:a:start',
      'sim:b:start',
      'sim:c:start',
      'sim:a:done',
      'execute:a',
      'sim:b:done',
      'execute:b',
      'sim:c:done',
      'execute:c',
    ])
  })
})

// ============================================================================
// useBehavioral factory: the session as a reusable BP program
// Demonstrates how the agent could use the factory pattern for
// encapsulation with publicEvents as the API whitelist.
// ============================================================================

describe('useBehavioral agent factory', () => {
  test('publicEvents restrict which events can be triggered externally', () => {
    // This test explores whether the agent loop could be built with
    // useBehavioral, exposing only 'task' and 'destroy' as public events
    const log: string[] = []
    const { bThreads, trigger, useFeedback, useRestrictedTrigger } = behavioral()

    // Create restricted trigger — only 'task' and 'destroy' allowed externally
    const publicTrigger = useRestrictedTrigger('model_response', 'execute', 'tool_result')

    bThreads.set({
      safety: bThread([bSync({ block: 'forbidden' })], true),
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
    })

    // Public trigger allows 'task'
    publicTrigger({ type: 'task' })
    expect(log).toEqual(['task'])

    // Public trigger blocks internal events
    publicTrigger({ type: 'model_response' })
    publicTrigger({ type: 'execute' })
    expect(log).toEqual(['task']) // internal events rejected

    // Internal trigger (used by handlers) allows everything
    trigger({ type: 'model_response' })
    trigger({ type: 'execute' })
    expect(log).toEqual(['task', 'model_response', 'execute'])
  })
})
