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

export const McpManifestServerSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  transport: z.string().optional(),
})

export const McpManifestCapabilitiesSchema = z.object({
  tools: z.union([z.record(z.string(), McpToolSchema), z.array(McpToolSchema)]).default([]),
  prompts: z.union([z.record(z.string(), McpPromptSchema), z.array(McpPromptSchema)]).default([]),
  resources: z.union([z.record(z.string(), McpResourceSchema), z.array(McpResourceSchema)]).default([]),
})

export const McpManifestSchema = z.object({
  server: McpManifestServerSchema.optional(),
  capabilities: McpManifestCapabilitiesSchema,
})

export type McpCallToolResultOutput = z.infer<typeof McpCallToolResultSchema>
export type McpContentOutput = z.infer<typeof McpContentSchema>
export type McpManifestCapabilitiesOutput = z.infer<typeof McpManifestCapabilitiesSchema>
export type McpManifestOutput = z.infer<typeof McpManifestSchema>
export type McpManifestServerOutput = z.infer<typeof McpManifestServerSchema>
export type McpPromptMessageOutput = z.infer<typeof McpPromptMessageSchema>
export type McpPromptOutput = z.infer<typeof McpPromptSchema>
export type McpResourceContentOutput = z.infer<typeof McpResourceContentSchema>
export type McpResourceOutput = z.infer<typeof McpResourceSchema>
export type McpServerCapabilitiesOutput = z.infer<typeof McpServerCapabilitiesSchema>
export type McpToolOutput = z.infer<typeof McpToolSchema>
