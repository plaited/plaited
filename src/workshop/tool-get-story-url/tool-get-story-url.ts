import * as z from 'zod'
import { posix } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { kebabCase } from '../../utils'

/**
 * Zod schema for create-story-route function parameters.
 * Validates story route generation parameters.
 */
export const GetStoryRouteParamsInputSchema = z.object({
  filePath: z.string(),
  exportName: z.string(),
})

/**
 * Type for create-story-route function parameters inferred from Zod schema.
 */
export type GetStoryRouteParams = z.infer<typeof GetStoryRouteParamsInputSchema>

export const GetStoryUrlOutputSchema = z.object({
  url: z.string(),
})

const STORIES_FILTERS_REGEX = /\.stories.tsx?$/

export const getNormalizedPath = (filePath: string) => {
  // Normalize path separators to forward slashes for consistent cross-platform behavior
  let normalizedPath = filePath.replace(/\\/g, '/')

  // Handle Windows absolute paths (C:/path -> /path)
  if (normalizedPath.match(/^[A-Za-z]:/)) {
    normalizedPath = normalizedPath.replace(/^[A-Za-z]:/, '')
  }
  return normalizedPath
}

/**
 * Creates kebab-case route for story URLs.
 *
 * @param options - Route configuration
 * @param options.filePath - Story file path
 * @param options.exportName - Exported story name
 * @returns Route like "/components/button--primary"
 *
 * @example
 * ```ts
 * createStoryRoute({
 *   filePath: "/src/Button.stories.tsx",
 *   exportName: "Primary"
 * }); // "/src/button--primary"
 * ```
 */
export const getStoryUrl = ({ filePath, exportName }: GetStoryRouteParams) => {
  const normalizedPath = getNormalizedPath(filePath)
  const dir = posix.dirname(normalizedPath)
  const base = kebabCase(posix.basename(normalizedPath.replace(STORIES_FILTERS_REGEX, '')))
  const storyName = kebabCase(exportName)
  const id = `${base}--${storyName}`
  return `${dir}/${id}`
}

export const toolGetStoryUrl = (server: McpServer, domain: string) => {
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
        const url = domain + getStoryUrl({ exportName, filePath })
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
