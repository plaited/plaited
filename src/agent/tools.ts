/**
 * Tool registry and execution layer for the world agent.
 * Provides a mechanism to register, manage, and execute tools
 * that the agent can call via function calls.
 */

import type { FunctionCall, ToolHandler, ToolRegistry, ToolResult, ToolSchema } from './agent.types.ts'

/**
 * Creates a new tool registry for managing agent tools.
 *
 * @returns A ToolRegistry instance with register, execute, and schemas
 *
 * @remarks
 * Tools are registered with a name, handler function, and schema.
 * The schema is provided to the model for function calling.
 * Execution parses the JSON arguments and invokes the handler.
 *
 * @example
 * ```typescript
 * const registry = createToolRegistry()
 *
 * registry.register('writeTemplate', async (args) => {
 *   await Bun.write(args.path, args.content)
 *   return { success: true }
 * }, {
 *   name: 'writeTemplate',
 *   description: 'Write a template file',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       path: { type: 'string', description: 'File path' },
 *       content: { type: 'string', description: 'Template content' }
 *     },
 *     required: ['path', 'content']
 *   }
 * })
 * ```
 */
export const createToolRegistry = (): ToolRegistry => {
  const handlers = new Map<string, ToolHandler>()
  const toolSchemas: ToolSchema[] = []

  return {
    register(name, handler, schema) {
      if (handlers.has(name)) {
        console.warn(`Tool "${name}" already registered, skipping`)
        return
      }
      handlers.set(name, handler)
      toolSchemas.push(schema)
    },

    async execute(call: FunctionCall): Promise<ToolResult> {
      const handler = handlers.get(call.name)

      if (!handler) {
        return {
          success: false,
          error: `Unknown tool: ${call.name}`,
        }
      }

      try {
        const args = JSON.parse(call.arguments) as Record<string, unknown>
        return await handler(args)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },

    get schemas() {
      return [...toolSchemas]
    },
  }
}

/**
 * Creates the core tools for template generation.
 * These are the default tools available to the world agent.
 *
 * @param config Configuration for tool file paths
 * @returns A configured ToolRegistry with core tools registered
 */
export const createCoreTools = (config: {
  /** Base directory for generated files */
  outputDir: string
  /** Function to run a story and get results */
  runStory?: (path: string) => Promise<import('./agent.types.ts').StoryResult>
}): ToolRegistry => {
  const registry = createToolRegistry()

  registry.register(
    'writeTemplate',
    async (args) => {
      const { path, content } = args as { path: string; content: string }
      const fullPath = `${config.outputDir}/${path}`

      try {
        await Bun.write(fullPath, content)
        return { success: true, data: { path: fullPath } }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
    {
      name: 'writeTemplate',
      description: 'Write a JSX template file for a UI element',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path (e.g., "button.tsx")' },
          content: { type: 'string', description: 'JSX template content' },
        },
        required: ['path', 'content'],
      },
    },
  )

  registry.register(
    'writeStory',
    async (args) => {
      const { path, content } = args as { path: string; content: string }
      const fullPath = `${config.outputDir}/${path}`

      try {
        await Bun.write(fullPath, content)
        return { success: true, data: { path: fullPath } }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
    {
      name: 'writeStory',
      description: 'Write a story file for testing a template',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path (e.g., "button.stories.tsx")' },
          content: { type: 'string', description: 'Story file content' },
        },
        required: ['path', 'content'],
      },
    },
  )

  if (config.runStory) {
    registry.register(
      'runStory',
      async (args) => {
        const { path } = args as { path: string }

        try {
          const result = await config.runStory!(path)
          return { success: result.passed, data: result }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },
      {
        name: 'runStory',
        description: 'Execute a story file and return test results',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the story file to run' },
          },
          required: ['path'],
        },
      },
    )
  }

  return registry
}
