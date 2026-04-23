import * as z from 'zod'

export const WorkerConnectDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
})

export type WorkerConnectDetail = z.infer<typeof WorkerConnectDetailSchema>

export const WorkerShellDetailSchema = z.object({
  id: z.string(),
  command: z.array(z.string()),
  cwd: z.string(),
  timeoutMs: z.number().optional(),
  maxOutputBytes: z.number().optional(),
})

export type WorkerShellDetail = z.infer<typeof WorkerShellDetailSchema>

export const WorkerShellResponseSchema = z.object({
  id: z.string(),
  ok: z.boolean(),
  exitCode: z.number().int().nullable(),
  signalCode: z.string().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  stdoutBytes: z.number().int(),
  stderrBytes: z.number().int(),
  stdoutTruncated: z.boolean(),
  stderrTruncated: z.boolean(),
  stdoutPath: z.string().nullable(),
  stderrPath: z.string().nullable(),
  durationMs: z.number(),
  timedOut: z.boolean(),
})

export type WorkerShellResponse = z.infer<typeof WorkerShellResponseSchema>

export const WorkerReadDetailSchema = z.object({
  id: z.string(),
  cwd: z.string(),
  path: z.string(),
  encoding: z.enum(['utf8', 'bytes']).optional().default('utf8'),
  maxBytes: z.number().int().positive().optional(),
})

export type WorkerReadDetail = z.infer<typeof WorkerReadDetailSchema>

export const WorkerReadResponseSchema = z.object({
  id: z.string(),
  ok: z.boolean(),
  cwd: z.string(),
  path: z.string(),
  encoding: z.enum(['utf8', 'bytes']),
  content: z.string(),
  bytes: z.number().int(),
  truncated: z.boolean(),
})

export type WorkerReadResponse = z.infer<typeof WorkerReadResponseSchema>

export const WorkerWriteDetailSchema = z.object({
  id: z.string(),
  cwd: z.string(),
  path: z.string(),
  content: z.string(),
  encoding: z.enum(['utf8', 'base64']).optional().default('utf8'),
})

export type WorkerWriteDetail = z.infer<typeof WorkerWriteDetailSchema>

export const WorkerWriteResponseSchema = z.object({
  id: z.string(),
  ok: z.boolean(),
  cwd: z.string(),
  path: z.string(),
  encoding: z.enum(['utf8', 'base64']),
  bytes: z.number().int(),
})
export type WorkerWriteResponse = z.infer<typeof WorkerWriteResponseSchema>
