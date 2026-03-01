import { behavioral } from '../behavioral/behavioral.ts'
import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import { ORCHESTRATOR_EVENTS } from './agent.orchestrator.constants.ts'
import type {
  ManagedProcess,
  Orchestrator,
  OrchestratorEventDetails,
  ProcessManager,
  ProjectConfig,
  WorkerOutboundMessage,
} from './agent.orchestrator.types.ts'
import type { TrajectoryStep } from './agent.schemas.ts'

// ============================================================================
// Default ProcessManager — wraps Bun.spawn() with IPC
// ============================================================================

/**
 * Creates a ProcessManager that spawns real Bun subprocesses with IPC.
 *
 * @param workerPath - Absolute path to the orchestrator worker entry point
 * @returns ProcessManager using Bun.spawn for subprocess creation
 *
 * @public
 */
export const createBunProcessManager = (workerPath: string): ProcessManager => ({
  spawn: (_projectName, _config) => {
    let messageHandler: ((msg: WorkerOutboundMessage) => void) | null = null
    const proc = Bun.spawn(['bun', 'run', workerPath], {
      ipc(message) {
        messageHandler?.(message as WorkerOutboundMessage)
      },
      stdio: ['inherit', 'inherit', 'inherit'],
      serialization: 'json',
    })
    return {
      send: (msg) => proc.send(msg),
      kill: () => proc.kill(),
      onMessage: (handler) => {
        messageHandler = handler
      },
    }
  },
})

// ============================================================================
// Orchestrator Factory
// ============================================================================

/**
 * Creates a multi-project orchestrator using BP coordination.
 *
 * @remarks
 * The orchestrator maintains:
 * - A `oneAtATime` bThread enforcing sequential project execution
 * - A process pool (`Map<string, ManagedProcess>`) with lazy spawning
 * - An internal task queue for dispatches blocked by `oneAtATime`
 * - A pending resolver map for Promise lifecycle management
 *
 * Because BP silently drops blocked events (they are NOT queued),
 * the orchestrator maintains its own queue. When a dispatch is called
 * while another project is active, the task is queued externally.
 * The `project_result`/`project_error` handler drains the queue.
 *
 * @param projects - Array of project configurations
 * @param processManager - Factory for creating managed subprocesses
 * @returns Orchestrator with dispatch() and destroy() methods
 *
 * @public
 */
export const createOrchestrator = ({
  projects,
  processManager,
}: {
  projects: ProjectConfig[]
  processManager: ProcessManager
}): Orchestrator => {
  // -- Project config lookup --
  const projectConfigs = new Map<string, ProjectConfig>(projects.map((p) => [p.name, p]))

  // -- Process pool (lazy spawn on first dispatch) --
  const processes = new Map<string, ManagedProcess>()
  const readyPromises = new Map<string, Promise<void>>()

  // -- Pending resolver map: taskId → { resolve, reject } --
  const pendingResolvers = new Map<
    string,
    { resolve: (value: { output: string; trajectory: TrajectoryStep[] }) => void; reject: (error: Error) => void }
  >()

  // -- Internal task queue (for dispatches blocked by oneAtATime) --
  const taskQueue: Array<{ project: string; taskId: string; prompt: string }> = []
  let activeTask = false

  // -- Task ID counter --
  let nextTaskId = 0

  // -- BP program --
  const { bThreads, trigger, useFeedback } = behavioral<OrchestratorEventDetails>()

  // Session-level: enforce one active project at a time
  // Phase 1: wait for dispatch (allows first through)
  // Phase 2: block dispatch until project completes, then loop
  bThreads.set({
    oneAtATime: bThread(
      [
        bSync({ waitFor: ORCHESTRATOR_EVENTS.dispatch }),
        bSync({
          waitFor: [ORCHESTRATOR_EVENTS.project_result, ORCHESTRATOR_EVENTS.project_error],
          block: ORCHESTRATOR_EVENTS.dispatch,
        }),
      ],
      true,
    ),
  })

  // -- Lazy process spawning with ready handshake --
  const getOrSpawnProcess = (projectName: string): { proc: ManagedProcess; ready: Promise<void> } => {
    const existing = processes.get(projectName)
    if (existing) {
      return { proc: existing, ready: readyPromises.get(projectName) ?? Promise.resolve() }
    }

    const config = projectConfigs.get(projectName)!
    const proc = processManager.spawn(projectName, config)

    // Single permanent handler — two internal phases via bridgeActive flag.
    // Eliminates the handler replacement race that existed when wireIpcBridge
    // called proc.onMessage() a second time after the ready handshake.
    const ready = new Promise<void>((resolve) => {
      let bridgeActive = false
      proc.onMessage((msg) => {
        if (!bridgeActive) {
          if (msg.type === 'ready') {
            bridgeActive = true
            resolve()
          }
          // Messages before ready are intentionally dropped
          return
        }
        // Bridge phase: convert IPC messages to BP triggers
        if (msg.type === 'result') {
          trigger({
            type: ORCHESTRATOR_EVENTS.project_result,
            detail: {
              project: projectName,
              taskId: msg.taskId,
              output: msg.output,
              trajectory: msg.trajectory,
            },
          })
        } else if (msg.type === 'error') {
          trigger({
            type: ORCHESTRATOR_EVENTS.project_error,
            detail: {
              project: projectName,
              taskId: msg.taskId,
              error: msg.error,
            },
          })
        }
      })
    })

    processes.set(projectName, proc)
    readyPromises.set(projectName, ready)

    // Send init message
    proc.send({ type: 'init', config })

    return { proc, ready }
  }

  // -- Feedback handlers --
  useFeedback({
    async [ORCHESTRATOR_EVENTS.dispatch](detail) {
      const { proc, ready } = getOrSpawnProcess(detail.project)

      // Wait for the worker to be ready before sending the task
      await ready

      // Send task to worker via IPC
      proc.send({ type: 'task', taskId: detail.taskId, prompt: detail.prompt })
    },

    [ORCHESTRATOR_EVENTS.project_result](detail) {
      // Resolve the pending promise
      const resolver = pendingResolvers.get(detail.taskId)
      if (resolver) {
        resolver.resolve({ output: detail.output, trajectory: detail.trajectory })
        pendingResolvers.delete(detail.taskId)
      }
      activeTask = false

      // Drain queue — dispatch next task if any
      drainQueue()
    },

    [ORCHESTRATOR_EVENTS.project_error](detail) {
      // Reject the pending promise
      const resolver = pendingResolvers.get(detail.taskId)
      if (resolver) {
        resolver.reject(new Error(detail.error))
        pendingResolvers.delete(detail.taskId)
      }
      activeTask = false

      // Drain queue
      drainQueue()
    },

    // Shutdown is handled imperatively by destroy() — this handler
    // exists only to satisfy the typed event detail map
    [ORCHESTRATOR_EVENTS.shutdown]() {},
  })

  // -- Queue drain: trigger the next queued dispatch --
  const drainQueue = () => {
    const next = taskQueue.shift()
    if (next) {
      activeTask = true
      // Add dynamic project thread for coordination
      bThreads.set({
        [`project_${next.taskId}`]: bThread([
          bSync({
            waitFor: (event: { type: string; detail?: { taskId?: string } }) =>
              (event.type === ORCHESTRATOR_EVENTS.project_result || event.type === ORCHESTRATOR_EVENTS.project_error) &&
              event.detail?.taskId === next.taskId,
            interrupt: [ORCHESTRATOR_EVENTS.shutdown],
          }),
        ]),
      })
      trigger({
        type: ORCHESTRATOR_EVENTS.dispatch,
        detail: next,
      })
    }
  }

  // -- Public API --
  let destroyed = false

  const dispatch = (project: string, prompt: string): Promise<{ output: string; trajectory: TrajectoryStep[] }> => {
    if (destroyed) {
      return Promise.reject(new Error('Orchestrator is destroyed'))
    }

    // Validate project exists
    if (!projectConfigs.has(project)) {
      return Promise.reject(new Error(`Unknown project: ${project}`))
    }

    const taskId = `task_${nextTaskId++}`

    return new Promise((resolve, reject) => {
      pendingResolvers.set(taskId, { resolve, reject })

      if (activeTask) {
        // Queue the task — BP would silently drop the blocked dispatch
        taskQueue.push({ project, taskId, prompt })
        return
      }

      // Dispatch immediately
      activeTask = true

      // Add dynamic project thread
      bThreads.set({
        [`project_${taskId}`]: bThread([
          bSync({
            waitFor: (event: { type: string; detail?: { taskId?: string } }) =>
              (event.type === ORCHESTRATOR_EVENTS.project_result || event.type === ORCHESTRATOR_EVENTS.project_error) &&
              event.detail?.taskId === taskId,
            interrupt: [ORCHESTRATOR_EVENTS.shutdown],
          }),
        ]),
      })

      trigger({
        type: ORCHESTRATOR_EVENTS.dispatch,
        detail: { project, taskId, prompt },
      })
    })
  }

  const destroy = () => {
    destroyed = true

    // Trigger shutdown (interrupts dynamic project threads)
    trigger({ type: ORCHESTRATOR_EVENTS.shutdown, detail: undefined })

    // Reject all pending dispatches
    for (const [taskId, resolver] of pendingResolvers) {
      resolver.reject(new Error('Orchestrator destroyed'))
      pendingResolvers.delete(taskId)
    }

    // Clear the queue and reject queued tasks
    // (queued tasks already have pendingResolvers, rejected above)
    taskQueue.length = 0

    // Kill all processes
    for (const [name, proc] of processes) {
      proc.send({ type: 'shutdown' })
      proc.kill()
      processes.delete(name)
    }
  }

  return { dispatch, destroy }
}
