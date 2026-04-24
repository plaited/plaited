import * as z from 'zod'

/** @public */
export const McpContentSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough()

/** @public */
export const McpCallToolResultSchema = z.object({
  content: z.array(McpContentSchema),
  isError: z.boolean().optional(),
})

/** @public */
export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()),
})

/** @public */
export const McpPromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
})

/** @public */
export const McpPromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(McpPromptArgumentSchema).optional(),
})

/** @public */
export const McpPromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: McpContentSchema,
})

/** @public */
export const McpResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
})

/** @public */
export const McpResourceContentSchema = z.object({
  uri: z.string(),
  text: z.string().optional(),
  blob: z.string().optional(),
  mimeType: z.string().optional(),
})

/** @public */
export const McpServerCapabilitiesSchema = z.object({
  tools: z.array(McpToolSchema),
  prompts: z.array(McpPromptSchema),
  resources: z.array(McpResourceSchema),
})

/** @public */
export const McpManifestServerSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  transport: z.string().optional(),
})

/** @public */
export const McpManifestCapabilitiesSchema = z.object({
  tools: z.union([z.record(z.string(), McpToolSchema), z.array(McpToolSchema)]).default([]),
  prompts: z.union([z.record(z.string(), McpPromptSchema), z.array(McpPromptSchema)]).default([]),
  resources: z.union([z.record(z.string(), McpResourceSchema), z.array(McpResourceSchema)]).default([]),
})

/** @public */
export const McpManifestSchema = z.object({
  server: McpManifestServerSchema.optional(),
  capabilities: McpManifestCapabilitiesSchema,
})

/** @public */
export const RemoteMcpSecretStorageKindSchema = z.enum(['env', 'varlock-1password', 'system-keychain', 'external'])

/** @public */
export const RemoteMcpSecretStorageSchema = z.object({
  kind: RemoteMcpSecretStorageKindSchema,
  reference: z.string().optional(),
})

/** @public */
export const RemoteMcpSecretSchema = z.object({
  envVar: z.string().min(1),
  storage: RemoteMcpSecretStorageSchema.optional(),
  optional: z.boolean().optional(),
  description: z.string().optional(),
})

/** @public */
export const RemoteMcpTokenPersistenceKindSchema = z.enum(['memory', 'system-keychain', 'external'])

/** @public */
export const RemoteMcpTokenPersistenceSchema = z.object({
  kind: RemoteMcpTokenPersistenceKindSchema,
  key: z.string().optional(),
  note: z.string().optional(),
})

/** @public */
export const RemoteMcpOauthClientAuthenticationSchema = z.enum(['client_secret_basic', 'client_secret_post', 'none'])

const RemoteMcpNoneAuthConfigSchema = z.object({
  type: z.literal('none'),
})

const RemoteMcpBearerEnvAuthConfigSchema = z.object({
  type: z.literal('bearer-env'),
  token: RemoteMcpSecretSchema,
  headerName: z.string().min(1).optional(),
  prefix: z.string().optional(),
})

const RemoteMcpStaticHeadersAuthConfigSchema = z.object({
  type: z.literal('static-headers'),
  headers: z.record(z.string(), z.string()),
})

const RemoteMcpOauthBaseAuthConfigSchema = z.object({
  issuer: z.string().url().optional(),
  tokenUrl: z.string().url(),
  clientId: RemoteMcpSecretSchema,
  clientSecret: RemoteMcpSecretSchema.optional(),
  scopes: z.array(z.string().min(1)).optional(),
  audience: z.string().min(1).optional(),
  resource: z.string().min(1).optional(),
  clientAuthentication: RemoteMcpOauthClientAuthenticationSchema.optional(),
  tokenPersistence: RemoteMcpTokenPersistenceSchema.optional(),
})

const RemoteMcpOauthClientCredentialsAuthConfigSchema = RemoteMcpOauthBaseAuthConfigSchema.extend({
  type: z.literal('oauth-client-credentials'),
})

const RemoteMcpOauthRefreshTokenAuthConfigSchema = RemoteMcpOauthBaseAuthConfigSchema.extend({
  type: z.literal('oauth-refresh-token'),
  refreshToken: RemoteMcpSecretSchema,
})

/** @public */
export const RemoteMcpAuthConfigSchema = z.discriminatedUnion('type', [
  RemoteMcpNoneAuthConfigSchema,
  RemoteMcpBearerEnvAuthConfigSchema,
  RemoteMcpStaticHeadersAuthConfigSchema,
  RemoteMcpOauthClientCredentialsAuthConfigSchema,
  RemoteMcpOauthRefreshTokenAuthConfigSchema,
])

/** @public */
export const ConfiguredRemoteMcpOptionsSchema = z.object({
  headers: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  auth: RemoteMcpAuthConfigSchema.optional(),
})

/** @public */
export type McpCallToolResultOutput = z.infer<typeof McpCallToolResultSchema>
/** @public */
export type McpContentOutput = z.infer<typeof McpContentSchema>
/** @public */
export type McpManifestCapabilitiesOutput = z.infer<typeof McpManifestCapabilitiesSchema>
/** @public */
export type McpManifestOutput = z.infer<typeof McpManifestSchema>
/** @public */
export type McpManifestServerOutput = z.infer<typeof McpManifestServerSchema>
/** @public */
export type McpPromptMessageOutput = z.infer<typeof McpPromptMessageSchema>
/** @public */
export type McpPromptOutput = z.infer<typeof McpPromptSchema>
/** @public */
export type McpResourceContentOutput = z.infer<typeof McpResourceContentSchema>
/** @public */
export type McpResourceOutput = z.infer<typeof McpResourceSchema>
/** @public */
export type ConfiguredRemoteMcpOptionsOutput = z.infer<typeof ConfiguredRemoteMcpOptionsSchema>
/** @public */
export type RemoteMcpAuthConfigOutput = z.infer<typeof RemoteMcpAuthConfigSchema>
/** @public */
export type RemoteMcpOauthClientAuthenticationOutput = z.infer<typeof RemoteMcpOauthClientAuthenticationSchema>
/** @public */
export type RemoteMcpSecretOutput = z.infer<typeof RemoteMcpSecretSchema>
/** @public */
export type RemoteMcpSecretStorageKindOutput = z.infer<typeof RemoteMcpSecretStorageKindSchema>
/** @public */
export type RemoteMcpSecretStorageOutput = z.infer<typeof RemoteMcpSecretStorageSchema>
/** @public */
export type McpServerCapabilitiesOutput = z.infer<typeof McpServerCapabilitiesSchema>
/** @public */
export type McpToolOutput = z.infer<typeof McpToolSchema>
/** @public */
export type RemoteMcpTokenPersistenceKindOutput = z.infer<typeof RemoteMcpTokenPersistenceKindSchema>
/** @public */
export type RemoteMcpTokenPersistenceOutput = z.infer<typeof RemoteMcpTokenPersistenceSchema>
