/**
 * Tool registry and execution layer for the world agent.
 *
 * @remarks
 * Provides a mechanism to register, manage, and execute tools
 * that the agent can call via function calls. Tools are protocol-agnostic
 * and can be executed via local handlers, MCP servers, or A2A agents.
 */

import type { FunctionCall, StoryResult, ToolHandler, ToolRegistry, ToolResult, ToolSchema } from './agent.types.ts'

// ============================================================================
// Tool Registry Factory
// ============================================================================

/**
 * Creates a new tool registry for managing agent tools.
 *
 * @returns A ToolRegistry instance with register, execute, and schemas
 *
 * @remarks
 * Tools are registered with a name, handler function, and schema.
 * The schema is provided to the model for function calling.
 * Execution parses the JSON arguments and invokes the handler.
 */
export const createToolRegistry = (): ToolRegistry => {
  const handlers = new Map<string, ToolHandler>()
  const toolSchemas: ToolSchema[] = []

  return {
    register(name, handler, schema) {
      if (handlers.has(name)) {
        // Skip duplicate registrations silently - this is expected behavior
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

// ============================================================================
// Core Tools Factory
// ============================================================================

/**
 * Configuration for core tools.
 */
type CoreToolsConfig = {
  /** Base directory for generated files */
  outputDir: string
  /** Function to run a story and get results */
  runStory?: (path: string) => Promise<StoryResult>
}

/**
 * Creates the core tools for template generation.
 * These are the default tools available to the world agent.
 *
 * @param config - Configuration for tool file paths
 * @returns A configured ToolRegistry with core tools registered
 *
 * @remarks
 * Core tools include:
 * - `writeTemplate` - Write JSX template files
 * - `writeStory` - Write story files for testing
 * - `writeStyles` - Write CSS-in-JS style files
 * - `runStory` - Execute story tests (if runStory function provided)
 */
export const createCoreTools = (config: CoreToolsConfig): ToolRegistry => {
  const registry = createToolRegistry()

  // Write template tool
  registry.register(
    'writeTemplate',
    async (args) => {
      const { path, content } = args as { path: string; content: string }
      const fullPath = `${config.outputDir}/${path}`

      try {
        await Bun.write(fullPath, content)
        return { success: true, data: { path: fullPath, content } }
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
          content: { type: 'string', description: 'JSX template content with imports' },
        },
        required: ['path', 'content'],
      },
    },
  )

  // Write story tool
  registry.register(
    'writeStory',
    async (args) => {
      const { path, content } = args as { path: string; content: string }
      const fullPath = `${config.outputDir}/${path}`

      try {
        await Bun.write(fullPath, content)
        return { success: true, data: { path: fullPath, content } }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
    {
      name: 'writeStory',
      description: 'Write a story file for testing a template with browser automation',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path (e.g., "button.stories.tsx")' },
          content: { type: 'string', description: 'Story file content with story() exports' },
        },
        required: ['path', 'content'],
      },
    },
  )

  // Write styles tool
  registry.register(
    'writeStyles',
    async (args) => {
      const { path, content } = args as { path: string; content: string }
      const fullPath = `${config.outputDir}/${path}`

      try {
        await Bun.write(fullPath, content)
        return { success: true, data: { path: fullPath, content } }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
    {
      name: 'writeStyles',
      description: 'Write a CSS-in-JS styles file using createStyles',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path (e.g., "button.css.ts")' },
          content: { type: 'string', description: 'Styles file with createStyles' },
        },
        required: ['path', 'content'],
      },
    },
  )

  // Run story tool (if runner provided)
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
