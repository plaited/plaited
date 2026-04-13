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
export type McpServerCapabilitiesOutput = z.infer<typeof McpServerCapabilitiesSchema>
/** @public */
export type McpToolOutput = z.infer<typeof McpToolSchema>
