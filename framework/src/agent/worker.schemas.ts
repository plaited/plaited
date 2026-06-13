import * as z from 'zod'

import { WORKER_COMMAND_TYPES, WORKER_MESSAGE_TYPES } from './worker.constants.ts'

export const ExecDetailSchema = z
  .object({
    topic: z.string(),
    cwd: z.string(),
    command: z.string(),
    subCommand: z.string(),
    args: z.array(z.string()).optional(),
    output: z.enum(['json', 'text']),
    id: z.string(),
  })
  .describe('Exec command detail — script (json) or raw (args), never both.')

export type ExecDetail = z.infer<typeof ExecDetailSchema>

export const ExecCommandSchema = z.object({
  type: z.literal(WORKER_COMMAND_TYPES.exec),
  detail: ExecDetailSchema,
})

export type ExecCommand = z.infer<typeof ExecCommandSchema>

export const ExecMessageSchema = z.object({
  type: z.literal(WORKER_MESSAGE_TYPES.exec_result),
  detail: z.object({
    topic: z.string(),
    id: z.string(),
    result: z.union([z.string(), z.json()]),
    durationMs: z.number(),
  }),
})

export type ExecMessage = z.infer<typeof ExecMessageSchema>

export const ReadCommandSchema = z.object({
  type: z.literal(WORKER_COMMAND_TYPES.read),
  detail: z.object({
    topic: z.string(),
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
    topic: z.string(),
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
    topic: z.string(),
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
    topic: z.string(),
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
  ExecMessageSchema,
  ReadMessageSchema,
  WriteMessageSchema,
  RuntimeErrorMessageSchema,
])

export type WorkerMessage = z.infer<typeof WorkerMessageSchema>

export const WorkerCommandSchema = z.discriminatedUnion('type', [
  ExecCommandSchema,
  ReadCommandSchema,
  WriteCommandSchema,
])
