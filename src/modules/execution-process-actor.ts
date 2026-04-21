import { resolve, sep } from 'node:path'
import * as z from 'zod'
import { AGENT_CORE, AGENT_CORE_EVENTS } from '../agent/agent.constants.ts'
import {
  ToolBashApprovedDetailSchema,
  ToolBashDeniedDetailSchema,
  type ToolBashRequestDetail,
  ToolBashRequestDetailSchema,
  type ToolBashResultDetail,
  ToolBashResultDetailSchema,
} from '../agent/agent.schemas.ts'
import { type DefaultHandlers, type ExtensionParams, SNAPSHOT_MESSAGE_KINDS, useExtension } from '../behavioral.ts'
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

const MAX_CONSUMED_TOOL_BASH_REQUEST_IDS = 10_000

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

type CreateAgentCoreExecutionProcessHandlersOptions = Pick<
  ExtensionParams,
  'bSync' | 'bThread' | 'reportSnapshot' | 'trigger'
> & {
  workspaceRoot: string
  resolveWorkspacePath: (path: string) => string
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

export const createAgentCoreExecutionProcessHandlers = ({
  bSync,
  bThread,
  reportSnapshot,
  resolveWorkspacePath,
  trigger,
  workspaceRoot,
}: CreateAgentCoreExecutionProcessHandlersOptions): DefaultHandlers => {
  const pendingToolBashRequestIds = new Set<string>()
  const consumedToolBashRequestIds = new Set<string>()

  const addConsumedToolBashRequestId = (requestId: string) => {
    consumedToolBashRequestIds.add(requestId)
    while (consumedToolBashRequestIds.size > MAX_CONSUMED_TOOL_BASH_REQUEST_IDS) {
      const oldestRequestId = consumedToolBashRequestIds.values().next().value
      if (!oldestRequestId) {
        break
      }
      consumedToolBashRequestIds.delete(oldestRequestId)
    }
  }

  const reportIgnoredToolBashRequest = ({ requestId, reason }: { requestId: string; reason: string }) => {
    reportSnapshot({
      kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
      id: AGENT_CORE,
      error: `Ignored tool_bash_request for requestId "${requestId}": ${reason}.`,
    })
  }

  bThread({
    label: 'onBash',
    rules: [
      bSync({
        // Internal execution event only. Extensions should emit tool_bash_request.
        block: {
          type: AGENT_CORE_EVENTS.bash,
          detailSchema: ToolBashRequestDetailSchema,
          detailMatch: 'invalid',
        },
      }),
    ],
    repeat: true,
  })
  bThread({
    label: 'onToolBashRequest',
    rules: [
      bSync({
        block: {
          type: AGENT_CORE_EVENTS.tool_bash_request,
          detailSchema: ToolBashRequestDetailSchema,
          detailMatch: 'invalid',
        },
      }),
    ],
    repeat: true,
  })
  bThread({
    label: 'onToolBashApproved',
    rules: [
      bSync({
        block: {
          type: AGENT_CORE_EVENTS.tool_bash_approved,
          detailSchema: ToolBashApprovedDetailSchema,
          detailMatch: 'invalid',
        },
      }),
    ],
    repeat: true,
  })
  bThread({
    label: 'onToolBashDenied',
    rules: [
      bSync({
        block: {
          type: AGENT_CORE_EVENTS.tool_bash_denied,
          detailSchema: ToolBashDeniedDetailSchema,
          detailMatch: 'invalid',
        },
      }),
    ],
    repeat: true,
  })
  bThread({
    label: 'onToolBashResult',
    rules: [
      bSync({
        block: {
          type: AGENT_CORE_EVENTS.tool_bash_result,
          detailSchema: ToolBashResultDetailSchema,
          detailMatch: 'invalid',
        },
      }),
    ],
    repeat: true,
  })

  return {
    [AGENT_CORE_EVENTS.tool_bash_request](detail: ToolBashRequestDetail) {
      if (pendingToolBashRequestIds.has(detail.requestId)) {
        reportIgnoredToolBashRequest({
          requestId: detail.requestId,
          reason: 'duplicate pending requestId',
        })
        return
      }
      if (consumedToolBashRequestIds.has(detail.requestId)) {
        reportIgnoredToolBashRequest({
          requestId: detail.requestId,
          reason: 'requestId already consumed by one-shot policy',
        })
        return
      }
      pendingToolBashRequestIds.add(detail.requestId)

      const approvedSchema = ToolBashApprovedDetailSchema.extend({
        requestId: z.literal(detail.requestId),
      })
      const deniedSchema = ToolBashDeniedDetailSchema.extend({
        requestId: z.literal(detail.requestId),
      })

      bThread({
        label: `gateToolBash_${detail.requestId}`,
        rules: [
          bSync({
            waitFor: {
              type: AGENT_CORE_EVENTS.tool_bash_approved,
              detailSchema: approvedSchema,
            },
            interrupt: {
              type: AGENT_CORE_EVENTS.tool_bash_denied,
              detailSchema: deniedSchema,
            },
          }),
          bSync({
            request: {
              type: AGENT_CORE_EVENTS.bash,
              detail,
            },
          }),
        ],
      })
    },
    [AGENT_CORE_EVENTS.tool_bash_approved](detail: unknown) {
      const approvedDetail = ToolBashApprovedDetailSchema.parse(detail)
      if (!pendingToolBashRequestIds.has(approvedDetail.requestId)) {
        return
      }
      pendingToolBashRequestIds.delete(approvedDetail.requestId)
      addConsumedToolBashRequestId(approvedDetail.requestId)
    },
    [AGENT_CORE_EVENTS.tool_bash_denied](detail: unknown) {
      const deniedDetail = ToolBashDeniedDetailSchema.parse(detail)
      if (!pendingToolBashRequestIds.has(deniedDetail.requestId)) {
        return
      }
      pendingToolBashRequestIds.delete(deniedDetail.requestId)
      addConsumedToolBashRequestId(deniedDetail.requestId)
    },
    // Internal execution event only. External extension callers should use tool_bash_request.
    async [AGENT_CORE_EVENTS.bash](detail: ToolBashRequestDetail) {
      let result: ToolBashResultDetail
      try {
        const requestDetail = ExecutionProcessRequestDetailSchema.parse({
          requestId: detail.requestId,
          correlationId: detail.correlationId,
          command: 'bun',
          args: [resolveWorkspacePath(detail.bash.path), ...detail.bash.args],
          cwd: detail.bash.cwd ?? '.',
          ...(detail.bash.timeout !== undefined && { timeoutMs: detail.bash.timeout }),
        })

        const executionResultDetail = await executeExecutionProcessRequest({
          request: requestDetail,
          workspaceRoot,
        })

        result = ToolBashResultDetailSchema.parse({
          requestId: executionResultDetail.requestId,
          correlationId: executionResultDetail.correlationId,
          exitCode: executionResultDetail.exitCode,
          stdout: executionResultDetail.stdout,
          stderr: executionResultDetail.stderr,
          ...(executionResultDetail.stdoutTruncated && { stdoutTruncated: true }),
          ...(executionResultDetail.stderrTruncated && { stderrTruncated: true }),
          ...(executionResultDetail.error !== undefined && { error: executionResultDetail.error }),
        })
      } catch (error) {
        result = ToolBashResultDetailSchema.parse({
          requestId: detail.requestId,
          correlationId: detail.correlationId,
          exitCode: null,
          stdout: '',
          stderr: '',
          error: error instanceof Error ? error.message : String(error),
        })
      }

      trigger({
        type: AGENT_CORE_EVENTS.tool_bash_result,
        detail: result,
      })
    },
  }
}
