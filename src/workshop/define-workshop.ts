import { useSignal, useComputed } from '../behavioral/use-signal.js'
import { keyMirror } from '../utils/key-mirror.js'
import { useServer } from './routing/use-server.js'
import { defineTesting } from './testing/define-testing.js'
import { defineBProgram } from '../behavioral/define-b-program.js'
import { MCP_EVENTS, MCP_TOOL_EVENTS } from './mcp/mcp.constants.js'
import type { MCPDetails, MCPRequestInfo, RouteInfo } from './mcp/mcp.types.js'
import { ListRoutesSchema, TestAllStoriesSchema, TestStorySetSchema } from './mcp/mcp.types.js'
import { resolveMCPRequest } from './mcp/mcp-promise-manager.js'

export type DefineWorkshopParams = {
  cwd: string
}

export const PUBLIC_EVENTS = keyMirror(
  'test_story_set',
  'test_all_stories',
  'get_play_story_sets',
  'get_file_routes',
  'set_current_working_directory',
  'set_test_background_style',
  'set_test_page_color_style',
  'set_design_tokens',
  'get_design_token_entry',
  'get_filtered_design_token_entries',
  'get_all_design_token_entries',
  'check_if_design_token_exist',
  'list_routes',
)

const PRIVATE_EVENTS = keyMirror('reload_server')

export type WorkshopDetails = {
  [PRIVATE_EVENTS.reload_server]: void
  [PUBLIC_EVENTS.list_routes]: void
  [PUBLIC_EVENTS.test_all_stories]: void
} & MCPDetails

export const defineWorkshop = defineBProgram<WorkshopDetails, DefineWorkshopParams>({
  publicEvents: [...Object.values(PUBLIC_EVENTS), ...Object.values(MCP_EVENTS), ...Object.values(MCP_TOOL_EVENTS)],
  async bProgram({ cwd, trigger, bThreads, bSync, bThread }) {
    const designTokens = useSignal<string>()

    const { reload, storyParamSet, reloadClients, server } = await useServer({
      cwd,
      designTokens,
    })

    const colorSchemeSupportSignal = useSignal(false)

    await defineTesting({
      colorSchemeSupportSignal,
      serverURL: server.url,
      storyParamSet,
    })

    // Register server cleanup
    trigger.addDisconnectCallback(() => {
      server.stop(true)
    })

    // MCP coordination signals
    const pendingMCPRequestsSignal = useSignal<Map<string, MCPRequestInfo>>(new Map())
    const routesDataSignal = useSignal<RouteInfo[]>([])

    // Computed signal for automatic MCP responses (no conditionals - pure coordination)
    const mcpResponseSignal = useComputed(() => {
      const routes = routesDataSignal.get()
      const pending = pendingMCPRequestsSignal.get()

      const responses = []

      // Match available data with pending requests using behavioral coordination
      for (const [requestId, requestInfo] of pending) {
        const dataMatchers = {
          list_routes: () => (routes.length > 0 ? { routes } : null),
          test_all_stories: () => null, // Future: match test data when available
          test_story_set: () => null, // Future: match test data when available
        }

        const matcher = dataMatchers[requestInfo.toolName as keyof typeof dataMatchers]
        const data = matcher?.()
        if (data) {
          responses.push({ requestId, data })
        }
      }

      return responses
    }, [routesDataSignal, pendingMCPRequestsSignal])

    // Note: Automatic response triggering commented out to prevent infinite loops
    // The computed signal will update when routes are available, but we'll handle responses manually
    // mcpResponseSignal.listen(MCP_EVENTS.MCP_RESPONSE, trigger as any)

    const schemas = {
      list_routes: ListRoutesSchema,
      test_all_stories: TestAllStoriesSchema,
      test_story_set: TestStorySetSchema,
    }

    // Reusable MCP request handler (like handleFailure in testing)
    const handleMCPRequest = async (toolName: keyof typeof schemas, params: unknown, requestId: string) => {
      try {
        const validatedParams = schemas[toolName]?.parse(params) ?? params

        // Add to pending requests
        const pending = pendingMCPRequestsSignal.get()
        pending.set(requestId, { toolName, params: validatedParams, timestamp: Date.now() })
        pendingMCPRequestsSignal.set(new Map(pending))

        return validatedParams
      } catch (error) {
        // Handle validation error
        trigger({
          type: MCP_EVENTS.mcp_response,
          detail: [{ requestId, error: (error as Error).message }],
        })
        throw error
      }
    }

    // B-threads for MCP coordination
    bThreads.set({
      mcpListRoutesCoordinator: bThread(
        [
          bSync({ waitFor: (event) => event.type === MCP_TOOL_EVENTS.mcp_list_routes }),
          bSync({ request: { type: PUBLIC_EVENTS.list_routes } }),
        ],
        true,
      ),

      mcpTestAllStoriesCoordinator: bThread(
        [
          bSync({ waitFor: (event) => event.type === MCP_TOOL_EVENTS.mcp_test_all_stories }),
          bSync({ request: { type: PUBLIC_EVENTS.test_all_stories } }),
        ],
        true,
      ),

      mcpTestStorySetCoordinator: bThread(
        [
          bSync({ waitFor: (event) => event.type === MCP_TOOL_EVENTS.mcp_test_story_set }),
          bSync({ request: { type: PUBLIC_EVENTS.test_story_set } }),
        ],
        true,
      ),
    })

    if (process.execArgv.includes('--hot')) {
      reloadClients()
    }
    return {
      // Existing handlers (enhanced to populate data signals)
      async [PUBLIC_EVENTS.test_all_stories]() {
        storyParamSet.set(new Set(storyParamSet.get()))
      },
      async [PRIVATE_EVENTS.reload_server]() {
        await reload()
      },
      async [PUBLIC_EVENTS.list_routes]() {
        const routes: RouteInfo[] = []
        for (const { route, filePath } of storyParamSet.get()) {
          const href = new URL(route, server.url).href
          routes.push({ filePath, href })
          console.log(`${filePath}:\n  ${href}`) // Original behavior preserved
        }
        routesDataSignal.set(routes) // Populate signal for MCP coordination

        // Check for pending MCP requests and trigger responses manually
        const pending = pendingMCPRequestsSignal.get()
        const responses = []
        for (const [requestId, requestInfo] of pending) {
          if (requestInfo.toolName === 'list_routes' && routes.length > 0) {
            responses.push({ requestId, data: { routes } })
          }
        }
        if (responses.length > 0) {
          trigger({ type: MCP_EVENTS.mcp_response, detail: responses })
        }
      },

      // MCP event handlers
      async [MCP_EVENTS.mcp_tool_call]({ toolName, params, requestId }) {
        // Route to specific tool event (like how LOG_EVENT routes by selected.type)
        const toolEventMap: Record<string, string> = {
          list_routes: MCP_TOOL_EVENTS.mcp_list_routes,
          test_all_stories: MCP_TOOL_EVENTS.mcp_test_all_stories,
          test_story_set: MCP_TOOL_EVENTS.mcp_test_story_set,
        }
        trigger({ type: toolEventMap[toolName], detail: { params, requestId } })
      },

      // Specific MCP tool handlers
      async [MCP_TOOL_EVENTS.mcp_list_routes]({ params, requestId }) {
        await handleMCPRequest('list_routes', params, requestId)
      },

      async [MCP_TOOL_EVENTS.mcp_test_all_stories]({ params, requestId }) {
        await handleMCPRequest('test_all_stories', params, requestId)
      },

      async [MCP_TOOL_EVENTS.mcp_test_story_set]({ params, requestId }) {
        await handleMCPRequest('test_story_set', params, requestId)
      },

      // MCP response handler
      async [MCP_EVENTS.mcp_response](responses) {
        // Resolve MCP promises and clean up pending requests
        const pending = pendingMCPRequestsSignal.get()
        for (const { requestId, data, error } of responses) {
          resolveMCPRequest(requestId, data, error)
          pending.delete(requestId)
        }
        pendingMCPRequestsSignal.set(new Map(pending))
      },
    }
  },
})
