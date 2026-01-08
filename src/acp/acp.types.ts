/**
 * ACP (Agent Client Protocol) type definitions.
 *
 * @remarks
 * These types define the core protocol structures for headless ACP client
 * communication. They are compatible with the official `@agentclientprotocol/sdk`
 * but defined here to minimize dependencies for evaluation use cases.
 *
 * The protocol uses JSON-RPC 2.0 for transport with these message patterns:
 * - **Requests**: Expect a response (include `id`)
 * - **Notifications**: One-way messages (no `id`)
 * - **Streaming**: Server-sent updates via notifications
 */

// ============================================================================
// JSON-RPC Base Types
// ============================================================================

/** Metadata field present on all ACP types for extensibility */
export type Meta = Record<string, unknown>

/** JSON-RPC 2.0 request structure */
export type JsonRpcRequest<T = unknown> = {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: T
}

/** JSON-RPC 2.0 notification structure (no id, no response expected) */
export type JsonRpcNotification<T = unknown> = {
  jsonrpc: '2.0'
  method: string
  params?: T
}

/** JSON-RPC 2.0 success response */
export type JsonRpcSuccessResponse<T = unknown> = {
  jsonrpc: '2.0'
  id: string | number
  result: T
}

/** JSON-RPC 2.0 error response */
export type JsonRpcErrorResponse = {
  jsonrpc: '2.0'
  id: string | number | null
  error: JsonRpcError
}

/** JSON-RPC 2.0 error object */
export type JsonRpcError = {
  code: number
  message: string
  data?: unknown
}

/** Union of all JSON-RPC response types */
export type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse

/** Union of all JSON-RPC message types */
export type JsonRpcMessage<T = unknown> = JsonRpcRequest<T> | JsonRpcNotification<T> | JsonRpcResponse<T>

// ============================================================================
// Content Block Types
// ============================================================================

/** Text content block - supported by all agents */
export type TextContent = {
  type: 'text'
  text: string
  annotations?: Annotations
  _meta?: Meta
}

/** Image content block - requires image capability */
export type ImageContent = {
  type: 'image'
  data: string
  mimeType: string
  uri?: string
  annotations?: Annotations
  _meta?: Meta
}

/** Audio content block - requires audio capability */
export type AudioContent = {
  type: 'audio'
  data: string
  mimeType: string
  annotations?: Annotations
  _meta?: Meta
}

/** Resource link content block */
export type ResourceLinkContent = {
  type: 'resource_link'
  uri: string
  mimeType?: string
  annotations?: Annotations
  _meta?: Meta
}

/** Embedded resource content block - requires embeddedContext capability */
export type ResourceContent = {
  type: 'resource'
  resource: TextResource | BlobResource
  annotations?: Annotations
  _meta?: Meta
}

/** Text resource for embedding */
export type TextResource = {
  uri: string
  text: string
  mimeType?: string
}

/** Binary resource for embedding */
export type BlobResource = {
  uri: string
  blob: string
  mimeType?: string
}

/** Annotations for content display hints */
export type Annotations = {
  audience?: ('user' | 'assistant')[]
  priority?: number
  _meta?: Meta
}

/** Union of all content block types */
export type ContentBlock = TextContent | ImageContent | AudioContent | ResourceLinkContent | ResourceContent

// ============================================================================
// Initialization Types
// ============================================================================

/** Client information sent during initialization */
export type ClientInfo = {
  name: string
  version: string
}

/** File system capabilities */
export type FileSystemCapabilities = {
  readTextFile?: boolean
  writeTextFile?: boolean
}

/** Client capabilities advertised during initialization */
export type ClientCapabilities = {
  fs?: FileSystemCapabilities
  terminal?: boolean
  _meta?: Meta
}

/** Agent prompt capabilities */
export type PromptCapabilities = {
  image?: boolean
  audio?: boolean
  embeddedContext?: boolean
  _meta?: Meta
}

/** Agent capabilities returned during initialization */
export type AgentCapabilities = {
  loadSession?: boolean
  promptCapabilities?: PromptCapabilities
  _meta?: Meta
}

/** Agent information returned during initialization */
export type AgentInfo = {
  name: string
  version: string
}

/** Initialize request parameters */
export type InitializeParams = {
  protocolVersion: string
  clientInfo?: ClientInfo
  clientCapabilities?: ClientCapabilities
  _meta?: Meta
}

/** Initialize response result */
export type InitializeResult = {
  protocolVersion: string
  agentInfo?: AgentInfo
  agentCapabilities?: AgentCapabilities
  _meta?: Meta
}

// ============================================================================
// Sandbox Configuration Types
// ============================================================================

/**
 * Network restrictions for sandbox execution.
 *
 * @remarks
 * Uses allow-only pattern - all network access is blocked by default.
 * Supports wildcard domains like `*.github.com`.
 */
export type SandboxNetworkConfig = {
  /** Permitted host domains (supports wildcards) */
  allowedDomains?: string[]
  /** Blacklisted domains (takes precedence over allowed) */
  deniedDomains?: string[]
  /** Accessible Unix sockets (macOS only) */
  allowUnixSockets?: string[]
  /** Permission for localhost port binding */
  allowLocalBinding?: boolean
}

/**
 * Filesystem restrictions for sandbox execution.
 *
 * @remarks
 * Read access uses deny-only pattern (default allows all reads).
 * Write access uses allow-only pattern (default blocks all writes).
 * Supports glob patterns on macOS, literal paths on Linux.
 */
export type SandboxFilesystemConfig = {
  /** Paths to deny read access (default: allows all) */
  denyRead?: string[]
  /** Paths to allow write access (default: denies all) */
  allowWrite?: string[]
  /** Paths to deny write access within allowed paths */
  denyWrite?: string[]
}

/**
 * Configuration for Anthropic's sandbox-runtime.
 *
 * @remarks
 * Wraps file and terminal operations with OS-level restrictions.
 * Requires `@anthropic-ai/sandbox-runtime` package.
 */
export type SandboxConfig = {
  /** Enable sandboxing for client operations */
  enabled: boolean
  /** Network access restrictions */
  network?: SandboxNetworkConfig
  /** Filesystem access restrictions */
  filesystem?: SandboxFilesystemConfig
}

// ============================================================================
// MCP Server Types
// ============================================================================

/**
 * MCP server configuration using stdio transport.
 *
 * @remarks
 * The most common transport type. Spawns MCP server as a subprocess
 * and communicates via stdin/stdout.
 */
export type McpServerStdio = {
  /** Transport type identifier */
  type: 'stdio'
  /** Display name for the MCP server */
  name: string
  /** Command to spawn the MCP server */
  command: string[]
  /** Environment variables for the subprocess */
  env?: Record<string, string>
  /** Working directory for the subprocess */
  cwd?: string
  _meta?: Meta
}

/**
 * MCP server configuration using HTTP transport.
 *
 * @remarks
 * For MCP servers running as HTTP services with request/response model.
 */
export type McpServerHttp = {
  /** Transport type identifier */
  type: 'http'
  /** Display name for the MCP server */
  name: string
  /** HTTP URL of the MCP server */
  url: string
  /** Optional authentication headers */
  headers?: Record<string, string>
  _meta?: Meta
}

/**
 * MCP server configuration using Server-Sent Events transport.
 *
 * @remarks
 * For MCP servers that stream updates via SSE.
 */
export type McpServerSse = {
  /** Transport type identifier */
  type: 'sse'
  /** Display name for the MCP server */
  name: string
  /** SSE endpoint URL */
  url: string
  /** Optional authentication headers */
  headers?: Record<string, string>
  _meta?: Meta
}

/**
 * Union of all MCP server transport configurations.
 *
 * @remarks
 * Use with `CreateSessionParams.mcpServers` to configure MCP servers
 * for evaluation sessions. Stdio is the most common transport.
 */
export type McpServer = McpServerStdio | McpServerHttp | McpServerSse

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session creation parameters.
 *
 * @remarks
 * Supports configuring the session's working directory and MCP servers
 * to connect to during the session.
 */
export type CreateSessionParams = {
  /** Working directory for the session */
  cwd?: string
  /** MCP servers to connect to during this session */
  mcpServers?: McpServer[]
  _meta?: Meta
}

/** Session object */
export type Session = {
  id: string
  _meta?: Meta
}

/** Session prompt request parameters */
export type PromptParams = {
  sessionId: string
  prompt: ContentBlock[]
  _meta?: Meta
}

/** Reason the prompt turn stopped */
export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'cancelled' | 'error'

/** Prompt response result */
export type PromptResult = {
  stopReason: StopReason
  _meta?: Meta
}

// ============================================================================
// Session Update Types (Notifications)
// ============================================================================

/** Tool call status */
export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'error'

/** Tool call kind for display hints */
export type ToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'switch_mode'
  | 'other'

/** Tool call information */
export type ToolCall = {
  id: string
  name: string
  input?: Record<string, unknown>
  status: ToolCallStatus
  kind?: ToolKind
  content?: ContentBlock[]
  _meta?: Meta
}

/** Plan entry priority */
export type PlanEntryPriority = 'high' | 'medium' | 'low'

/** Plan entry status */
export type PlanEntryStatus = 'pending' | 'in_progress' | 'completed'

/** Plan entry for agent execution strategy */
export type PlanEntry = {
  content: string
  priority?: PlanEntryPriority
  status?: PlanEntryStatus
  _meta?: Meta
}

/** Session update notification parameters */
export type SessionUpdateParams = {
  sessionId: string
  content?: ContentBlock[]
  toolCalls?: ToolCall[]
  plan?: PlanEntry[]
  _meta?: Meta
}

// ============================================================================
// Permission Types
// ============================================================================

/** Permission request option */
export type PermissionOption = {
  id: string
  label: string
  description?: string
  _meta?: Meta
}

/** Permission request parameters (agent → client) */
export type RequestPermissionParams = {
  sessionId: string
  toolCallId: string
  options: PermissionOption[]
  _meta?: Meta
}

/** Permission outcome - user selected an option */
export type PermissionSelectedOutcome = {
  outcome: 'selected'
  optionId: string
  _meta?: Meta
}

/** Permission outcome - request was cancelled */
export type PermissionCancelledOutcome = {
  outcome: 'cancelled'
  _meta?: Meta
}

/** Permission request result (client → agent) */
export type RequestPermissionResult = PermissionSelectedOutcome | PermissionCancelledOutcome

// ============================================================================
// File System Types
// ============================================================================

/** Read text file request parameters */
export type ReadTextFileParams = {
  sessionId: string
  path: string
  _meta?: Meta
}

/** Read text file result */
export type ReadTextFileResult = {
  content: string
  _meta?: Meta
}

/** Write text file request parameters */
export type WriteTextFileParams = {
  sessionId: string
  path: string
  content: string
  _meta?: Meta
}

// ============================================================================
// Terminal Types
// ============================================================================

/** Terminal creation parameters */
export type TerminalCreateParams = {
  sessionId: string
  command: string
  cwd?: string
  env?: Record<string, string>
  _meta?: Meta
}

/** Terminal creation result */
export type TerminalCreateResult = {
  terminalId: string
  _meta?: Meta
}

/** Terminal output request parameters */
export type TerminalOutputParams = {
  sessionId: string
  terminalId: string
  _meta?: Meta
}

/** Terminal output result */
export type TerminalOutputResult = {
  output: string
  exitCode?: number
  _meta?: Meta
}

// ============================================================================
// Cancellation Types
// ============================================================================

/** Session cancel notification parameters */
export type SessionCancelParams = {
  sessionId: string
  _meta?: Meta
}

/** Cancel request notification parameters (protocol-level) */
export type CancelRequestParams = {
  id: string | number
  _meta?: Meta
}

// ============================================================================
// Error Codes
// ============================================================================

/** Standard JSON-RPC error codes */
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  REQUEST_CANCELLED: -32800,
} as const

// ============================================================================
// Protocol Methods
// ============================================================================

/** ACP method names */
export const ACP_METHODS = {
  // Lifecycle
  INITIALIZE: 'initialize',
  SHUTDOWN: 'shutdown',

  // Sessions
  CREATE_SESSION: 'session/create',
  LOAD_SESSION: 'session/load',
  PROMPT: 'session/prompt',
  CANCEL: 'session/cancel',
  UPDATE: 'session/update',
  REQUEST_PERMISSION: 'session/request_permission',

  // File system
  READ_TEXT_FILE: 'fs/read_text_file',
  WRITE_TEXT_FILE: 'fs/write_text_file',

  // Terminal
  TERMINAL_CREATE: 'terminal/create',
  TERMINAL_OUTPUT: 'terminal/output',
  TERMINAL_WAIT_FOR_EXIT: 'terminal/wait_for_exit',
  TERMINAL_KILL: 'terminal/kill',
  TERMINAL_RELEASE: 'terminal/release',

  // Protocol-level
  CANCEL_REQUEST: '$/cancel_request',
} as const

/** Current protocol version */
export const ACP_PROTOCOL_VERSION = '2025-draft' as const
