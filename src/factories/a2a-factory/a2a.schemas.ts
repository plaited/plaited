import * as z from 'zod'
import { A2A_METHOD, MESSAGE_ROLE, TASK_STATE } from './a2a.constants.ts'

// ============================================================================
// Part Schemas — content building blocks
// ============================================================================

/**
 * A text content part.
 *
 * @public
 */
export const TextPartSchema = z.object({
  kind: z.literal('text'),
  text: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type TextPart = z.infer<typeof TextPartSchema>

/**
 * A file content part with inline bytes (base64-encoded).
 *
 * @public
 */
export const FileWithBytesSchema = z.object({
  name: z.string().optional(),
  mimeType: z.string().optional(),
  bytes: z.string(),
})

/**
 * A file content part referenced by URI.
 *
 * @public
 */
export const FileWithUriSchema = z.object({
  name: z.string().optional(),
  mimeType: z.string().optional(),
  uri: z.string(),
})

/**
 * A file content part — either inline bytes or URI reference.
 *
 * @public
 */
export const FilePartSchema = z.object({
  kind: z.literal('file'),
  file: z.union([FileWithBytesSchema, FileWithUriSchema]),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type FilePart = z.infer<typeof FilePartSchema>

/**
 * A structured data content part (arbitrary JSON).
 *
 * @public
 */
export const DataPartSchema = z.object({
  kind: z.literal('data'),
  data: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type DataPart = z.infer<typeof DataPartSchema>

/**
 * Discriminated union of all content part types.
 *
 * @remarks
 * Discriminated on `kind`: `"text"`, `"file"`, or `"data"`.
 *
 * @public
 */
export const PartSchema = z.discriminatedUnion('kind', [TextPartSchema, FilePartSchema, DataPartSchema])

export type Part = z.infer<typeof PartSchema>

// ============================================================================
// Message Schema
// ============================================================================

const messageRoleValues = Object.values(MESSAGE_ROLE)

/**
 * An A2A message — the primary communication unit between agents.
 *
 * @public
 */
export const MessageSchema = z.object({
  kind: z.literal('message'),
  messageId: z.string(),
  role: z.enum(messageRoleValues),
  parts: z.array(PartSchema),
  contextId: z.string().optional(),
  taskId: z.string().optional(),
  referenceTaskIds: z.array(z.string()).optional(),
  extensions: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type Message = z.infer<typeof MessageSchema>

// ============================================================================
// Task Schemas
// ============================================================================

const taskStateValues = Object.values(TASK_STATE)

/**
 * Current status of a task.
 *
 * @public
 */
export const TaskStatusSchema = z.object({
  state: z.enum(taskStateValues),
  message: MessageSchema.optional(),
  timestamp: z.string().optional(),
})

export type TaskStatus = z.infer<typeof TaskStatusSchema>

/**
 * An artifact produced by task execution.
 *
 * @public
 */
export const ArtifactSchema = z.object({
  artifactId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  parts: z.array(PartSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type Artifact = z.infer<typeof ArtifactSchema>

/**
 * A task — the primary unit of work in the A2A protocol.
 *
 * @public
 */
export const TaskSchema = z.object({
  kind: z.literal('task'),
  id: z.string(),
  contextId: z.string().optional(),
  status: TaskStatusSchema,
  artifacts: z.array(ArtifactSchema).optional(),
  history: z.array(MessageSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type Task = z.infer<typeof TaskSchema>

// ============================================================================
// Stream Event Schemas
// ============================================================================

/**
 * SSE event for task status changes during streaming.
 *
 * @remarks
 * `final: true` signals the last status update for this stream.
 *
 * @public
 */
export const TaskStatusUpdateEventSchema = z.object({
  kind: z.literal('status-update'),
  taskId: z.string(),
  contextId: z.string().optional(),
  status: TaskStatusSchema,
  final: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type TaskStatusUpdateEvent = z.infer<typeof TaskStatusUpdateEventSchema>

/**
 * SSE event for artifact updates during streaming.
 *
 * @public
 */
export const TaskArtifactUpdateEventSchema = z.object({
  kind: z.literal('artifact-update'),
  taskId: z.string(),
  contextId: z.string().optional(),
  artifact: ArtifactSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type TaskArtifactUpdateEvent = z.infer<typeof TaskArtifactUpdateEventSchema>

// ============================================================================
// Agent Card Schemas
// ============================================================================

/**
 * Security scheme — discriminated on `type` (OpenAPI 3.0 compatible).
 *
 * @public
 */
export const ApiKeySecuritySchemeSchema = z.object({
  type: z.literal('apiKey'),
  name: z.string(),
  in: z.enum(['header', 'query', 'cookie']),
  description: z.string().optional(),
})

export const HttpAuthSecuritySchemeSchema = z.object({
  type: z.literal('http'),
  scheme: z.string(),
  bearerFormat: z.string().optional(),
  description: z.string().optional(),
})

export const OAuth2FlowSchema = z.object({
  authorizationUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  refreshUrl: z.string().optional(),
  scopes: z.record(z.string(), z.string()).optional(),
})

export const OAuth2SecuritySchemeSchema = z.object({
  type: z.literal('oauth2'),
  flows: z.object({
    implicit: OAuth2FlowSchema.optional(),
    password: OAuth2FlowSchema.optional(),
    clientCredentials: OAuth2FlowSchema.optional(),
    authorizationCode: OAuth2FlowSchema.optional(),
  }),
  description: z.string().optional(),
})

export const OpenIdConnectSecuritySchemeSchema = z.object({
  type: z.literal('openIdConnect'),
  openIdConnectUrl: z.string(),
  description: z.string().optional(),
})

export const MutualTlsSecuritySchemeSchema = z.object({
  type: z.literal('mutualTLS'),
  description: z.string().optional(),
})

/**
 * Discriminated union of all security scheme types.
 *
 * @public
 */
export const SecuritySchemeSchema = z.discriminatedUnion('type', [
  ApiKeySecuritySchemeSchema,
  HttpAuthSecuritySchemeSchema,
  OAuth2SecuritySchemeSchema,
  OpenIdConnectSecuritySchemeSchema,
  MutualTlsSecuritySchemeSchema,
])

export type SecurityScheme = z.infer<typeof SecuritySchemeSchema>

/**
 * An agent skill declaration for the Agent Card.
 *
 * @public
 */
export const AgentSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
})

export type AgentSkill = z.infer<typeof AgentSkillSchema>

/**
 * Agent capabilities declaration.
 *
 * @public
 */
export const AgentCapabilitiesSchema = z.object({
  streaming: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  stateTransitionHistory: z.boolean().optional(),
})

export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>

/**
 * Agent provider information.
 *
 * @public
 */
export const AgentProviderSchema = z.object({
  organization: z.string(),
  url: z.string().optional(),
})

export type AgentProvider = z.infer<typeof AgentProviderSchema>

/**
 * Additional interface declaration for multimodal protocols.
 *
 * @public
 */
export const AgentInterfaceSchema = z.object({
  type: z.string(),
  url: z.string(),
  description: z.string().optional(),
})

export type AgentInterface = z.infer<typeof AgentInterfaceSchema>

/**
 * JWS compact serialization for Agent Card verification.
 *
 * @public
 */
export const AgentCardSignatureSchema = z.object({
  signature: z.string(),
  algorithm: z.string().optional(),
  keyId: z.string().optional(),
})

export type AgentCardSignature = z.infer<typeof AgentCardSignatureSchema>

/**
 * The Agent Card — capability discovery and auth scheme declaration.
 *
 * @remarks
 * Served at `/.well-known/agent-card.json`. Signed via JWS for
 * identity verification. Peers fetch this to discover capabilities
 * and security requirements before sending messages.
 *
 * @public
 */
export const AgentCardSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string(),
  provider: AgentProviderSchema.optional(),
  version: z.string().optional(),
  protocolVersion: z.string().optional(),
  capabilities: AgentCapabilitiesSchema.optional(),
  securitySchemes: z.record(z.string(), SecuritySchemeSchema).optional(),
  security: z.array(z.record(z.string(), z.array(z.string()))).optional(),
  skills: z.array(AgentSkillSchema).optional(),
  preferredTransport: z.string().optional(),
  additionalInterfaces: z.array(AgentInterfaceSchema).optional(),
  supportsAuthenticatedExtendedCard: z.boolean().optional(),
  signature: AgentCardSignatureSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type AgentCard = z.infer<typeof AgentCardSchema>

// ============================================================================
// Request Parameter Schemas
// ============================================================================

/**
 * Configuration for message send operations.
 *
 * @public
 */
export const MessageSendConfigurationSchema = z.object({
  acceptedOutputModes: z.array(z.string()).optional(),
  historyLength: z.number().optional(),
  blocking: z.boolean().optional(),
})

export type MessageSendConfiguration = z.infer<typeof MessageSendConfigurationSchema>

/**
 * Parameters for `message/send` and `message/stream` operations.
 *
 * @public
 */
export const MessageSendParamsSchema = z.object({
  message: MessageSchema,
  configuration: MessageSendConfigurationSchema.optional(),
})

export type MessageSendParams = z.infer<typeof MessageSendParamsSchema>

/**
 * Parameters for `tasks/get` — query a task with optional history.
 *
 * @public
 */
export const TaskQueryParamsSchema = z.object({
  id: z.string(),
  historyLength: z.number().optional(),
})

export type TaskQueryParams = z.infer<typeof TaskQueryParamsSchema>

/**
 * Parameters for `tasks/cancel` and `tasks/resubscribe` — identify by task ID.
 *
 * @public
 */
export const TaskIdParamsSchema = z.object({
  id: z.string(),
})

export type TaskIdParams = z.infer<typeof TaskIdParamsSchema>

// ============================================================================
// Push Notification Schemas
// ============================================================================

/**
 * Authentication configuration for push notification webhooks.
 *
 * @remarks
 * Declares which security schemes the webhook expects and optional
 * pre-shared credentials for the callback.
 *
 * @public
 */
export const PushNotificationAuthenticationSchema = z.object({
  schemes: z.array(z.string()),
  credentials: z.string().optional(),
})

export type PushNotificationAuthentication = z.infer<typeof PushNotificationAuthenticationSchema>

/**
 * Configuration for a push notification webhook endpoint.
 *
 * @remarks
 * Registered per-task via `tasks/pushNotificationConfig/set`.
 * When a task status changes, the server POSTs a JSON-RPC notification
 * to `url` with optional bearer token authentication.
 *
 * @public
 */
export const PushNotificationConfigSchema = z.object({
  url: z.string(),
  token: z.string().optional(),
  authentication: PushNotificationAuthenticationSchema.optional(),
})

export type PushNotificationConfig = z.infer<typeof PushNotificationConfigSchema>

/**
 * A push notification config scoped to a specific task.
 *
 * @remarks
 * Used as both the input parameter for `set` and the return value
 * for `get`/`list` operations.
 *
 * @public
 */
export const TaskPushNotificationConfigSchema = z.object({
  id: z.string(),
  pushNotificationConfig: PushNotificationConfigSchema,
})

export type TaskPushNotificationConfig = z.infer<typeof TaskPushNotificationConfigSchema>

// ============================================================================
// JSON-RPC 2.0 Envelope Schemas
// ============================================================================

const a2aMethodValues = Object.values(A2A_METHOD)

/**
 * JSON-RPC 2.0 request envelope.
 *
 * @public
 */
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.enum(a2aMethodValues),
  params: z.unknown().optional(),
})

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>

/**
 * JSON-RPC 2.0 success response envelope.
 *
 * @public
 */
export const JsonRpcSuccessResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown(),
})

export type JsonRpcSuccessResponse = z.infer<typeof JsonRpcSuccessResponseSchema>

/**
 * JSON-RPC 2.0 error detail.
 *
 * @public
 */
export const JsonRpcErrorDetailSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
})

export type JsonRpcErrorDetail = z.infer<typeof JsonRpcErrorDetailSchema>

/**
 * JSON-RPC 2.0 error response envelope.
 *
 * @public
 */
export const JsonRpcErrorResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  error: JsonRpcErrorDetailSchema,
})

export type JsonRpcErrorResponse = z.infer<typeof JsonRpcErrorResponseSchema>
