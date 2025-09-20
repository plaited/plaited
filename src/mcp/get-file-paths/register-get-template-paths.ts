import { globFiles } from '../test-runner/glob-files.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { GetTemplatePathsOutputSchema, GetFilePathsInputSchema } from './get-file-paths.schemas.js'
import { validateChildPath } from './validate-child-path.js'

export const registerGetTemplatePaths = (server: McpServer, cwd: string) => {
  server.registerTool(
    'get-template-paths',
    {
      title: 'Get Template Paths',
      description:
        'Retrieves TypeScript JSX template files (*.tsx) from the specified directory or entire codebase, excluding story files (*.stories.tsx). Returns error if no template files found in the specified location.',
      inputSchema: GetFilePathsInputSchema.shape,
      outputSchema: GetTemplatePathsOutputSchema.shape,
    },
    async ({ dir }) => {
      try {
        const searchPath = validateChildPath(cwd, dir)
        const files = await globFiles(searchPath, '**/*.tsx')
        const filteredFiles = files.filter((file) => !file.includes('.stories.'))

        // Check if no files were found after filtering
        if (filteredFiles.length === 0) {
          const errorMessage =
            dir ?
              `No template files (*.tsx) found in directory '${dir}' (excluding *.stories.tsx)`
            : 'No template files (*.tsx) found in the project (excluding *.stories.tsx)'

          await server.server.sendLoggingMessage({
            level: 'error',
            data: errorMessage,
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

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(filteredFiles, null, 2),
            },
          ],
          structuredContent: {
            files: filteredFiles,
          },
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        await server.server.sendLoggingMessage({
          level: 'error',
          data: `Failed to get template paths: ${errorMessage}`,
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
