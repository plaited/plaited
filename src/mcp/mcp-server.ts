import { TOOL_REGISTRY, type PublicEventDetails } from './mcp-server.schemas.js'
import { defineMCPServer } from './define-mcp-server.js'
import { useStoryServer } from '../workshop/story-server/use-story-server.js'

export const mcpServer = defineMCPServer<PublicEventDetails>({
  name: 'plaited-workshop',
  version: '0.0.1',
  toolRegistry: TOOL_REGISTRY,
  async bProgram({ bSync, bThread, bThreads, trigger }) {
    const { storyServer, storyParamSet } = await useStoryServer({
      root: `${process.cwd()}/src`,
      trigger,
    })
    return {
      async get_workshop_href({ resolve, reject, args }) {
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
      },
      async get_story_routes({ resolve, reject, args }) {
        const routes = [...storyParamSet.get()].map(({ route }) => new URL(route, storyServer?.url).href)
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
      },
    }
  },
})
