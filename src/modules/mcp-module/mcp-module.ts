import type { Module } from '../../agent.ts'
import { MCP_MODULE_EVENTS, MCP_MODULE_SIGNAL_KEYS } from './mcp-module.constants.ts'
import {
  McpCapabilityProjectionSchema,
  type McpModuleState,
  McpModuleStateSchema,
  RecordMcpCallDetailSchema,
  RegisterMcpServerDetailSchema,
} from './mcp-module.schemas.ts'
import type { CreateMcpModuleOptions } from './mcp-module.types.ts'

const toNames = (value: Record<string, { name?: string }> | Array<{ name?: string }>): string[] =>
  Array.isArray(value)
    ? value.map((entry) => entry.name).filter((entry): entry is string => typeof entry === 'string')
    : Object.values(value)
        .map((entry) => entry.name)
        .filter((entry): entry is string => typeof entry === 'string')

/**
 * Creates the bounded MCP composition module.
 *
 * @public
 */
export const createMcpModule =
  ({ stateSignalKey = MCP_MODULE_SIGNAL_KEYS.state, maxCalls = 20 }: CreateMcpModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: McpModuleStateSchema,
        value: {
          servers: [],
          recentCalls: [],
        },
        readOnly: false,
      })

    const publish = (next: McpModuleState) => {
      const parsed = McpModuleStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as McpModuleState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: MCP_MODULE_EVENTS.mcp_module_updated,
        detail: {
          serverCount: parsed.servers.length,
          callCount: parsed.recentCalls.length,
        },
      })
    }

    return {
      handlers: {
        [MCP_MODULE_EVENTS.mcp_module_register_server](detail) {
          const parsed = RegisterMcpServerDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as McpModuleState | null
          if (!current) return
          const projection = McpCapabilityProjectionSchema.parse({
            serverName: parsed.data.name,
            toolNames: toNames(parsed.data.manifest.capabilities.tools),
            promptNames: toNames(parsed.data.manifest.capabilities.prompts),
            resourceNames: toNames(parsed.data.manifest.capabilities.resources),
          })
          publish({
            ...current,
            servers: [
              ...current.servers.filter((server) => server.name !== parsed.data.name),
              {
                name: parsed.data.name,
                manifest: parsed.data.manifest,
                projection,
              },
            ],
          })
        },
        [MCP_MODULE_EVENTS.mcp_module_record_call](detail) {
          const parsed = RecordMcpCallDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as McpModuleState | null
          if (!current) return
          publish({
            ...current,
            recentCalls: [
              ...current.recentCalls,
              {
                ...parsed.data,
                timestamp: Date.now(),
              },
            ].slice(-maxCalls),
          })
        },
      },
    }
  }
