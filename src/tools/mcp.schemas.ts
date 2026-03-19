import * as z from 'zod'

export const McpContentSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough()

export const McpCallToolResultSchema = z.object({
  content: z.array(McpContentSchema),
  isError: z.boolean().optional(),
})

export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()),
})

export const McpPromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
})

export const McpPromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(McpPromptArgumentSchema).optional(),
})

export const McpPromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: McpContentSchema,
})

export const McpResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
})

export const McpResourceContentSchema = z.object({
  uri: z.string(),
  text: z.string().optional(),
  blob: z.string().optional(),
  mimeType: z.string().optional(),
})

export const McpServerCapabilitiesSchema = z.object({
  tools: z.array(McpToolSchema),
  prompts: z.array(McpPromptSchema),
  resources: z.array(McpResourceSchema),
})

export const RemoteMcpCliOptionsSchema = z.object({
  headers: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
})

export const McpDiscoverInputSchema = z.object({
  url: z.string().url(),
  headers: RemoteMcpCliOptionsSchema.shape.headers,
  timeoutMs: RemoteMcpCliOptionsSchema.shape.timeoutMs,
})

export const McpListToolsInputSchema = McpDiscoverInputSchema

export const McpCallToolInputSchema = z.object({
  url: z.string().url(),
  toolName: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  headers: RemoteMcpCliOptionsSchema.shape.headers,
  timeoutMs: RemoteMcpCliOptionsSchema.shape.timeoutMs,
})

export const McpListPromptsInputSchema = McpDiscoverInputSchema

export const McpGetPromptInputSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1),
  args: z.record(z.string(), z.string()).optional(),
  headers: RemoteMcpCliOptionsSchema.shape.headers,
  timeoutMs: RemoteMcpCliOptionsSchema.shape.timeoutMs,
})

export const McpListResourcesInputSchema = McpDiscoverInputSchema

export const McpReadResourceInputSchema = z.object({
  url: z.string().url(),
  uri: z.string().min(1),
  headers: RemoteMcpCliOptionsSchema.shape.headers,
  timeoutMs: RemoteMcpCliOptionsSchema.shape.timeoutMs,
})

export type McpCallToolResultOutput = z.infer<typeof McpCallToolResultSchema>
export type McpContentOutput = z.infer<typeof McpContentSchema>
export type McpPromptMessageOutput = z.infer<typeof McpPromptMessageSchema>
export type McpPromptOutput = z.infer<typeof McpPromptSchema>
export type McpResourceContentOutput = z.infer<typeof McpResourceContentSchema>
export type McpResourceOutput = z.infer<typeof McpResourceSchema>
export type McpServerCapabilitiesOutput = z.infer<typeof McpServerCapabilitiesSchema>
export type McpToolOutput = z.infer<typeof McpToolSchema>
