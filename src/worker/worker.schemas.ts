import * as z from 'zod'
import { WORKER_COMMAND_TYPES, WORKER_MESSAGE_TYPES } from './worker.constants.ts'

export const ShellCommandSchema = z.object({
  type: z.literal(WORKER_COMMAND_TYPES.shell),
  detail: z.object({
    id: z.string(),
    command: z.array(z.string()),
    cwd: z.string(),
    timeoutMs: z.number().optional(),
    maxOutputBytes: z.number().optional(),
  }),
})

export type ShellCommand = z.infer<typeof ShellCommandSchema>

export const ShellMessageSchema = z.object({
  type: z.literal(WORKER_MESSAGE_TYPES.shell_result),
  detail: z.object({
    id: z.string(),
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
  }),
})

export type ShellMessage = z.infer<typeof ShellMessageSchema>

export const ReadCommandSchema = z.object({
  type: z.literal(WORKER_COMMAND_TYPES.read),
  detail: z.object({
    id: z.string(),
    cwd: z.string(),
    path: z.string(),
    encoding: z.enum(['utf8', 'bytes']).optional().default('utf8'),
    maxBytes: z.number().int().positive().optional(),
  }),
})

export type ReadCommand = z.infer<typeof ReadCommandSchema>

export const ReadMessageSchema = z.object({
  type: z.literal(WORKER_MESSAGE_TYPES.read_result),
  detail: z.object({
    id: z.string(),
    cwd: z.string(),
    path: z.string(),
    encoding: z.enum(['utf8', 'bytes']),
    content: z.string(),
    bytes: z.number().int(),
    truncated: z.boolean(),
  }),
})

export type ReadMessage = z.infer<typeof ReadMessageSchema>

export const WriteCommandSchema = z.object({
  type: z.literal(WORKER_COMMAND_TYPES.write),
  detail: z.object({
    id: z.string(),
    cwd: z.string(),
    path: z.string(),
    content: z.string(),
    encoding: z.enum(['utf8', 'base64']).optional().default('utf8'),
  }),
})

export type WriteCommand = z.infer<typeof WriteCommandSchema>

export const WriteMessageSchema = z.object({
  type: z.literal(WORKER_MESSAGE_TYPES.write_result),
  detail: z.object({
    id: z.string(),
    cwd: z.string(),
    path: z.string(),
    encoding: z.enum(['utf8', 'base64']),
    bytes: z.number().int(),
  }),
})

export type WriteMessage = z.infer<typeof WriteMessageSchema>

export const RuntimeErrorMessageSchema = z.object({
  type: z.literal(WORKER_MESSAGE_TYPES.runtime_error),
  detail: z.object({
    error: z.string(),
  }),
})

export type RuntimeErrorMessage = z.infer<typeof RuntimeErrorMessageSchema>

export const WorkerMessageSchema = z.discriminatedUnion('type', [
  ShellMessageSchema,
  ReadMessageSchema,
  WriteMessageSchema,
  RuntimeErrorMessageSchema,
])

export type WorkerMessage = z.infer<typeof WorkerMessageSchema>

export const WorkerCommandSchema = z.discriminatedUnion('type', [
  ShellCommandSchema,
  ReadCommandSchema,
  WriteCommandSchema,
])
