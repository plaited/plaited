import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { defineBProgram } from '../../behavioral.js'
import { PUBLIC_EVENT_SCHEMAS, type PublicEventDetails } from './mcp-server.schemas.js'
import { PUBLIC_EVENTS } from './mcp-server.constants.js'
import { useRegisterTool } from './mcp-server.utils.js'

export const mcpServer = defineBProgram<
  PublicEventDetails,
  {
    server: McpServer
  }
>({
  async bProgram({ bThreads, server, trigger }) {
    bThreads.set({})
    const registerTool = useRegisterTool({ trigger, publicEvents: Object.values(PUBLIC_EVENTS), server })
    for (const [type, config] of Object.entries(PUBLIC_EVENT_SCHEMAS)) {
      registerTool(type, config)
    }
    return {
      async [PUBLIC_EVENTS.start_workshop]() {},
      async [PUBLIC_EVENTS.get_story_routes]() {},
    }
  },
})
