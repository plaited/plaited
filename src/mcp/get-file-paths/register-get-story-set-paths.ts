import { globFiles } from '../test-runner/glob-files.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { STORY_GLOB_PATTERN } from '../test-runner/test-runner.constants.js'
import { GetStorySetPathsOutputSchema, GetFilePathsInputSchema } from './get-file-paths.schemas.js'
import { validateChildPath } from './validate-child-path.js'

export const registerGetStorySetPaths = (server: McpServer, cwd: string) => {
  server.registerTool(
    'get-story-set-paths',
    {
      title: 'Get Story Set Paths',
      description:
        'Retrieves all Plaited story set files (*.stories.tsx) from the codebase for component testing and documentation',
      inputSchema: GetFilePathsInputSchema.shape,
      outputSchema: GetStorySetPathsOutputSchema.shape,
    },
    async ({ dir }) => {
      try {
        const searchPath = validateChildPath(cwd, dir)
        const files = await globFiles(searchPath, STORY_GLOB_PATTERN)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(files, null, 2),
            },
          ],
          structuredContent: {
            files,
          },
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        await server.server.sendLoggingMessage({
          level: 'error',
          data: `Failed to get story set paths: ${errorMessage}`,
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
