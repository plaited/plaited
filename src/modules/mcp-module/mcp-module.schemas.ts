import * as z from 'zod'
import { McpManifestSchema } from './mcp.schemas.ts'

export const McpCapabilityProjectionSchema = z.object({
  serverName: z.string().min(1),
  toolNames: z.array(z.string()),
  promptNames: z.array(z.string()),
  resourceNames: z.array(z.string()),
})
export type McpCapabilityProjection = z.infer<typeof McpCapabilityProjectionSchema>

export const McpInvocationRecordSchema = z.object({
  serverName: z.string().min(1),
  capabilityName: z.string().min(1),
  kind: z.enum(['tool', 'prompt', 'resource']),
  status: z.enum(['success', 'error']),
  timestamp: z.number().int().nonnegative(),
})
export type McpInvocationRecord = z.infer<typeof McpInvocationRecordSchema>

export const McpRegisteredServerSchema = z.object({
  name: z.string().min(1),
  manifest: McpManifestSchema,
  projection: McpCapabilityProjectionSchema,
})
export type McpRegisteredServer = z.infer<typeof McpRegisteredServerSchema>

export const McpModuleStateSchema = z.object({
  servers: z.array(McpRegisteredServerSchema),
  recentCalls: z.array(McpInvocationRecordSchema),
})
export type McpModuleState = z.infer<typeof McpModuleStateSchema>

export const RegisterMcpServerDetailSchema = z.object({
  name: z.string().min(1),
  manifest: McpManifestSchema,
})

export const RecordMcpCallDetailSchema = z.object({
  serverName: z.string().min(1),
  capabilityName: z.string().min(1),
  kind: z.enum(['tool', 'prompt', 'resource']),
  status: z.enum(['success', 'error']),
})
