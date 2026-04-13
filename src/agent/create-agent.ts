import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as z from 'zod'
import {
  behavioral,
  isExtension,
  notSchema,
  SNAPSHOT_MESSAGE_KINDS,
  useExtension,
  useInstaller,
} from '../behavioral.ts'
import * as modules from '../modules.ts'
import { AGENT_CORE, AGENT_CORE_EVENTS } from './agent.constants.ts'
import {
  type BashDetail,
  BashDetailSchema,
  type ToolBashApprovedDetail,
  ToolBashApprovedDetailSchema,
  type ToolBashDeniedDetail,
  ToolBashDeniedDetailSchema,
  type ToolBashRequestDetail,
  ToolBashRequestDetailSchema,
} from './agent.schemas.ts'
import type { CreateAgentOptions } from './agent.types.ts'

const MAX_CONSUMED_TOOL_BASH_REQUEST_IDS = 10_000

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
          block: {
            type: AGENT_CORE_EVENTS.bash,
            detailSchema: notSchema(BashDetailSchema),
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
            detailSchema: notSchema(ToolBashRequestDetailSchema),
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
            detailSchema: notSchema(ToolBashApprovedDetailSchema),
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
            detailSchema: notSchema(ToolBashDeniedDetailSchema),
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
            detailSchema: notSchema(z.string()),
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
                detail: detail.bash,
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
      async [AGENT_CORE_EVENTS.bash](detail: BashDetail) {
        Bun.spawn(['bun', resolveWorkspacePath(detail.path), ...detail.args], {
          cwd: workspaceRoot,
          ...(detail.timeout !== undefined && { signal: AbortSignal.timeout(detail.timeout) }),
          stdout: 'pipe',
          stderr: 'pipe',
        })
      },
    }
  })

  for (const extension of [coreExtension, ...Object.values(modules)]) {
    if (isExtension(extension)) useFeedback(installer(extension))
  }

  return trigger
}
