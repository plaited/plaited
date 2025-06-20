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
  'TEST_STORY_SET',
  'TEST_ALL_STORIES',
  'GET_PLAY_STORY_SETS',
  'GET_FILE_ROUTES',
  'SET_CURRENT_WORKING_DIRECTORY',
  'SET_TEST_BACKGROUND_STYLE',
  'SET_TEST_PAGE_COLOR_STYLE',
  'SET_DESIGN_TOKENS',
  'GET_DESIGN_TOKEN_ENTRY',
  'GET_FILTERED_DESIGN_TOKEN_ENTRIES',
  'GET_ALL_DESIGN_TOKEN_ENTRIES',
  'CHECK_IF_DESIGN_TOKEN_EXIST',
  'LIST_ROUTES',
)

const EVENTS = keyMirror('RELOAD_SERVER')

export type WorkshopDetails = {
  [EVENTS.RELOAD_SERVER]: void
  [PUBLIC_EVENTS.LIST_ROUTES]: void
  [PUBLIC_EVENTS.TEST_ALL_STORIES]: void
} & MCPDetails

export const defineWorkshop = defineBProgram<WorkshopDetails, DefineWorkshopParams>({
  publicEvents: [...Object.values(PUBLIC_EVENTS), ...Object.values(MCP_EVENTS), ...Object.values(MCP_TOOL_EVENTS)],
  async bProgram({ cwd, trigger, bThreads, bSync, bThread, disconnect }) {
    const designTokensSignal = useSignal<string>()

    const { url, reload, storyParamSetSignal, reloadClients, server } = await useServer({
      cwd,
      designTokensSignal,
    })

    const colorSchemeSupportSignal = useSignal(false)

    await defineTesting({
      colorSchemeSupportSignal,
      serverURL: url,
      storyParamSetSignal,
    })

    // Register server cleanup
    disconnect(() => {
      server?.stop(true)
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
          list_routes: () => routes.length > 0 ? { routes } : null,
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
          type: MCP_EVENTS.MCP_RESPONSE,
          detail: [{ requestId, error: (error as Error).message }],
        })
        throw error
      }
    }

    // B-threads for MCP coordination
    bThreads.set({
      mcpListRoutesCoordinator: bThread(
        [
          bSync({ waitFor: (event) => event.type === MCP_TOOL_EVENTS.MCP_LIST_ROUTES }),
          bSync({ request: { type: PUBLIC_EVENTS.LIST_ROUTES } }),
        ],
        true,
      ),

      mcpTestAllStoriesCoordinator: bThread(
        [
          bSync({ waitFor: (event) => event.type === MCP_TOOL_EVENTS.MCP_TEST_ALL_STORIES }),
          bSync({ request: { type: PUBLIC_EVENTS.TEST_ALL_STORIES } }),
        ],
        true,
      ),

      mcpTestStorySetCoordinator: bThread(
        [
          bSync({ waitFor: (event) => event.type === MCP_TOOL_EVENTS.MCP_TEST_STORY_SET }),
          bSync({ request: { type: PUBLIC_EVENTS.TEST_STORY_SET } }),
        ],
        true,
      ),
    })

    if (process.execArgv.includes('--hot')) {
      reloadClients()
    }
    return {
      // Existing handlers (enhanced to populate data signals)
      async [PUBLIC_EVENTS.TEST_ALL_STORIES]() {
        storyParamSetSignal.set(new Set(storyParamSetSignal.get()))
      },
      async [EVENTS.RELOAD_SERVER]() {
        await reload()
      },
      async [PUBLIC_EVENTS.LIST_ROUTES]() {
        const storyParamSet = storyParamSetSignal.get()
        const routes: RouteInfo[] = []
        for (const { route, filePath } of storyParamSet) {
          const href = new URL(route, url).href
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
          trigger({ type: MCP_EVENTS.MCP_RESPONSE, detail: responses })
        }
      },

      // MCP event handlers
      async [MCP_EVENTS.MCP_TOOL_CALL]({ toolName, params, requestId }) {
        // Route to specific tool event (like how LOG_EVENT routes by selected.type)
        const toolEventMap: Record<string, string> = {
          list_routes: MCP_TOOL_EVENTS.MCP_LIST_ROUTES,
          test_all_stories: MCP_TOOL_EVENTS.MCP_TEST_ALL_STORIES,
          test_story_set: MCP_TOOL_EVENTS.MCP_TEST_STORY_SET,
        }
        trigger({ type: toolEventMap[toolName], detail: { params, requestId } })
      },

      // Specific MCP tool handlers
      async [MCP_TOOL_EVENTS.MCP_LIST_ROUTES]({ params, requestId }) {
        await handleMCPRequest('list_routes', params, requestId)
      },

      async [MCP_TOOL_EVENTS.MCP_TEST_ALL_STORIES]({ params, requestId }) {
        await handleMCPRequest('test_all_stories', params, requestId)
      },

      async [MCP_TOOL_EVENTS.MCP_TEST_STORY_SET]({ params, requestId }) {
        await handleMCPRequest('test_story_set', params, requestId)
      },

      // MCP response handler
      async [MCP_EVENTS.MCP_RESPONSE](responses) {
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
