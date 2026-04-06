import type { Factory } from '../../agent.ts'
import { MCP_FACTORY_EVENTS, MCP_FACTORY_SIGNAL_KEYS } from './mcp-factory.constants.ts'
import {
  McpCapabilityProjectionSchema,
  type McpFactoryState,
  McpFactoryStateSchema,
  RecordMcpCallDetailSchema,
  RegisterMcpServerDetailSchema,
} from './mcp-factory.schemas.ts'
import type { CreateMcpFactoryOptions } from './mcp-factory.types.ts'

const toNames = (value: Record<string, { name?: string }> | Array<{ name?: string }>): string[] =>
  Array.isArray(value)
    ? value.map((entry) => entry.name).filter((entry): entry is string => typeof entry === 'string')
    : Object.values(value)
        .map((entry) => entry.name)
        .filter((entry): entry is string => typeof entry === 'string')

/**
 * Creates the bounded MCP composition factory.
 *
 * @public
 */
export const createMcpFactory =
  ({ stateSignalKey = MCP_FACTORY_SIGNAL_KEYS.state, maxCalls = 20 }: CreateMcpFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: McpFactoryStateSchema,
        value: {
          servers: [],
          recentCalls: [],
        },
        readOnly: false,
      })

    const publish = (next: McpFactoryState) => {
      const parsed = McpFactoryStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as McpFactoryState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: MCP_FACTORY_EVENTS.mcp_factory_updated,
        detail: {
          serverCount: parsed.servers.length,
          callCount: parsed.recentCalls.length,
        },
      })
    }

    return {
      handlers: {
        [MCP_FACTORY_EVENTS.mcp_factory_register_server](detail) {
          const parsed = RegisterMcpServerDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as McpFactoryState | null
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
        [MCP_FACTORY_EVENTS.mcp_factory_record_call](detail) {
          const parsed = RecordMcpCallDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as McpFactoryState | null
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
