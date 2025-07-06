/**
 * @module mcp
 * 
 * Model Context Protocol (MCP) integration for Plaited
 * 
 * This module provides tools for creating MCP servers that integrate with
 * Plaited's behavioral programming system. MCP enables AI assistants to
 * interact with external systems through a standardized protocol.
 * 
 * @example Creating a basic MCP server
 * ```ts
 * import { defineMCPServer } from 'plaited/mcp'
 * 
 * const server = await defineMCPServer({
 *   name: 'my-server',
 *   version: '1.0.0',
 *   registry: {
 *     searchFiles: {
 *       primitive: 'tool',
 *       config: {
 *         description: 'Search for files',
 *         inputSchema: z.object({ pattern: z.string() })
 *       }
 *     }
 *   },
 *   async bProgram({ trigger }) {
 *     return {
 *       searchFiles: async ({ resolve, args }) => {
 *         const files = await findFiles(args.pattern)
 *         resolve({ content: [{ type: 'text', text: files.join('\n') }] })
 *       }
 *     }
 *   }
 * })
 * ```
 * 
 * @example Creating an Arazzo workflow runner
 * ```ts
 * import { defineArazzoRunner } from 'plaited/mcp'
 * 
 * const runner = await defineArazzoRunner({
 *   name: 'workflow-runner',
 *   version: '1.0.0',
 *   arazzoDocuments: ['./workflows.arazzo.yaml'],
 *   async bProgram({ runner }) {
 *     return {
 *       'execute-workflow': async ({ resolve, args }) => {
 *         const result = await runner.executeWorkflow(args.workflowId, args.inputs)
 *         resolve({ content: [{ type: 'text', text: JSON.stringify(result) }] })
 *       }
 *     }
 *   }
 * })
 * ```
 */

export { defineMCPServer } from './mcp/define-mcp-server.js'
export { defineArazzoRunner } from './mcp/define-arazzo-runner.js'

// Export types
export type {
  Registry,
  PromptEntry,
  ResourceEntry,
  ToolEntry,
  PromptConfig,
  ResourceConfig,
  ToolConfig,
  PromptDetail,
  ResourceDetail,
  ToolDetail,
  Prompts,
  Resources,
  Tools,
  PrimitiveHandlers,
  StrictHandlers,
} from './mcp/mcp.types.js'

export type {
  ArazzoDocument,
  ArazzoInfo,
  SourceDescription,
  Workflow,
  Step,
  Parameter,
  RequestBody,
  PayloadReplacement,
  Criterion,
  CriterionExpressionType,
  SuccessAction,
  FailureAction,
  ReusableObject,
  Components,
  ExecutionContext,
  StepResult,
  WorkflowResult,
  OperationResult,
  ArazzoRunnerConfig,
  WorkflowRunner,
} from './mcp/define-arazzo-runner.js'

// Re-export MCP SDK types that users might need
export type {
  McpServer,
  RegisteredTool,
  RegisteredPrompt,
  RegisteredResource,
  RegisteredResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js'

export type {
  GetPromptResult,
  ReadResourceResult,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js'