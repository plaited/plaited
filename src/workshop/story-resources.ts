import { useResource } from '../ai.js'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Resource entries using file:// URI scheme for module resolution
 *
 * URI formats:
 *   - file://node_modules/plaited/src/testing.ts -> Resolves to the testing module from plaited package
 *   - file://./{component_path} -> Resolves to local project files relative to cwd
 *
 * This approach allows MCP clients to access type information and source code
 * for generating proper Plaited component stories.
 */

/**
 * Plaited Testing Module Resource
 *
 * Provides access to all exported types from 'plaited/testing':
 * - StoryObj<T>: Union type for story definitions (InteractionStoryObj | SnapshotStoryObj)
 * - InteractionStoryObj<T>: Stories with required play functions for testing behavior
 * - SnapshotStoryObj<T>: Stories for visual testing without interactions
 * - Args<T>: Utility type to extract props from FunctionTemplate components
 * - Play: Function signature for interaction testing with instrumented utilities
 * - Assert, FindByAttribute, FindByText, FireEvent: Testing utility types
 *
 * This is the primary import developers use: import { StoryObj, Args } from 'plaited/testing'
 */
export const plaitedTestingResource = useResource({
  metaData: {
    name: 'plaited-testing-module',
    description:
      'Complete Plaited testing module with StoryObj types, Args utility, and Play function signature for writing component tests',
    mimeType: 'text/x-typescript',
  },
  uriOrTemplate: 'file://node_modules/plaited/src/testing.ts',
  handler: async ({ resolve, reject, args: [url] }) => {
    try {
      // Read the testing module file
      const filePath = url.pathname.replace(/^\//, '') // Remove leading slash
      const text = await fs.readFile(filePath, 'utf-8')

      resolve({
        contents: [
          {
            uri: url.href,
            text,
          },
        ],
      })
    } catch (error: unknown) {
      reject(new Error(`Failed to read testing module: ${error instanceof Error ? error?.message : ''}`))
    }
  },
})

/**
 * Component Source Template Resource
 *
 * Template for accessing component source files in the user's project.
 * The {component_path} parameter should be replaced with the relative path
 * from the project root to the component file.
 *
 * This resource is essential for:
 * - Understanding component props and their types
 * - Identifying p-target attributes for testing
 * - Analyzing component behavior and state management
 * - Finding ElementAttributeList types for HTML element props
 */
export const componentSourceResource = useResource({
  metaData: {
    name: 'component-source-file',
    description:
      'TypeScript/JSX source of the component being tested, used to analyze props, p-target attributes, and behavior',
    mimeType: 'text/x-typescript',
  },
  uriOrTemplate: new ResourceTemplate('file://./{component_path}', {
    list: undefined,
  }),
  handler: async ({ resolve, reject, args: [url, params] }) => {
    try {
      // Extract component path from URL and params
      const componentPath = params?.component_path as string
      if (!componentPath) {
        throw new Error('component_path parameter is required')
      }

      // Read the component source file
      const filePath = path.resolve(process.cwd(), componentPath)
      const content = await fs.readFile(filePath, 'utf-8')

      resolve({
        contents: [
          {
            uri: url.href,
            text: content,
            mimeType: 'text/x-typescript',
          },
        ],
      })
    } catch (error: unknown) {
      reject(new Error(`Failed to read component source: ${error instanceof Error ? error?.message : ''}`))
    }
  },
})

/**
 * Existing Stories Template Resource
 *
 * Template for accessing existing story files in the user's project.
 * This helps maintain consistency with established patterns and conventions.
 *
 * The {story_path} parameter should be replaced with the relative path
 * to an existing .stories.tsx file that can serve as a reference.
 *
 * Use cases:
 * - Learning project-specific story patterns
 * - Understanding test organization preferences
 * - Matching coding style and conventions
 * - Reusing common test utilities or helpers
 */
export const existingStoriesResource = useResource({
  metaData: {
    name: 'existing-story-examples',
    description:
      'Reference story files showing established patterns, conventions, and testing approaches in the project',
    mimeType: 'text/x-typescript',
  },
  uriOrTemplate: new ResourceTemplate('file://./{story_path}', {
    list: undefined,
  }),
  handler: async ({ resolve, reject, args: [url, params] }) => {
    try {
      // Extract story path from URL and params
      const storyPath = params?.story_path as string
      if (!storyPath) {
        throw new Error('story_path parameter is required')
      }

      // Read the existing story file
      const filePath = path.resolve(process.cwd(), storyPath)
      const content = await fs.readFile(filePath, 'utf-8')

      resolve({
        contents: [
          {
            uri: url.href,
            text: content,
            mimeType: 'text/x-typescript',
          },
        ],
      })
    } catch (error: unknown) {
      reject(new Error(`Failed to read existing story: ${error instanceof Error ? error.message : String(error)}`))
    }
  },
})
