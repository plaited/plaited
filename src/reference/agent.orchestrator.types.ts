import type { ORCHESTRATOR_EVENTS } from './agent.orchestrator.constants.ts'
import type { TrajectoryStep } from './agent.schemas.ts'

// ============================================================================
// Project Configuration
// ============================================================================

/**
 * Configuration for a project managed by the orchestrator.
 *
 * @remarks
 * Each project maps to a subprocess running its own `createAgentLoop`.
 * The `workspace` path scopes the agent's file system operations.
 *
 * @public
 */
export type ProjectConfig = {
  name: string
  workspace: string
  agentConfig: {
    model: string
    baseUrl: string
    systemPrompt?: string
    maxIterations?: number
    temperature?: number
  }
}

// ============================================================================
// IPC Message Protocol (discriminated union on `type`)
// ============================================================================

/** Parent → Child: create agent loop */
export type InitMessage = {
  type: 'init'
  config: ProjectConfig
}

/** Parent → Child: execute a task */
export type TaskMessage = {
  type: 'task'
  taskId: string
  prompt: string
}

/** Parent → Child: graceful exit */
export type ShutdownMessage = {
  type: 'shutdown'
}

/** All messages the parent can send to a worker */
export type WorkerInboundMessage = InitMessage | TaskMessage | ShutdownMessage

/** Child → Parent: loop initialized */
export type ReadyMessage = {
  type: 'ready'
}

/** Child → Parent: task complete */
export type ResultMessage = {
  type: 'result'
  taskId: string
  output: string
  trajectory: TrajectoryStep[]
}

/** Child → Parent: task failed */
export type ErrorMessage = {
  type: 'error'
  taskId: string
  error: string
}

/** All messages a worker can send to the parent */
export type WorkerOutboundMessage = ReadyMessage | ResultMessage | ErrorMessage

// ============================================================================
// ProcessManager Testing Seam
// ============================================================================

/**
 * Handle to a managed subprocess.
 *
 * @remarks
 * Abstracts IPC communication so tests can inject a mock that uses
 * direct function calls instead of real subprocesses.
 *
 * @public
 */
export type ManagedProcess = {
  send: (msg: WorkerInboundMessage) => void
  kill: () => void
  onMessage: (handler: (msg: WorkerOutboundMessage) => void) => void
}

/**
 * Factory for creating managed subprocesses.
 *
 * @remarks
 * Default implementation wraps `Bun.spawn()` with IPC.
 * Tests inject a mock that echoes results via microtask callbacks.
 *
 * @public
 */
export type ProcessManager = {
  spawn: (projectName: string, config: ProjectConfig) => ManagedProcess
}

// ============================================================================
// Orchestrator Event Details
// ============================================================================

/**
 * BP event detail map for orchestrator events.
 *
 * @remarks
 * Keyed by `ORCHESTRATOR_EVENTS` constants. Each entry defines the
 * `detail` payload for the corresponding event type.
 *
 * @public
 */
export type OrchestratorEventDetails = {
  [ORCHESTRATOR_EVENTS.dispatch]: { project: string; taskId: string; prompt: string }
  [ORCHESTRATOR_EVENTS.project_result]: {
    project: string
    taskId: string
    output: string
    trajectory: TrajectoryStep[]
  }
  [ORCHESTRATOR_EVENTS.project_error]: { project: string; taskId: string; error: string }
  [ORCHESTRATOR_EVENTS.shutdown]: undefined
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Multi-project orchestrator.
 *
 * @remarks
 * Dispatches tasks to project subprocesses using BP coordination.
 * One task executes at a time; additional dispatches are queued.
 *
 * @public
 */
export type Orchestrator = {
  dispatch: (project: string, prompt: string) => Promise<{ output: string; trajectory: TrajectoryStep[] }>
  destroy: () => void
}
