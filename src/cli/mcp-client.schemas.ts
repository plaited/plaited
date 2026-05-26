/**
 * Agent-facing MCP client CLI for calling remote MCP servers.
 *
 * @remarks
 * Supports all 7 MCP operations: call-tool, list-tools, list-prompts,
 * get-prompt, list-resources, read-resource, and discover.
 *
 * @internal
 */

import * as z from 'zod'

const _McpContentSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough()

const McpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()),
})

const McpPromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
})

const McpPromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(McpPromptArgumentSchema).optional(),
})

const McpResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
})

const McpManifestServerSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  transport: z.string().optional(),
})

const McpManifestCapabilitiesSchema = z.object({
  tools: z.union([z.record(z.string(), McpToolSchema), z.array(McpToolSchema)]).default([]),
  prompts: z.union([z.record(z.string(), McpPromptSchema), z.array(McpPromptSchema)]).default([]),
  resources: z.union([z.record(z.string(), McpResourceSchema), z.array(McpResourceSchema)]).default([]),
})

export const McpManifestSchema = z.object({
  server: McpManifestServerSchema.optional(),
  capabilities: McpManifestCapabilitiesSchema,
})

const RemoteMcpSecretStorageKindSchema = z.enum(['env', 'varlock-1password', 'system-keychain', 'external'])

const RemoteMcpSecretStorageSchema = z.object({
  kind: RemoteMcpSecretStorageKindSchema,
  reference: z.string().optional(),
})

const RemoteMcpSecretSchema = z.object({
  envVar: z.string().min(1),
  storage: RemoteMcpSecretStorageSchema.optional(),
  optional: z.boolean().optional(),
  description: z.string().optional(),
})

const RemoteMcpTokenPersistenceKindSchema = z.enum(['memory', 'system-keychain', 'external'])

const RemoteMcpTokenPersistenceSchema = z.object({
  kind: RemoteMcpTokenPersistenceKindSchema,
  key: z.string().optional(),
  note: z.string().optional(),
})

const RemoteMcpOauthClientAuthenticationSchema = z.enum(['client_secret_basic', 'client_secret_post', 'none'])

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

export const RemoteMcpAuthConfigSchema = z.discriminatedUnion('type', [
  RemoteMcpNoneAuthConfigSchema,
  RemoteMcpBearerEnvAuthConfigSchema,
  RemoteMcpStaticHeadersAuthConfigSchema,
  RemoteMcpOauthClientCredentialsAuthConfigSchema,
  RemoteMcpOauthRefreshTokenAuthConfigSchema,
])

export const ConfiguredRemoteMcpOptionsSchema = z.object({
  headers: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  auth: RemoteMcpAuthConfigSchema.optional(),
})

const RemoteMcpOptionsFields = {
  auth: z
    .object({
      type: z.literal('none'),
    })
    .passthrough()
    .optional(),
  headers: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
}

const CallToolModeSchema = z
  .object({
    mode: z.literal('call-tool'),
    url: z.string().min(1),
    tool: z.string().min(1),
    args: z.record(z.string(), z.unknown()),
    ...RemoteMcpOptionsFields,
  })
  .describe('Call a tool on a remote MCP server')

const ListToolsModeSchema = z
  .object({
    mode: z.literal('list-tools'),
    url: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('List available tools from a remote MCP server')

const ListPromptsModeSchema = z
  .object({
    mode: z.literal('list-prompts'),
    url: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('List available prompts from a remote MCP server')

const GetPromptModeSchema = z
  .object({
    mode: z.literal('get-prompt'),
    url: z.string().min(1),
    name: z.string().min(1),
    args: z.record(z.string(), z.string()).optional(),
    ...RemoteMcpOptionsFields,
  })
  .describe('Get a specific prompt from a remote MCP server')

const ListResourcesModeSchema = z
  .object({
    mode: z.literal('list-resources'),
    url: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('List available resources from a remote MCP server')

const ReadResourceModeSchema = z
  .object({
    mode: z.literal('read-resource'),
    url: z.string().min(1),
    uri: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('Read a resource from a remote MCP server by URI')

const DiscoverModeSchema = z
  .object({
    mode: z.literal('discover'),
    url: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('Discover all capabilities (tools, prompts, resources) from a remote MCP server')

export const McpClientInputSchema = z
  .discriminatedUnion('mode', [
    CallToolModeSchema,
    ListToolsModeSchema,
    ListPromptsModeSchema,
    GetPromptModeSchema,
    ListResourcesModeSchema,
    ReadResourceModeSchema,
    DiscoverModeSchema,
  ])
  .describe('MCP client operation to perform')

const CallToolOutputSchema = z
  .object({
    mode: z.literal('call-tool'),
    result: z
      .object({
        content: z.array(
          z
            .object({
              type: z.string(),
              text: z.string().optional(),
            })
            .passthrough(),
        ),
        isError: z.boolean().optional(),
      })
      .describe('Result from calling a tool'),
  })
  .describe('call-tool mode output')

const ListToolsOutputSchema = z.object({
  mode: z.literal('list-tools'),
  result: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        inputSchema: z.record(z.string(), z.unknown()),
      }),
    )
    .describe('List of available tools'),
})

const ListPromptsOutputSchema = z.object({
  mode: z.literal('list-prompts'),
  result: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        arguments: z
          .array(
            z.object({
              name: z.string(),
              description: z.string().optional(),
              required: z.boolean().optional(),
            }),
          )
          .optional(),
      }),
    )
    .describe('List of available prompts'),
})

const GetPromptOutputSchema = z.object({
  mode: z.literal('get-prompt'),
  result: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z
          .object({
            type: z.string(),
            text: z.string().optional(),
          })
          .passthrough(),
      }),
    )
    .describe('Prompt messages'),
})

const ListResourcesOutputSchema = z.object({
  mode: z.literal('list-resources'),
  result: z
    .array(
      z.object({
        uri: z.string(),
        name: z.string(),
        description: z.string().optional(),
        mimeType: z.string().optional(),
      }),
    )
    .describe('List of available resources'),
})

const ReadResourceOutputSchema = z.object({
  mode: z.literal('read-resource'),
  result: z
    .array(
      z.object({
        uri: z.string(),
        text: z.string().optional(),
        blob: z.string().optional(),
        mimeType: z.string().optional(),
      }),
    )
    .describe('Resource content'),
})

const DiscoverOutputSchema = z.object({
  mode: z.literal('discover'),
  result: z
    .object({
      tools: z.array(z.any()),
      prompts: z.array(z.any()),
      resources: z.array(z.any()),
    })
    .describe('All server capabilities'),
})

export const McpClientOutputSchema = z
  .discriminatedUnion('mode', [
    CallToolOutputSchema,
    ListToolsOutputSchema,
    ListPromptsOutputSchema,
    GetPromptOutputSchema,
    ListResourcesOutputSchema,
    ReadResourceOutputSchema,
    DiscoverOutputSchema,
  ])
  .describe('MCP client operation result')
