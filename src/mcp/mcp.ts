import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { useBehavioral } from '../main.js'
import { useRoots } from './hooks/use-roots.js'
import { BP_EVENTS } from './mcp.constants.js'

export const bServer = useBehavioral<
  {
    [BP_EVENTS.roots_list]: void
  },
  { mcp: McpServer }
>({
  async bProgram({ mcp, trigger, bThreads }) {
    const { server } = mcp

    server.oninitialized = () => {
      const clientCapabilities = server.getClientCapabilities()
      useRoots({
        roots: clientCapabilities?.roots,
        trigger,
        server,
        bThreads,
      })
    }

    return {
      async [BP_EVENTS.roots_list]() {
        const roots = await server.listRoots()
      },
    }
  },
})
