import * as z from 'zod'
import { WORKER_EVENTS } from './worker.constants.ts'

export const ShellEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.shell),
  detail: z.object({
    id: z.string(),
    command: z.array(z.string()),
    cwd: z.string(),
    timeoutMs: z.number().optional(),
    maxOutputBytes: z.number().optional(),
  }),
})

export type ShellEvent = z.infer<typeof ShellEventSchema>

export const ShellResponseSchema = z.object({
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
})

export type ShellResponse = z.infer<typeof ShellResponseSchema>

export const ReadEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.read),
  detail: z.object({
    id: z.string(),
    cwd: z.string(),
    path: z.string(),
    encoding: z.enum(['utf8', 'bytes']).optional().default('utf8'),
    maxBytes: z.number().int().positive().optional(),
  }),
})

export type ReadEvent = z.infer<typeof ReadEventSchema>

export const ReadResponseSchema = z.object({
  id: z.string(),
  cwd: z.string(),
  path: z.string(),
  encoding: z.enum(['utf8', 'bytes']),
  content: z.string(),
  bytes: z.number().int(),
  truncated: z.boolean(),
})

export type ReadResponse = z.infer<typeof ReadResponseSchema>

export const WriteEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.write),
  detail: z.object({
    id: z.string(),
    cwd: z.string(),
    path: z.string(),
    content: z.string(),
    encoding: z.enum(['utf8', 'base64']).optional().default('utf8'),
  }),
})

export type WriteEvent = z.infer<typeof WriteEventSchema>

export const WriteResponseSchema = z.object({
  id: z.string(),
  cwd: z.string(),
  path: z.string(),
  encoding: z.enum(['utf8', 'base64']),
  bytes: z.number().int(),
})
export type WriteResponse = z.infer<typeof WriteResponseSchema>
