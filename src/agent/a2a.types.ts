/**
 * A2A Protocol type definitions.
 * Implements the Agent-to-Agent protocol for interoperability.
 *
 * @remarks
 * Based on the A2A Protocol specification (a2a-protocol.org).
 * Uses JSON-RPC 2.0 over HTTP for communication.
 * No external dependencies required - uses native fetch and Bun.serve.
 *
 * @see https://a2a-protocol.org/latest/specification/
 */

// ============================================================================
// Core A2A Types
// ============================================================================

/**
 * Task lifecycle states in A2A protocol.
 */
export type TaskState = 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled'

/**
 * Message content part - text content.
 */
export type TextPart = {
  type: 'text'
  text: string
}

/**
 * Message content part - file reference.
 */
export type FilePart = {
  type: 'file'
  file: {
    name: string
    mimeType: string
    /** Base64 encoded content or URI */
    bytes?: string
    uri?: string
  }
}

/**
 * Message content part - structured data.
 */
export type DataPart = {
  type: 'data'
  data: Record<string, unknown>
}

/**
 * Union of all message part types.
 */
export type Part = TextPart | FilePart | DataPart

/**
 * A message in A2A communication.
 */
export type A2AMessage = {
  role: 'user' | 'agent'
  parts: Part[]
  /** Optional context for multi-turn */
  contextId?: string
  /** Optional task reference */
  taskId?: string
}

/**
 * An artifact produced by a task.
 */
export type Artifact = {
  name: string
  description?: string
  parts: Part[]
  /** Index for ordering */
  index?: number
  /** Whether artifact is partial (streaming) */
  append?: boolean
  /** When artifact was last modified */
  lastChunk?: boolean
}

/**
 * A task in the A2A protocol.
 */
export type A2ATask = {
  id: string
  contextId?: string
  state: TaskState
  messages: A2AMessage[]
  artifacts: Artifact[]
  /** Custom metadata */
  metadata?: Record<string, unknown>
}

/**
 * Status update for a task.
 */
export type TaskStatus = {
  id: string
  state: TaskState
  message?: A2AMessage
  /** Timestamp of status update */
  timestamp?: string
}

// ============================================================================
// Agent Card Types
// ============================================================================

/**
 * A skill that an agent can perform.
 */
export type AgentSkill = {
  id: string
  name: string
  description: string
  /** Input schema for the skill */
  inputSchema?: Record<string, unknown>
  /** Output schema for the skill */
  outputSchema?: Record<string, unknown>
  /** Tags for categorization */
  tags?: string[]
}

/**
 * Authentication configuration.
 */
export type AuthConfig = {
  schemes: string[]
  credentials?: string
}

/**
 * Agent Card - metadata about an A2A agent.
 * Served at /.well-known/agent.json
 */
export type AgentCard = {
  /** Agent name */
  name: string
  /** Agent description */
  description: string
  /** Base URL for the agent */
  url: string
  /** Protocol version */
  version: string
  /** Skills this agent supports */
  skills: AgentSkill[]
  /** Authentication requirements */
  authentication?: AuthConfig
  /** Default input modes */
  defaultInputModes?: string[]
  /** Default output modes */
  defaultOutputModes?: string[]
  /** Provider information */
  provider?: {
    organization: string
    url?: string
  }
  /** Documentation URL */
  documentationUrl?: string
}

// ============================================================================
// JSON-RPC Types
// ============================================================================

/**
 * JSON-RPC 2.0 request structure.
 */
export type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

/**
 * JSON-RPC 2.0 success response.
 */
export type JsonRpcSuccessResponse = {
  jsonrpc: '2.0'
  id: string | number
  result: unknown
}

/**
 * JSON-RPC 2.0 error response.
 */
export type JsonRpcErrorResponse = {
  jsonrpc: '2.0'
  id: string | number | null
  error: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Union of JSON-RPC response types.
 */
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse

// ============================================================================
// A2A Method Parameters
// ============================================================================

/**
 * Parameters for tasks/send method.
 */
export type TaskSendParams = {
  id: string
  message: A2AMessage
  /** Push notification config */
  pushNotification?: {
    url: string
    authentication?: AuthConfig
  }
  /** Metadata to include */
  metadata?: Record<string, unknown>
}

/**
 * Parameters for tasks/get method.
 */
export type TaskGetParams = {
  id: string
  /** Number of history messages to include */
  historyLength?: number
}

/**
 * Parameters for tasks/cancel method.
 */
export type TaskCancelParams = {
  id: string
}

/**
 * Parameters for tasks/sendSubscribe (streaming).
 */
export type TaskSendSubscribeParams = TaskSendParams

// ============================================================================
// A2A Event Types (for streaming)
// ============================================================================

/**
 * Server-sent event types for streaming.
 */
export type A2AEventType = 'status' | 'artifact' | 'message'

/**
 * Streaming event structure.
 */
export type A2AStreamEvent = {
  type: A2AEventType
  taskId: string
  data: TaskStatus | Artifact | A2AMessage
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Logger interface for A2A adapters.
 */
export type A2ALogger = {
  info: (message: string) => void
  error: (message: string) => void
}

/**
 * Configuration for A2A adapter creation.
 */
export type A2AAdapterConfig = {
  /** Agent card for this agent */
  card: AgentCard
  /** Port to serve on */
  port?: number
  /** Base path for endpoints */
  basePath?: string
  /** Optional logger for server events */
  logger?: A2ALogger
}

/**
 * A2A client configuration.
 */
export type A2AClientConfig = {
  /** Target agent URL */
  agentUrl: string
  /** Authentication token if required */
  authToken?: string
  /** Request timeout in ms */
  timeout?: number
}
