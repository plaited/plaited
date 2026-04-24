/**
 * Template: protected session-based MCP tool wrapper.
 *
 * This template keeps checked-in config declarative. Secrets stay in env or Varlock-backed env
 * vars, and the `plaited/mcp` library builds the runtime auth provider internally.
 *
 * Usage:
 *   bunx varlock run -- bun run protected-tool.ts '{"ticket":"1234"}'
 */

import { type ConfiguredRemoteMcpOptions, createRemoteMcpSession, resolveConfiguredRemoteMcpOptions } from 'plaited/mcp'

const MCP_URL = 'https://example.com/mcp'
const TOOL_NAME = 'example_tool'

const REMOTE_MCP: ConfiguredRemoteMcpOptions = {
  timeoutMs: 30_000,
  auth: {
    type: 'oauth-client-credentials',
    tokenUrl: 'https://issuer.example.com/oauth/token',
    clientId: {
      envVar: 'EXAMPLE_MCP_CLIENT_ID',
      storage: { kind: 'env' },
    },
    clientSecret: {
      envVar: 'EXAMPLE_MCP_CLIENT_SECRET',
      storage: {
        kind: 'varlock-1password',
        reference: 'op://team/example-mcp/client-secret',
      },
    },
    scopes: ['mcp:tools'],
  },
}

const parseToolArguments = (raw: string | undefined) => {
  if (raw === '--help' || raw === '-h' || !raw) {
    console.error(`Usage: bun run protected-tool.ts '{"key":"value"}'`)
    process.exit(raw ? 0 : 2)
  }

  const parsed = JSON.parse(raw) as unknown
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Expected a JSON object matching the MCP tool input schema')
  }

  return parsed as Record<string, unknown>
}

const main = async () => {
  const options = await resolveConfiguredRemoteMcpOptions(REMOTE_MCP)

  // If rotated refresh material must persist across runs, pass a runtime store here instead of
  // writing tokens into tracked files:
  // await resolveConfiguredRemoteMcpOptions(REMOTE_MCP, { refreshMaterialStore: myKeychainStore })
  await using session = await createRemoteMcpSession(MCP_URL, options)
  const result = await session.callTool(TOOL_NAME, parseToolArguments(Bun.argv[2]))

  console.log(JSON.stringify(result, null, 2))
}

await main()
