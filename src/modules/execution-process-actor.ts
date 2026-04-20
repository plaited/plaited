import { resolve, sep } from 'node:path'
import * as z from 'zod'
import { useExtension } from '../behavioral.ts'
import { keyMirror } from '../utils.ts'

export const EXECUTION_PROCESS_ACTOR_ID = 'execution_process_actor'

export const EXECUTION_PROCESS_ACTOR_EVENTS = keyMirror('request', 'result')

export const toExecutionProcessActorEventType = <TEvent extends string>(
  event: TEvent,
): `${typeof EXECUTION_PROCESS_ACTOR_ID}:${TEvent}` => `${EXECUTION_PROCESS_ACTOR_ID}:${event}`

export const ExecutionProcessRequestDetailSchema = z.object({
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()),
  cwd: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
})

export type ExecutionProcessRequestDetail = z.infer<typeof ExecutionProcessRequestDetailSchema>

export const ExecutionProcessResultDetailSchema = z.object({
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  exitCode: z.number().int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  stdoutTruncated: z.boolean(),
  stderrTruncated: z.boolean(),
  error: z.string().optional(),
})

export type ExecutionProcessResultDetail = z.infer<typeof ExecutionProcessResultDetailSchema>

export const DEFAULT_EXECUTION_PROCESS_OUTPUT_BYTES = 64 * 1024

type BoundedStreamReadResult = {
  text: string
  truncated: boolean
}

type ExecuteExecutionProcessRequestParams = {
  request: ExecutionProcessRequestDetail
  workspaceRoot: string
  maxOutputBytes?: number
}

type CreateExecutionProcessActorExtensionOptions = {
  workspaceRoot: string
  maxOutputBytes?: number
}

const resolveWorkspaceRelativePath = ({
  workspaceRoot,
  relativePath,
}: {
  workspaceRoot: string
  relativePath: string
}) => {
  const resolvedPath = resolve(workspaceRoot, relativePath)
  if (resolvedPath !== workspaceRoot && !resolvedPath.startsWith(`${workspaceRoot}${sep}`)) {
    throw new Error(`Path "${relativePath}" resolves outside workspace "${workspaceRoot}"`)
  }
  return resolvedPath
}

const readStreamToBoundedText = async ({
  stream,
  maxOutputBytes,
}: {
  stream: ReadableStream<Uint8Array> | null | undefined
  maxOutputBytes: number
}): Promise<BoundedStreamReadResult> => {
  if (!stream) {
    return { text: '', truncated: false }
  }

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  const textDecoder = new TextDecoder()
  let totalBytes = 0
  let truncated = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (!value || value.byteLength === 0) {
        continue
      }

      const remainingBytes = maxOutputBytes - totalBytes
      if (remainingBytes <= 0) {
        truncated = true
        continue
      }

      if (value.byteLength <= remainingBytes) {
        chunks.push(value)
        totalBytes += value.byteLength
        continue
      }

      chunks.push(value.subarray(0, remainingBytes))
      totalBytes += remainingBytes
      truncated = true
    }
  } finally {
    reader.releaseLock()
  }

  const output = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }

  return {
    text: textDecoder.decode(output),
    truncated,
  }
}

export const executeExecutionProcessRequest = async ({
  request,
  workspaceRoot,
  maxOutputBytes = DEFAULT_EXECUTION_PROCESS_OUTPUT_BYTES,
}: ExecuteExecutionProcessRequestParams): Promise<ExecutionProcessResultDetail> => {
  let didTimeout = false
  const abortController = new AbortController()
  const timeoutHandle =
    request.timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          didTimeout = true
          abortController.abort()
        }, request.timeoutMs)

  try {
    const resolvedWorkspaceRoot = resolve(workspaceRoot)
    const resolvedCwd = resolveWorkspaceRelativePath({
      workspaceRoot: resolvedWorkspaceRoot,
      relativePath: request.cwd,
    })
    const process = Bun.spawn([request.command, ...request.args], {
      cwd: resolvedCwd,
      stdout: 'pipe',
      stderr: 'pipe',
      signal: abortController.signal,
    })

    const [exitCode, stdoutResult, stderrResult] = await Promise.all([
      process.exited,
      readStreamToBoundedText({
        stream: process.stdout,
        maxOutputBytes,
      }),
      readStreamToBoundedText({
        stream: process.stderr,
        maxOutputBytes,
      }),
    ])

    return ExecutionProcessResultDetailSchema.parse({
      requestId: request.requestId,
      correlationId: request.correlationId,
      exitCode: didTimeout ? null : exitCode,
      stdout: stdoutResult.text,
      stderr: stderrResult.text,
      stdoutTruncated: stdoutResult.truncated,
      stderrTruncated: stderrResult.truncated,
      ...(didTimeout && request.timeoutMs !== undefined
        ? { error: `Process timed out after ${request.timeoutMs}ms` }
        : {}),
    })
  } catch (error) {
    return ExecutionProcessResultDetailSchema.parse({
      requestId: request.requestId,
      correlationId: request.correlationId,
      exitCode: null,
      stdout: '',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false,
      error:
        didTimeout && request.timeoutMs !== undefined
          ? `Process timed out after ${request.timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error),
    })
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle)
    }
  }
}

export const createExecutionProcessActorExtension = ({
  workspaceRoot,
  maxOutputBytes = DEFAULT_EXECUTION_PROCESS_OUTPUT_BYTES,
}: CreateExecutionProcessActorExtensionOptions) =>
  useExtension(EXECUTION_PROCESS_ACTOR_ID, ({ trigger }) => {
    return {
      async [EXECUTION_PROCESS_ACTOR_EVENTS.request](detail: unknown) {
        const requestDetail = ExecutionProcessRequestDetailSchema.parse(detail)
        const resultDetail = await executeExecutionProcessRequest({
          request: requestDetail,
          workspaceRoot,
          maxOutputBytes,
        })

        trigger({
          type: EXECUTION_PROCESS_ACTOR_EVENTS.result,
          detail: resultDetail,
        })
      },
    }
  })
