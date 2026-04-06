import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { MCP_FACTORY_EVENTS, MCP_FACTORY_SIGNAL_KEYS } from '../mcp-factory.constants.ts'
import type { McpFactoryState, McpFactoryStateSchema } from '../mcp-factory.schemas.ts'
import { createMcpFactory } from '../mcp-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createMcpFactory', () => {
  test('retains remote server projection and invocation history', async () => {
    let stateSignal: Signal<typeof McpFactoryStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:mcp',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createMcpFactory(),
        ({ signals }) => {
          stateSignal = signals.get(MCP_FACTORY_SIGNAL_KEYS.state) as Signal<typeof McpFactoryStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: MCP_FACTORY_EVENTS.mcp_factory_register_server,
      detail: {
        name: 'docs',
        manifest: {
          server: { name: 'docs' },
          capabilities: {
            tools: [{ name: 'searchDocs', inputSchema: {}, description: 'Search docs' }],
            prompts: [{ name: 'summarizeDocs' }],
            resources: [{ name: 'docs-index', uri: 'mcp://docs/index' }],
          },
        },
      },
    })
    agent.trigger({
      type: MCP_FACTORY_EVENTS.mcp_factory_record_call,
      detail: {
        serverName: 'docs',
        capabilityName: 'searchDocs',
        kind: 'tool',
        status: 'success',
      },
    })

    const state = stateSignal?.get() as McpFactoryState | undefined
    expect(state?.servers[0]?.projection.toolNames).toEqual(['searchDocs'])
    expect(state?.servers[0]?.projection.promptNames).toEqual(['summarizeDocs'])
    expect(state?.recentCalls[0]?.capabilityName).toBe('searchDocs')
  })
})
