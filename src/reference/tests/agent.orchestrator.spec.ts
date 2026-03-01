import { afterEach, describe, expect, test } from 'bun:test'
import { createBunProcessManager, createOrchestrator } from '../agent.orchestrator.ts'
import type {
  ManagedProcess,
  Orchestrator,
  ProcessManager,
  ProjectConfig,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '../agent.orchestrator.types.ts'

// ============================================================================
// Test helpers
// ============================================================================

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const makeProject = (name: string, overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  name,
  workspace: `/workspace/${name}`,
  agentConfig: {
    model: 'test-model',
    baseUrl: 'http://localhost:9999',
    ...overrides.agentConfig,
  },
  ...overrides,
})

/**
 * Creates a mock ProcessManager that echoes results after a microtask delay.
 *
 * Each spawned process:
 * 1. Sends `ready` immediately after `init`
 * 2. Sends `result` with echo of prompt after `task`
 * 3. Records all sent messages for assertions
 */
const createMockProcessManager = ({
  delay = 0,
  errorOnTask,
}: {
  delay?: number
  errorOnTask?: string
} = {}): ProcessManager & {
  spawned: Map<string, { messages: WorkerInboundMessage[]; proc: ManagedProcess }>
} => {
  const spawned = new Map<string, { messages: WorkerInboundMessage[]; proc: ManagedProcess }>()

  return {
    spawned,
    spawn: (projectName, _config) => {
      let handler: ((msg: WorkerOutboundMessage) => void) | null = null
      const messages: WorkerInboundMessage[] = []

      const proc: ManagedProcess = {
        send: (msg) => {
          messages.push(msg)

          if (msg.type === 'init') {
            // Send ready after microtask
            queueMicrotask(() => handler?.({ type: 'ready' }))
            return
          }

          if (msg.type === 'task') {
            const taskMsg = msg
            const respond = () => {
              if (errorOnTask && taskMsg.prompt === errorOnTask) {
                handler?.({ type: 'error', taskId: taskMsg.taskId, error: `Failed: ${taskMsg.prompt}` })
              } else {
                handler?.({
                  type: 'result',
                  taskId: taskMsg.taskId,
                  output: `echo:${taskMsg.prompt}`,
                  trajectory: [{ type: 'message', content: taskMsg.prompt, timestamp: Date.now() }],
                })
              }
            }
            if (delay > 0) {
              setTimeout(respond, delay)
            } else {
              queueMicrotask(respond)
            }
            return
          }
        },
        kill: () => {},
        onMessage: (h) => {
          handler = h
        },
      }

      spawned.set(projectName, { messages, proc })
      return proc
    },
  }
}

// ============================================================================
// BP coordination tests (fast, mock ProcessManager)
// ============================================================================

describe('createOrchestrator — BP coordination', () => {
  let orchestrator: Orchestrator

  afterEach(() => {
    orchestrator?.destroy()
  })

  test('dispatches task to project and resolves with result', async () => {
    const pm = createMockProcessManager()
    orchestrator = createOrchestrator({
      projects: [makeProject('alpha')],
      processManager: pm,
    })

    const result = await orchestrator.dispatch('alpha', 'build the app')

    expect(result.output).toBe('echo:build the app')
    expect(result.trajectory).toHaveLength(1)
    expect(result.trajectory[0]!.type).toBe('message')
  })

  test('rejects dispatch to unknown project', async () => {
    const pm = createMockProcessManager()
    orchestrator = createOrchestrator({
      projects: [makeProject('alpha')],
      processManager: pm,
    })

    await expect(orchestrator.dispatch('unknown', 'hello')).rejects.toThrow('Unknown project: unknown')
  })

  test('sequential dispatch: second waits for first to complete (oneAtATime)', async () => {
    const pm = createMockProcessManager({ delay: 20 })
    orchestrator = createOrchestrator({
      projects: [makeProject('alpha'), makeProject('beta')],
      processManager: pm,
    })

    const results: string[] = []

    // Launch both dispatches concurrently
    const p1 = orchestrator.dispatch('alpha', 'first').then((r) => {
      results.push(r.output)
    })
    const p2 = orchestrator.dispatch('beta', 'second').then((r) => {
      results.push(r.output)
    })

    await p1
    // First completes before second starts
    expect(results).toEqual(['echo:first'])

    await p2
    expect(results).toEqual(['echo:first', 'echo:second'])
  })

  test('queued tasks drain in order after completion', async () => {
    const pm = createMockProcessManager({ delay: 10 })
    orchestrator = createOrchestrator({
      projects: [makeProject('alpha')],
      processManager: pm,
    })

    const order: string[] = []

    // Queue up 3 tasks rapidly
    const p1 = orchestrator.dispatch('alpha', 'task-1').then((r) => order.push(r.output))
    const p2 = orchestrator.dispatch('alpha', 'task-2').then((r) => order.push(r.output))
    const p3 = orchestrator.dispatch('alpha', 'task-3').then((r) => order.push(r.output))

    await Promise.all([p1, p2, p3])

    expect(order).toEqual(['echo:task-1', 'echo:task-2', 'echo:task-3'])
  })

  test('multiple tasks to same project reuse process', async () => {
    const pm = createMockProcessManager()
    orchestrator = createOrchestrator({
      projects: [makeProject('alpha')],
      processManager: pm,
    })

    await orchestrator.dispatch('alpha', 'first')
    await orchestrator.dispatch('alpha', 'second')

    // Only one process spawned for 'alpha'
    expect(pm.spawned.size).toBe(1)
    expect(pm.spawned.has('alpha')).toBe(true)
  })

  test('error from worker rejects dispatch promise', async () => {
    const pm = createMockProcessManager({ errorOnTask: 'fail-me' })
    orchestrator = createOrchestrator({
      projects: [makeProject('alpha')],
      processManager: pm,
    })

    await expect(orchestrator.dispatch('alpha', 'fail-me')).rejects.toThrow('Failed: fail-me')
  })

  test('error does not block subsequent dispatches', async () => {
    const pm = createMockProcessManager({ errorOnTask: 'fail-me' })
    orchestrator = createOrchestrator({
      projects: [makeProject('alpha')],
      processManager: pm,
    })

    await expect(orchestrator.dispatch('alpha', 'fail-me')).rejects.toThrow()

    // Subsequent dispatch should work
    const result = await orchestrator.dispatch('alpha', 'recover')
    expect(result.output).toBe('echo:recover')
  })

  test('destroy rejects all pending dispatches', async () => {
    const pm = createMockProcessManager({ delay: 100 })
    orchestrator = createOrchestrator({
      projects: [makeProject('alpha')],
      processManager: pm,
    })

    const promise = orchestrator.dispatch('alpha', 'long-task')

    // Destroy before the task completes
    orchestrator.destroy()

    await expect(promise).rejects.toThrow('Orchestrator destroyed')
  })

  test('destroy kills all spawned processes', async () => {
    let killed = false
    const pm: ProcessManager = {
      spawn: (_name, _config) => {
        let handler: ((msg: WorkerOutboundMessage) => void) | null = null
        return {
          send: (msg) => {
            if (msg.type === 'init') {
              queueMicrotask(() => handler?.({ type: 'ready' }))
            }
          },
          kill: () => {
            killed = true
          },
          onMessage: (h) => {
            handler = h
          },
        }
      },
    }

    orchestrator = createOrchestrator({
      projects: [makeProject('alpha')],
      processManager: pm,
    })

    // Trigger a dispatch to force process spawn
    const promise = orchestrator.dispatch('alpha', 'test')
    await wait(5) // let init/ready handshake happen
    orchestrator.destroy()

    expect(killed).toBe(true)
    await expect(promise).rejects.toThrow('Orchestrator destroyed')
  })

  test('dispatch after destroy rejects immediately', async () => {
    const pm = createMockProcessManager()
    orchestrator = createOrchestrator({
      projects: [makeProject('alpha')],
      processManager: pm,
    })

    orchestrator.destroy()

    await expect(orchestrator.dispatch('alpha', 'hello')).rejects.toThrow('Orchestrator is destroyed')
  })
})

// ============================================================================
// IPC integration tests (real Bun.spawn)
// ============================================================================

describe('createOrchestrator — IPC integration', () => {
  let orchestrator: Orchestrator
  let server: ReturnType<typeof Bun.serve> | null = null

  afterEach(() => {
    orchestrator?.destroy()
    server?.stop()
    server = null
  })

  /**
   * Creates a tiny HTTP server that returns canned inference responses.
   * The response always contains a message with no tool calls,
   * which causes the agent loop to resolve immediately.
   */
  const startMockInferenceServer = () => {
    server = Bun.serve({
      port: 0, // random available port
      fetch: async (_req) => {
        return Response.json({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Done.',
              },
            },
          ],
        })
      },
    })
    return `http://localhost:${server.port}`
  }

  test('spawns worker and routes task through IPC', async () => {
    const baseUrl = startMockInferenceServer()
    const workerPath = `${import.meta.dir}/../agent.orchestrator-worker.ts`

    const pm = createBunProcessManager(workerPath)
    orchestrator = createOrchestrator({
      projects: [
        makeProject('integration', {
          agentConfig: { model: 'test', baseUrl },
        }),
      ],
      processManager: pm,
    })

    const result = await orchestrator.dispatch('integration', 'Say hello')

    expect(result.output).toBeDefined()
    expect(result.trajectory).toBeDefined()
    expect(Array.isArray(result.trajectory)).toBe(true)
  })

  test('worker handles sequential tasks via IPC', async () => {
    const baseUrl = startMockInferenceServer()
    const workerPath = `${import.meta.dir}/../agent.orchestrator-worker.ts`

    const pm = createBunProcessManager(workerPath)
    orchestrator = createOrchestrator({
      projects: [
        makeProject('seq-test', {
          agentConfig: { model: 'test', baseUrl },
        }),
      ],
      processManager: pm,
    })

    const r1 = await orchestrator.dispatch('seq-test', 'Task 1')
    const r2 = await orchestrator.dispatch('seq-test', 'Task 2')

    expect(r1.output).toBeDefined()
    expect(r2.output).toBeDefined()
  })
})
