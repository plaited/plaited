import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { useStoryServer } from '../../story-server/use-story-server.js'
import { bProgram } from '../../../behavioral.js'
import { z } from 'zod'
import { PUBLIC_EVENTS } from '../mcp-server.constants.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const root = `${process.cwd()}/src`
const { trigger } = bProgram()
const { storyServer, storyParamSet } = await useStoryServer({
  root,
  trigger,
})

const server = new McpServer({
  name: 'plaited-test',
  version: '0.0.1',
})

server.registerTool(
  PUBLIC_EVENTS.get_workshop_href,
  {
    title: 'Get server href',
    description: 'Get Workshop root url',
    outputSchema: {
      href: z.string(),
    },
  },
  async () => {
    const structuredContent = {
      href: storyServer.url.href,
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(structuredContent, null, 2),
        },
      ],
      structuredContent,
    }
  },
)

server.registerTool(
  PUBLIC_EVENTS.get_story_routes,
  {
    title: 'Get story routes',
    description: 'Get a list pf the story routes',
    outputSchema: {
      routes: z.array(z.string()).describe('List of routes for running stories'),
    },
  },
  async () => {
    const params = storyParamSet?.get()
    const routes = params ? [...params].map(({ route }) => new URL(route, storyServer?.url).href) : []
    const structuredContent = {
      routes,
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(structuredContent, null, 2),
        },
      ],
      structuredContent,
    }
  },
)
const transport = new StdioServerTransport()
await server.connect(transport)
