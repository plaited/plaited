/**
 * @module create-workshop-agent
 *
 * Workshop Agent creation with built-in Custom Tools for AI-assisted Plaited development.
 *
 * @remarks
 * Provides utilities for creating MCP servers with built-in workshop tools using the Claude Agent SDK.
 * The tools can be used with the SDK's `query()` function via MCP server configuration.
 *
 * @public
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { discoverBehavioralTemplateMetadata } from './collect-behavioral-templates.ts'
import { collectStories } from './collect-stories.ts'
import { getStoryUrl } from './get-paths.ts'

/**
 * Creates an SDK MCP server with built-in workshop tools for Plaited development.
 *
 * @param name - Server name (defaults to 'plaited-workshop')
 * @param version - Server version (defaults to '1.0.0')
 * @param additionalTools - Additional custom tools to include
 * @returns MCP server configuration with workshop tools
 *
 * @remarks
 * Built-in tools included automatically:
 * - `discover_stories`: Find all story files in specified paths
 * - `discover_behavioral_elements`: Find all bElement exports in codebase
 * - `get_story_url`: Generate URLs for story preview in browser
 *
 * Use this with the Agent SDK's `query()` function via the `mcpServers` option.
 *
 * @example
 * ```typescript
 * import { query } from '@anthropic-ai/claude-agent-sdk'
 * import { createWorkshopMcpServer } from 'plaited/workshop'
 *
 * const workshopServer = createWorkshopMcpServer()
 *
 * const result = await query({
 *   prompt: 'Discover all stories in src/main',
 *   options: {
 *     mcpServers: {
 *       workshop: workshopServer
 *     }
 *   }
 * })
 * ```
 *
 * @public
 */
export const createWorkshopMcpServer = ({
  name = 'plaited-workshop',
  version = '1.0.0',
  additionalTools = [],
}: {
  name?: string
  version?: string
  additionalTools?: ReturnType<typeof tool>[]
} = {}) => {
  // Built-in workshop tools
  const builtInTools = [
    tool(
      'discover_stories',
      'Discover all story files in specified paths. Returns story metadata including file paths, routes, and test flags.',
      {
        cwd: z.string().describe('Current working directory (project root)'),
        paths: z.array(z.string()).describe('Array of file or directory paths to search for stories'),
      },
      async ({ cwd, paths }): Promise<CallToolResult> => {
        const stories = await collectStories(cwd, paths)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  stories: Array.from(stories.values()).map((story) => ({
                    route: story.route,
                    exportName: story.exportName,
                    filePath: story.filePath,
                    hasPlay: story.hasPlay,
                    flag: story.flag,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    ),

    tool(
      'discover_behavioral_elements',
      'Discover all bElement (behavioral template) exports in directory. Returns template metadata with export names and file paths.',
      {
        cwd: z.string().describe('Current working directory to search'),
      },
      async ({ cwd }): Promise<CallToolResult> => {
        const elements = await discoverBehavioralTemplateMetadata(cwd)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ elements }, null, 2),
            },
          ],
        }
      },
    ),

    tool(
      'get_story_url',
      'Get URL to render a story in the browser. Returns both interactive story URL and template-only URL.',
      {
        cwd: z.string().describe('Current working directory (project root)'),
        filePath: z.string().describe('Absolute path to story file'),
        exportName: z.string().describe('Story export name'),
        port: z.number().optional().describe('Dev server port (default: 3000)'),
      },
      async (params): Promise<CallToolResult> => {
        const result = getStoryUrl(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    ),
  ]

  return createSdkMcpServer({
    name,
    version,
    tools: [...builtInTools, ...additionalTools],
  })
}
