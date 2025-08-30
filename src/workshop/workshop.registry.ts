// import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type Registry } from '../ai.js'
// import { z } from 'zod'

/**
 * MCP tool registry for workshop capabilities.
 * Will contain tools for component development and testing.
 *
 * @example Future tools
 * ```ts
 * export const registry = {
 *   tools: [
 *     // Component generation
 *     // Story management
 *     // Design token operations
 *     // Test execution
 *   ],
 *   resources: [
 *     // Story templates
 *     // Component templates
 *     // Token schemas
 *   ]
 * } satisfies Registry;
 * ```
 *
 * @remarks
 * Currently empty, prepared for tool integration.
 * Tools will enable AI-assisted development workflows.
 *
 * @see {@link workshop} for server configuration
 */
export const registry = {} satisfies Registry
