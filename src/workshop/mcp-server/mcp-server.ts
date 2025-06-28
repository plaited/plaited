import { PUBLIC_EVENT_SCHEMAS, type PublicEventDetails } from './mcp-server.schemas.js'
import { PUBLIC_EVENTS } from './mcp-server.constants.js'
import { mcpPromisesMap } from './mcp-server.utils.js'
import { defineMCPServer } from './define-mcp-server.js'
import { useStoryServer } from '../story-server/use-story-server.js'

export const mcpServer = defineMCPServer<
  PublicEventDetails,
  {
    root: string
  }
>({
  name: 'plaited-workshop',
  version: '0.0.1',
  publicEvents: Object.values(PUBLIC_EVENTS),
  async bProgram({ bSync, bThread, bThreads, registerTool, trigger }) {
    const { storyServer, storyParamSet } = await useStoryServer({
      root: `${process.cwd()}/src`,
      trigger,
    })
    bThreads.set({
      onGetStoryRoutes: bThread(
        [
          bSync({
            block: ({ type }) => {
              if (type !== PUBLIC_EVENTS.get_story_routes) return false
              return !!storyServer
            },
          }),
        ],
        true,
      ),
    })
    for (const [type, config] of Object.entries(PUBLIC_EVENT_SCHEMAS)) {
      registerTool(type, config)
    }
    return {
      async [PUBLIC_EVENTS.get_workshop_href]({ ref }) {
        const { resolve } = mcpPromisesMap.get(ref)!
        const structuredContent = {
          href: storyServer.url.href,
        }
        resolve({
          content: [
            {
              type: 'text',
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
          structuredContent,
        })
        mcpPromisesMap.delete(ref)
      },
      async [PUBLIC_EVENTS.get_story_routes]({ ref }) {
        const { resolve } = mcpPromisesMap.get(ref)!
        const params = storyParamSet?.get()
        const routes = params ? [...params].map(({ route }) => new URL(route, storyServer?.url).href) : []
        const structuredContent = {
          routes,
        }
        resolve({
          content: [
            {
              type: 'text',
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
          structuredContent,
        })
        mcpPromisesMap.delete(ref)
      },
    }
  },
})
