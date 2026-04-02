import * as z from 'zod'
import { AGENT_CORE_EVENTS, AGENT_EVENTS, RISK_TAG } from '../agent/agent.constants.ts'
import type { AgentToolCall, ToolDefinition } from '../agent/agent.schemas.ts'
import type {
  ContextReadyDetail,
  EvalApprovedDetail,
  EvalRejectedDetail,
  ExecuteDetail,
  GateApprovedDetail,
  GateRejectedDetail,
  ToolResultDetail,
} from '../agent/agent.types.ts'
import { toToolResult } from '../agent/agent.utils.ts'
import type { ConstitutionPredicate, GateExecuteFactoryCreator } from './factories.types.ts'

type GateRoute = 'execute' | 'simulate' | 'rejected'

type GateCheckResult = {
  route: GateRoute
  reason?: string
}

const composedGateCheck = (
  { toolCall, tags }: { toolCall: ContextReadyDetail['toolCall']; tags: string[] },
  constitutionPredicates: ConstitutionPredicate[] = [],
): GateCheckResult => {
  for (const predicate of constitutionPredicates) {
    if (predicate.check(toolCall)) {
      return { route: 'rejected', reason: `Blocked by ${predicate.name}` }
    }
  }

  const tagSet = new Set(tags)
  if (tagSet.size > 0 && [...tagSet].every((tag) => tag === RISK_TAG.workspace)) {
    return { route: 'execute' }
  }

  return { route: 'simulate' }
}

const routeApprovedToolCall = ({
  trigger,
  detail,
}: {
  trigger: (event: { type: string; detail?: unknown }) => void
  detail: GateApprovedDetail
}) => {
  const tagSet = new Set(detail.tags)
  if (tagSet.size > 0 && [...tagSet].every((tag) => tag === RISK_TAG.workspace)) {
    trigger({
      type: AGENT_EVENTS.execute,
      detail: {
        toolCall: detail.toolCall,
        tags: detail.tags,
      } satisfies ExecuteDetail,
    })
    return
  }

  trigger({
    type: AGENT_EVENTS.simulate_request,
    detail: {
      toolCall: detail.toolCall,
      tags: detail.tags,
    },
  })
}

const CORE_TOOL_EVENTS = new Set<string>([
  AGENT_CORE_EVENTS.read_file,
  AGENT_CORE_EVENTS.write_file,
  AGENT_CORE_EVENTS.delete_file,
  AGENT_CORE_EVENTS.glob_files,
  AGENT_CORE_EVENTS.grep,
  AGENT_CORE_EVENTS.bash,
])

const toCoreToolRequest = ({ name, arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
  switch (name) {
    case AGENT_CORE_EVENTS.read_file:
    case AGENT_CORE_EVENTS.delete_file:
      return args.path
    default:
      return args
  }
}

/**
 * Creates the default gate/execute factory promoted out of the legacy loop.
 *
 * @remarks
 * This factory owns:
 * - `context_ready`
 * - `gate_approved`
 * - `gate_rejected`
 * - `eval_approved`
 * - `eval_rejected`
 * - `execute`
 * - `tool_result`
 *
 * Simulation and evaluation factories can remain separate while still using
 * the same event vocabulary.
 *
 * @public
 */
export const createGateExecuteFactory: GateExecuteFactoryCreator =
  ({ tools, constitutionPredicates = [] }) =>
  ({ trigger, useSnapshot, signals }) => {
    const startedAtByToolCallId = new Map<string, number>()
    const pendingToolCallsByName = new Map<string, AgentToolCall[]>()

    useSnapshot((snapshot) => {
      if (snapshot.kind !== 'feedback_error') return
      if (!CORE_TOOL_EVENTS.has(snapshot.type)) return

      const pending = pendingToolCallsByName.get(snapshot.type) ?? []
      const toolCall = pending.shift()
      if (pending.length > 0) {
        pendingToolCallsByName.set(snapshot.type, pending)
      } else {
        pendingToolCallsByName.delete(snapshot.type)
      }
      if (!toolCall) return

      const startedAt = startedAtByToolCallId.get(toolCall.id) ?? Date.now()
      startedAtByToolCallId.delete(toolCall.id)

      trigger({
        type: AGENT_EVENTS.tool_result,
        detail: {
          result: toToolResult(toolCall, new Error(snapshot.error), Date.now() - startedAt),
        } satisfies ToolResultDetail,
      })
    })

    return {
      handlers: {
        [AGENT_EVENTS.context_ready](detail: unknown) {
          const { toolCall } = detail as ContextReadyDetail
          const tags = (tools.find((tool) => tool.function.name === toolCall.name)?.tags ?? []) as NonNullable<
            ToolDefinition['tags']
          >
          const result = composedGateCheck({ toolCall, tags }, constitutionPredicates)

          if (result.route === 'rejected') {
            trigger({
              type: AGENT_EVENTS.gate_rejected,
              detail: {
                toolCall,
                decision: {
                  approved: false,
                  tags: tags as GateRejectedDetail['decision']['tags'],
                  reason: result.reason,
                },
              } satisfies GateRejectedDetail,
            })
            return
          }

          trigger({
            type: AGENT_EVENTS.gate_approved,
            detail: {
              toolCall,
              tags,
            } satisfies GateApprovedDetail,
          })
        },

        [AGENT_EVENTS.gate_approved](detail: unknown) {
          routeApprovedToolCall({
            trigger,
            detail: detail as GateApprovedDetail,
          })
        },

        [AGENT_EVENTS.eval_approved](detail: unknown) {
          const approved = detail as EvalApprovedDetail
          trigger({
            type: AGENT_EVENTS.execute,
            detail: {
              toolCall: approved.toolCall,
              tags: approved.tags,
            } satisfies ExecuteDetail,
          })
        },

        [AGENT_EVENTS.eval_rejected](detail: unknown) {
          const rejected = detail as EvalRejectedDetail
          trigger({
            type: AGENT_EVENTS.message,
            detail: {
              content: `Eval rejected: ${rejected.reason}`,
            },
          })
        },

        [AGENT_EVENTS.execute](detail: unknown) {
          const execute = detail as ExecuteDetail
          startedAtByToolCallId.set(execute.toolCall.id, Date.now())
          const pending = pendingToolCallsByName.get(execute.toolCall.name) ?? []
          pending.push(execute.toolCall)
          pendingToolCallsByName.set(execute.toolCall.name, pending)

          if (!CORE_TOOL_EVENTS.has(execute.toolCall.name)) {
            startedAtByToolCallId.delete(execute.toolCall.id)
            trigger({
              type: AGENT_EVENTS.tool_result,
              detail: {
                result: toToolResult(
                  execute.toolCall,
                  new Error(`Unknown built-in tool: ${execute.toolCall.name}`),
                  Date.now() - (startedAtByToolCallId.get(execute.toolCall.id) ?? Date.now()),
                ),
              } satisfies ToolResultDetail,
            })
            return
          }

          const signalBackedTools = new Set<string>([
            AGENT_CORE_EVENTS.read_file,
            AGENT_CORE_EVENTS.write_file,
            AGENT_CORE_EVENTS.delete_file,
            AGENT_CORE_EVENTS.glob_files,
            AGENT_CORE_EVENTS.grep,
            AGENT_CORE_EVENTS.bash,
          ])

          if (signalBackedTools.has(execute.toolCall.name)) {
            const resultSignal = signals.set({
              key: `tool-result:${execute.toolCall.id}`,
              schema: z.unknown(),
              readOnly: false,
            })

            resultSignal.listen({
              eventType: `tool_result_ready:${execute.toolCall.id}`,
              trigger: () => {
                const pendingForResult = pendingToolCallsByName.get(execute.toolCall.name) ?? []
                const toolCall = pendingForResult.shift()
                if (pendingForResult.length > 0) {
                  pendingToolCallsByName.set(execute.toolCall.name, pendingForResult)
                } else {
                  pendingToolCallsByName.delete(execute.toolCall.name)
                }
                if (!toolCall) return

                const startedAt = startedAtByToolCallId.get(toolCall.id) ?? Date.now()
                startedAtByToolCallId.delete(toolCall.id)

                trigger({
                  type: AGENT_EVENTS.tool_result,
                  detail: {
                    result: {
                      toolCallId: toolCall.id,
                      name: toolCall.name,
                      status: 'completed',
                      output: resultSignal.get(),
                      duration: Date.now() - startedAt,
                    },
                  } satisfies ToolResultDetail,
                })
              },
              disconnectSet: new Set(),
            })

            trigger({
              type: execute.toolCall.name,
              detail: {
                input: toCoreToolRequest(execute.toolCall),
                signal: resultSignal,
              },
            })
            return
          }

          trigger({
            type: execute.toolCall.name,
            detail: execute.toolCall.arguments,
          })
        },

        [AGENT_CORE_EVENTS.agent_tool_result](detail: unknown) {
          const resultDetail = detail as { result: { name: string; output?: unknown } }
          const pending = pendingToolCallsByName.get(resultDetail.result.name) ?? []
          const toolCall = pending.shift()
          if (pending.length > 0) {
            pendingToolCallsByName.set(resultDetail.result.name, pending)
          } else {
            pendingToolCallsByName.delete(resultDetail.result.name)
          }
          if (!toolCall) return
          const startedAt = startedAtByToolCallId.get(toolCall.id) ?? Date.now()
          startedAtByToolCallId.delete(toolCall.id)

          trigger({
            type: AGENT_EVENTS.tool_result,
            detail: {
              result: {
                toolCallId: toolCall.id,
                name: toolCall.name,
                status: 'completed',
                output: resultDetail.result.output,
                duration: Date.now() - startedAt,
              },
            } satisfies ToolResultDetail,
          })
        },
      },
    }
  }
