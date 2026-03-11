import * as z from 'zod'

// ============================================================================
// Shared Fields
// ============================================================================

const urlField = z.string().describe('MCP server endpoint URL')
const headersField = z.record(z.string(), z.string()).optional().describe('Custom HTTP headers (e.g., Authorization)')

// ============================================================================
// Per-Method Input Schemas
// ============================================================================

export const DiscoverInputSchema = z.object({
  method: z.literal('discover'),
  url: urlField,
  headers: headersField,
})

export const ListToolsInputSchema = z.object({
  method: z.literal('list-tools'),
  url: urlField,
  headers: headersField,
})

export const CallToolInputSchema = z.object({
  method: z.literal('call-tool'),
  url: urlField,
  toolName: z.string().describe('Name of the tool to invoke'),
  arguments: z.record(z.string(), z.unknown()).optional().describe('Tool arguments'),
  headers: headersField,
})

export const ListPromptsInputSchema = z.object({
  method: z.literal('list-prompts'),
  url: urlField,
  headers: headersField,
})

export const GetPromptInputSchema = z.object({
  method: z.literal('get-prompt'),
  url: urlField,
  name: z.string().describe('Prompt name'),
  arguments: z.record(z.string(), z.string()).optional().describe('Prompt arguments'),
  headers: headersField,
})

export const ListResourcesInputSchema = z.object({
  method: z.literal('list-resources'),
  url: urlField,
  headers: headersField,
})

export const ReadResourceInputSchema = z.object({
  method: z.literal('read-resource'),
  url: urlField,
  uri: z.string().describe('Resource URI'),
  headers: headersField,
})

// ============================================================================
// Discriminated Union Input Schema
// ============================================================================

export const RemoteMcpClientInputSchema = z.discriminatedUnion('method', [
  DiscoverInputSchema,
  ListToolsInputSchema,
  CallToolInputSchema,
  ListPromptsInputSchema,
  GetPromptInputSchema,
  ListResourcesInputSchema,
  ReadResourceInputSchema,
])

export type RemoteMcpClientInput = z.infer<typeof RemoteMcpClientInputSchema>

// ============================================================================
// Output Schemas
// ============================================================================

const McpContentSchema = z
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

const McpPromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: McpContentSchema,
})

const McpResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
})

const McpResourceContentSchema = z.object({
  uri: z.string(),
  text: z.string().optional(),
  blob: z.string().optional(),
  mimeType: z.string().optional(),
})

export const DiscoverOutputSchema = z.object({
  tools: z.array(McpToolSchema),
  prompts: z.array(McpPromptSchema),
  resources: z.array(McpResourceSchema),
})

export const ListToolsOutputSchema = z.object({
  tools: z.array(McpToolSchema),
})

export const CallToolOutputSchema = z.object({
  content: z.array(McpContentSchema),
  isError: z.boolean().optional(),
})

export const ListPromptsOutputSchema = z.object({
  prompts: z.array(McpPromptSchema),
})

export const GetPromptOutputSchema = z.object({
  messages: z.array(McpPromptMessageSchema),
})

export const ListResourcesOutputSchema = z.object({
  resources: z.array(McpResourceSchema),
})

export const ReadResourceOutputSchema = z.object({
  contents: z.array(McpResourceContentSchema),
})
