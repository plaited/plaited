/**
 * Output schemas for MCP client results.
 *
 * @remarks
 * Kept for Zod validation of MCP responses. Input schemas
 * (CLI-specific discriminated union) are not needed here —
 * the session API uses typed function signatures.
 *
 * @public
 */

import * as z from 'zod'

// ── Content & Tool schemas ──

export const McpContentSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough()

export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()),
})

// ── Prompt schemas ──

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

// ── Resource schemas ──

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

// ── Composite output schemas ──

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
