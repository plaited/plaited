import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { useStoryServer } from '../../story-server/use-story-server.js'
import { mcpServer } from '../mcp-server.js'

const { storyServer, storyParamSet } = await useStoryServer(`${process.cwd()}/src`)

const server = await mcpServer({
  storyParamSet,
  storyServer,
})
const transport = new StdioServerTransport()
await server.connect(transport)
