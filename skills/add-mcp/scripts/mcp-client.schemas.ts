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

/**
 * Zod schema for {@link McpContent}.
 *
 * @public
 */
export const McpContentSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough()

/**
 * Zod schema for {@link McpTool}.
 *
 * @public
 */
export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()),
})

// ── Prompt schemas ──

/**
 * Zod schema for {@link McpPromptArgument}.
 *
 * @public
 */
export const McpPromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
})

/**
 * Zod schema for {@link McpPrompt}.
 *
 * @public
 */
export const McpPromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(McpPromptArgumentSchema).optional(),
})

/**
 * Zod schema for {@link McpPromptMessage}.
 *
 * @public
 */
export const McpPromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: McpContentSchema,
})

// ── Resource schemas ──

/**
 * Zod schema for {@link McpResource}.
 *
 * @public
 */
export const McpResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
})

/**
 * Zod schema for {@link McpResourceContent}.
 *
 * @public
 */
export const McpResourceContentSchema = z.object({
  uri: z.string(),
  text: z.string().optional(),
  blob: z.string().optional(),
  mimeType: z.string().optional(),
})

// ── Composite output schemas ──

/**
 * Zod schema for the output of {@link McpSession.discover}.
 *
 * @public
 */
export const DiscoverOutputSchema = z.object({
  tools: z.array(McpToolSchema),
  prompts: z.array(McpPromptSchema),
  resources: z.array(McpResourceSchema),
})

/**
 * Zod schema for the output of {@link McpSession.listTools}.
 *
 * @public
 */
export const ListToolsOutputSchema = z.object({
  tools: z.array(McpToolSchema),
})

/**
 * Zod schema for the output of {@link McpSession.callTool}.
 *
 * @public
 */
export const CallToolOutputSchema = z.object({
  content: z.array(McpContentSchema),
  isError: z.boolean().optional(),
})

/**
 * Zod schema for the output of {@link McpSession.listPrompts}.
 *
 * @public
 */
export const ListPromptsOutputSchema = z.object({
  prompts: z.array(McpPromptSchema),
})

/**
 * Zod schema for the output of {@link McpSession.getPrompt}.
 *
 * @public
 */
export const GetPromptOutputSchema = z.object({
  messages: z.array(McpPromptMessageSchema),
})

/**
 * Zod schema for the output of {@link McpSession.listResources}.
 *
 * @public
 */
export const ListResourcesOutputSchema = z.object({
  resources: z.array(McpResourceSchema),
})

/**
 * Zod schema for the output of {@link McpSession.readResource}.
 *
 * @public
 */
export const ReadResourceOutputSchema = z.object({
  contents: z.array(McpResourceContentSchema),
})
