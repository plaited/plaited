import type {
  AgentCard,
  Message,
  MessageSendParams,
  Task,
  TaskArtifactUpdateEvent,
  TaskIdParams,
  TaskPushNotificationConfig,
  TaskQueryParams,
  TaskStatusUpdateEvent,
} from './a2a.schemas.ts'

// ============================================================================
// Streaming Event Union
// ============================================================================

/**
 * Events yielded during streaming operations.
 *
 * @remarks
 * Union type of all events that can be emitted by a streaming A2A response,
 * including both partial task updates and final task state.
 *
 * @public
 */
export type StreamEvent = Task | Message | TaskStatusUpdateEvent | TaskArtifactUpdateEvent

// ============================================================================
// Server-Side Operation Handlers
// ============================================================================

/**
 * Server-side handler signatures that the agent implements.
 *
 * @remarks
 * Only `sendMessage` is required. Unimplemented operations return
 * `-32601 method_not_found` to the caller via JSON-RPC.
 *
 * @public
 */
export type A2AOperationHandlers = {
  sendMessage: (params: MessageSendParams, signal: AbortSignal) => Promise<Task | Message>
  sendStreamingMessage?: (params: MessageSendParams, signal: AbortSignal) => AsyncIterable<StreamEvent>
  getTask?: (params: TaskQueryParams) => Promise<Task>
  cancelTask?: (params: TaskIdParams) => Promise<Task>
  subscribeToTask?: (params: TaskIdParams, signal: AbortSignal) => AsyncIterable<StreamEvent>
  getExtendedAgentCard?: () => Promise<AgentCard>
  setPushConfig?: (params: TaskPushNotificationConfig) => Promise<TaskPushNotificationConfig>
  getPushConfig?: (params: TaskIdParams) => Promise<TaskPushNotificationConfig>
  listPushConfigs?: (params: TaskIdParams) => Promise<TaskPushNotificationConfig[]>
  deletePushConfig?: (params: TaskIdParams) => Promise<void>
}

// ============================================================================
// Client Interface
// ============================================================================

/**
 * Outbound A2A client — all operations available.
 *
 * @public
 */
export type A2AClient = {
  sendMessage: (params: MessageSendParams) => Promise<Task | Message>
  sendStreamingMessage: (params: MessageSendParams, signal?: AbortSignal) => AsyncIterable<StreamEvent>
  getTask: (params: TaskQueryParams) => Promise<Task>
  cancelTask: (params: TaskIdParams) => Promise<Task>
  subscribeToTask: (params: TaskIdParams, signal?: AbortSignal) => AsyncIterable<StreamEvent>
  getExtendedAgentCard: () => Promise<AgentCard>
  setPushConfig: (params: TaskPushNotificationConfig) => Promise<TaskPushNotificationConfig>
  getPushConfig: (params: TaskIdParams) => Promise<TaskPushNotificationConfig>
  listPushConfigs: (params: TaskIdParams) => Promise<TaskPushNotificationConfig[]>
  deletePushConfig: (params: TaskIdParams) => Promise<void>
  fetchAgentCard: () => Promise<AgentCard>
  disconnect: () => void
}

// ============================================================================
// Factory Option Types
// ============================================================================

/**
 * Options for {@link createA2AClient}.
 *
 * @param url - Base URL of the remote agent
 * @param unix - Unix socket path (Bun extension) for same-box transport
 * @param tls - mTLS client certificates (Bun extension)
 * @param headers - Additional headers sent with every request
 *
 * @public
 */
export type CreateA2AClientOptions = {
  url: string
  unix?: string
  tls?: { cert: string; key: string; ca?: string }
  headers?: Record<string, string>
}

/**
 * Options for {@link createA2AHandler}.
 *
 * @param card - Agent Card value or getter for dynamic capabilities.
 *   A function is called per-request so runtime capability changes
 *   (added skills, updated constitution) are reflected immediately.
 * @param handlers - Operation implementations
 * @param authenticate - Optional auth callback; returns identifier or throws
 *
 * @public
 */
export type CreateA2AHandlerOptions = {
  card: AgentCard | (() => AgentCard)
  handlers: A2AOperationHandlers
  authenticate?: (request: Request) => Promise<string | undefined>
}
