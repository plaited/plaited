// import { z } from 'zod'
import { bServer } from '../mcp.js'
import { registry } from './workshop.registry.js'

/**
 * Plaited Workshop MCP Server.
 * Development and testing infrastructure with future tooling capabilities.
 *
 * @example Future usage
 * ```ts
 * // Will support tools for:
 * // - Component generation
 * // - Story management
 * // - Design token operations
 * // - Test automation
 * ```
 *
 * @remarks
 * Foundation for Model Context Protocol integration.
 * Currently provides infrastructure, tools coming soon.
 *
 * @see {@link registry} for tool registration
 * @see {@link bServer} for MCP server pattern
 */
export const workshop = bServer({
  serverInfo: {
    name: 'plaited-workshop',
    version: '0.0.1',
  },
  registry,
})
