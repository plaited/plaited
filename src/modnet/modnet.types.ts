import type { TLSOptions } from 'bun'
import type { AgentCard } from '../a2a/a2a.schemas.ts'
import type { CreateA2AHandlerOptions } from '../a2a/a2a.types.ts'
import type { ToolDefinition } from '../agent/agent.schemas.ts'
import type { AgentNode, Indexer, Model, SensorFactory, ToolExecutor } from '../agent/agent.types.ts'
import type { ConstitutionFactory, GoalFactory } from '../agent/factories.ts'
import type { HeartbeatHandle } from '../agent/proactive.ts'
import type { ManagedTeamRuntime } from '../runtime/runtime.types.ts'
import type { ServerHandle } from '../server/server.types.ts'

/**
 * Options for {@link createNode}.
 *
 * @public
 */
export type CreateNodeOptions = {
  /** Primary inference model */
  model: Model
  /** Tool definitions available to the agent */
  tools: ToolDefinition[]
  /** Tool executor — local, SSH, or A2A */
  toolExecutor: ToolExecutor
  /** MAC constitution factories */
  constitution?: ConstitutionFactory[]
  /** Goal bThread factories */
  goals?: GoalFactory[]
  /** Absolute path to the node's `.memory/` directory */
  memoryPath: string
  /** Server port (0 = random) */
  port?: number
  /** TLS configuration */
  tls?: TLSOptions
  /** Allowed WebSocket origins */
  allowedOrigins?: Set<string>
  /** Session validator for WebSocket connections */
  validateSession?: (sessionId: string) => boolean
  /** Agent Card for A2A discovery — enables A2A routes when provided */
  agentCard?: AgentCard
  /** A2A authentication callback */
  a2aAuthenticate?: CreateA2AHandlerOptions['authenticate']
  /** System prompt for the agent */
  systemPrompt?: string
  /** Embedding model for memory indexing */
  embedder?: Indexer
  /** Max tool call iterations per task */
  maxIterations?: number
  /** Opt-in proactive mode: heartbeat timer + sensor sweep */
  proactive?: {
    /** Heartbeat interval in ms (default: 900_000 = 15 min) */
    intervalMs?: number
    /** Sensor factories to run on each tick (default: []) */
    sensors?: SensorFactory[]
  }
}

/**
 * Handle returned by {@link createNode}.
 *
 * @public
 */
export type NodeHandle = {
  /** The agent loop instance */
  agent: AgentNode
  /** Internal runtime taxonomy path for PM-owned direct routes */
  runtime: ManagedTeamRuntime
  /** The HTTP/WebSocket server handle */
  server: ServerHandle
  /** A2A routes (present when agentCard was provided) */
  a2a?: { routes: Record<string, (req: Request) => Response | Promise<Response>> }
  /** Heartbeat handle for runtime interval control (present when proactive mode is enabled) */
  heartbeat?: HeartbeatHandle
  /** Tear down agent + server */
  destroy: () => void
}
