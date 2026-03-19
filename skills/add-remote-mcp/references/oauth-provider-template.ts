import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { createRemoteMcpSession } from 'plaited/mcp'

const MCP_URL = 'https://example.com/mcp'

const provider: OAuthClientProvider = {
  get redirectUrl() {
    return undefined
  },
  clientInformation() {
    return undefined
  },
  get clientMetadata() {
    return { client_id: '...', client_name: '...', redirect_uris: [] }
  },
  codeVerifier() {
    return 'replace-with-generated-code-verifier'
  },
  saveCodeVerifier() {},
  tokens() {
    return undefined
  },
  saveTokens() {},
  redirectToAuthorization() {},
}

await using session = await createRemoteMcpSession(MCP_URL, { authProvider: provider })
const tools = await session.listTools()

console.log(JSON.stringify(tools, null, 2))
