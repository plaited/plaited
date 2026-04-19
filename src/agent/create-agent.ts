import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as z from 'zod'
import { behavioral, isExtension, SNAPSHOT_MESSAGE_KINDS, useExtension, useInstaller } from '../behavioral.ts'
import * as modules from '../modules.ts'
import { AGENT_CORE, AGENT_CORE_EVENTS } from './agent.constants.ts'
import {
  type ToolBashApprovedDetail,
  ToolBashApprovedDetailSchema,
  type ToolBashDeniedDetail,
  ToolBashDeniedDetailSchema,
  type ToolBashRequestDetail,
  ToolBashRequestDetailSchema,
  type ToolBashResultDetail,
  ToolBashResultDetailSchema,
} from './agent.schemas.ts'
import type { CreateAgentOptions } from './agent.types.ts'

const MAX_CONSUMED_TOOL_BASH_REQUEST_IDS = 10_000
const MAX_TOOL_BASH_OUTPUT_BYTES = 64 * 1024

type BoundedStreamReadResult = {
  text: string
  truncated: boolean
}

const readStreamToBoundedText = async (
  stream: ReadableStream<Uint8Array> | null | undefined,
): Promise<BoundedStreamReadResult> => {
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

      const remainingBytes = MAX_TOOL_BASH_OUTPUT_BYTES - totalBytes
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

/**
 * Creates the minimal agent core around the behavioral engine.
 *
 * @remarks
 * The core owns only:
 * - behavioral engine setup
 * - host trigger ingress
 * - disconnect cleanup
 * - installation of executable extensions
 *
 * Everything richer should be layered on through extensions.
 *
 * @public
 */
export const createAgent = async ({ maxKeys, ttlMs, workspace }: CreateAgentOptions) => {
  const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
  const installer = useInstaller({ trigger, useSnapshot, reportSnapshot, addBThread, ttlMs, maxKeys })

  const workspaceRoot = resolve(workspace)
  const resolveWorkspacePath = (detail: string) => {
    const resolved = resolve(workspaceRoot, detail)
    if (resolved !== workspaceRoot && !resolved.startsWith(`${workspaceRoot}${sep}`)) {
      throw new Error(`Path "${detail}" resolves outside workspace "${workspaceRoot}"`)
    }
    return resolved
  }

  const coreExtension = useExtension(AGENT_CORE, ({ bThread, bSync }) => {
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
    bThread({
      label: 'onUpdateModules',
      rules: [
        bSync({
          block: {
            type: AGENT_CORE_EVENTS.update_modules,
            detailSchema: z.string(),
            detailMatch: 'invalid',
          },
        }),
      ],
      repeat: true,
    })
    return {
      async [AGENT_CORE_EVENTS.update_modules](detail: string) {
        const moduleExports = await import(pathToFileURL(resolveWorkspacePath(detail)).href)
        for (const value of Object.values(moduleExports)) {
          if (isExtension(value)) useFeedback(installer(value))
        }
      },
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
      [AGENT_CORE_EVENTS.tool_bash_approved](detail: ToolBashApprovedDetail) {
        if (!pendingToolBashRequestIds.has(detail.requestId)) {
          return
        }
        pendingToolBashRequestIds.delete(detail.requestId)
        addConsumedToolBashRequestId(detail.requestId)
      },
      [AGENT_CORE_EVENTS.tool_bash_denied](detail: ToolBashDeniedDetail) {
        if (!pendingToolBashRequestIds.has(detail.requestId)) {
          return
        }
        pendingToolBashRequestIds.delete(detail.requestId)
        addConsumedToolBashRequestId(detail.requestId)
      },
      // Internal execution event only. External extension callers should use tool_bash_request.
      async [AGENT_CORE_EVENTS.bash](detail: ToolBashRequestDetail) {
        let result: ToolBashResultDetail

        try {
          const process = Bun.spawn(['bun', resolveWorkspacePath(detail.bash.path), ...detail.bash.args], {
            cwd: workspaceRoot,
            ...(detail.bash.timeout !== undefined && { signal: AbortSignal.timeout(detail.bash.timeout) }),
            stdout: 'pipe',
            stderr: 'pipe',
          })

          const [exitCode, stdoutResult, stderrResult] = await Promise.all([
            process.exited,
            readStreamToBoundedText(process.stdout),
            readStreamToBoundedText(process.stderr),
          ])

          result = ToolBashResultDetailSchema.parse({
            requestId: detail.requestId,
            correlationId: detail.correlationId,
            exitCode,
            stdout: stdoutResult.text,
            stderr: stderrResult.text,
            ...(stdoutResult.truncated && { stdoutTruncated: true }),
            ...(stderrResult.truncated && { stderrTruncated: true }),
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
          type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_result}`,
          detail: result,
        })
      },
    }
  })

  for (const extension of [coreExtension, ...Object.values(modules)]) {
    if (isExtension(extension)) useFeedback(installer(extension))
  }

  return trigger
}
