import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getStoryRoute } from '../test-runner/get-story-route.js'
import { GetStoryRouteParamsInputSchema } from '../test-runner/test-runner.schemas.js'
import { GetStoryUrlOutputSchema } from './get-story-url.schema.js'

export const registerGetStoryUrl = (server: McpServer, domain: string) => {
  server.registerTool(
    'get-story-url',
    {
      title: 'Get story path',
      description: 'get the url for the story exportName from the story set file passed to tool input',
      inputSchema: GetStoryRouteParamsInputSchema.shape,
      outputSchema: GetStoryUrlOutputSchema.shape,
    },
    async ({ exportName, filePath }) => {
      try {
        const url = domain + getStoryRoute({ exportName, filePath })
        return {
          content: [
            {
              type: 'text',
              text: url,
            },
          ],
          structuredContent: {
            url,
          },
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        await server.server.sendLoggingMessage({
          level: 'error',
          data: `Getting story ${exportName}@${filePath} failed, \n${errorMessage}`,
        })
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    },
  )
}
