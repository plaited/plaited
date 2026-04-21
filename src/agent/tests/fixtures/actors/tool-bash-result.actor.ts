import { useExtension } from '../../../../behavioral.ts'
import { AGENT_CORE, AGENT_CORE_EVENTS } from '../../../agent.constants.ts'
import { ToolBashResultDetailSchema } from '../../../agent.schemas.ts'

const TOOL_BASH_RESULTS_KEY = '__plaitedAgentCoreToolBashResults'
const TOOL_BASH_RESULT_SEEN = 'tool_bash_result_seen'
const CORE_TOOL_BASH_RESULT_EVENT_TYPE = `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_result}`

export default useExtension('agent_core_tool_bash_result_fixture', ({ memory }) => {
  return {
    [TOOL_BASH_RESULT_SEEN]() {
      const state = globalThis as Record<string, unknown>
      const current = state[TOOL_BASH_RESULTS_KEY]
      const results = Array.isArray(current) ? [...current] : []
      const detail = ToolBashResultDetailSchema.safeParse(memory.get(CORE_TOOL_BASH_RESULT_EVENT_TYPE)?.body)
      if (!detail.success) {
        return
      }
      results.push(detail.data)
      state[TOOL_BASH_RESULTS_KEY] = results
    },
  }
})
