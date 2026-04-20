import * as z from 'zod'

/** @public */
export const BashDetailSchema = z.object({
  path: z.string().describe('Workspace-local path to the Bun worker module to execute'),
  args: z.array(z.string()).describe('Arguments to pass to the worker module'),
  cwd: z
    .string()
    .min(1)
    .optional()
    .describe('Optional workspace-relative current working directory for process execution'),
  timeout: z.number().optional().describe('Optional timeout in milliseconds'),
})

export type BashDetail = z.infer<typeof BashDetailSchema>

const CorrelationIdSchema = z.string().min(1).describe('Conversation/group correlation identifier')
const RequestIdSchema = z
  .string()
  .min(1)
  .describe('Unique one-shot request identifier for exact approval matching within an agent runtime')

/** @public */
export const ToolBashRequestDetailSchema = z.object({
  requestId: RequestIdSchema,
  correlationId: CorrelationIdSchema,
  bash: BashDetailSchema,
})

export type ToolBashRequestDetail = z.infer<typeof ToolBashRequestDetailSchema>

/** @public */
export const ToolBashApprovedDetailSchema = z.object({
  requestId: RequestIdSchema,
  correlationId: CorrelationIdSchema.optional(),
})

export type ToolBashApprovedDetail = z.infer<typeof ToolBashApprovedDetailSchema>

/** @public */
export const ToolBashDeniedDetailSchema = z.object({
  requestId: RequestIdSchema,
  correlationId: CorrelationIdSchema.optional(),
  reason: z.string().optional(),
})

export type ToolBashDeniedDetail = z.infer<typeof ToolBashDeniedDetailSchema>

/** @public */
export const ToolBashResultDetailSchema = z.object({
  requestId: RequestIdSchema,
  correlationId: CorrelationIdSchema,
  exitCode: z.number().int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  stdoutTruncated: z.boolean().optional(),
  stderrTruncated: z.boolean().optional(),
  error: z.string().optional(),
})

export type ToolBashResultDetail = z.infer<typeof ToolBashResultDetailSchema>
