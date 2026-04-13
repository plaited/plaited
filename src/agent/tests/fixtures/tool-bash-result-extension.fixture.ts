import { useExtension } from '../../../behavioral.ts'
import { AGENT_CORE, AGENT_CORE_EVENTS } from '../../agent.constants.ts'
import { ToolBashResultDetailSchema } from '../../agent.schemas.ts'

const TOOL_BASH_RESULTS_KEY = '__plaitedAgentCoreToolBashResults'
const TOOL_BASH_RESULT_SEEN = 'tool_bash_result_seen'
const CORE_TOOL_BASH_RESULT_EVENT_TYPE = `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_result}`

export const toolBashResultExtensionFixture = useExtension(
  'agent_core_tool_bash_result_fixture',
  ({ bThread, bSync, memory }) => {
    bThread({
      label: 'captureCoreToolBashResult',
      rules: [
        bSync({
          waitFor: {
            type: CORE_TOOL_BASH_RESULT_EVENT_TYPE,
            detailSchema: ToolBashResultDetailSchema,
          },
        }),
        bSync({
          request: {
            type: TOOL_BASH_RESULT_SEEN,
          },
        }),
      ],
      repeat: true,
    })

    return {
      [TOOL_BASH_RESULT_SEEN]() {
        const state = globalThis as Record<string, unknown>
        const current = state[TOOL_BASH_RESULTS_KEY]
        const results = Array.isArray(current) ? [...current] : []
        const detail = ToolBashResultDetailSchema.parse(memory.get(CORE_TOOL_BASH_RESULT_EVENT_TYPE)?.body)
        results.push(detail)
        state[TOOL_BASH_RESULTS_KEY] = results
      },
    }
  },
)
