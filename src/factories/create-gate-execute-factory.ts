import { AGENT_EVENTS, RISK_TAG } from '../agent/agent.constants.ts'
import type { ToolDefinition } from '../agent/agent.schemas.ts'
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
import { composedGateCheck } from '../agent/gate.ts'
import type { GateExecuteFactoryCreator } from './factories.types.ts'

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
  ({ tools, toolExecutor, constitutionPredicates = [] }) =>
  ({ trigger }) => ({
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

      async [AGENT_EVENTS.execute](detail: unknown) {
        const execute = detail as ExecuteDetail
        const startedAt = Date.now()

        try {
          const output = await toolExecutor(execute.toolCall, AbortSignal.timeout(120_000))
          trigger({
            type: AGENT_EVENTS.tool_result,
            detail: {
              result: toToolResult(
                execute.toolCall,
                {
                  toolCallId: execute.toolCall.id,
                  name: execute.toolCall.name,
                  status: 'completed',
                  output,
                },
                Date.now() - startedAt,
              ),
            } satisfies ToolResultDetail,
          })
        } catch (error) {
          trigger({
            type: AGENT_EVENTS.tool_result,
            detail: {
              result: toToolResult(execute.toolCall, error, Date.now() - startedAt),
            } satisfies ToolResultDetail,
          })
        }
      },
    },
  })
