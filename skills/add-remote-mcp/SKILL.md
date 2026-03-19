---
name: add-remote-mcp
description: Generate MCP-backed skills from remote MCP servers (Streamable HTTP). Covers discovery, wrapper generation, skill scaffolding, and authentication seams for HTTP endpoints.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash Read Write
---

# Add Remote MCP

Generate skills from any remote MCP server using the framework's shared `plaited/mcp` library surface.

## When to use

- Adding a new remote MCP server as a searchable skill
- Discovering what tools, prompts, and resources an MCP server exposes
- Generating typed wrapper scripts for MCP tools
- Evaluating MCP prompts for adaptation into skill instructions
- Downloading or scripting access to MCP resources

## Discovery

### Full server discovery

Discover all capabilities in a single connection:

```typescript
import { mcpDiscover } from 'plaited/mcp'

const capabilities = await mcpDiscover('https://example.com/mcp')
console.log(JSON.stringify(capabilities, null, 2))
```

### Tool schemas

Get input schemas for each tool:

```typescript
import { mcpListTools } from 'plaited/mcp'

const tools = await mcpListTools('https://example.com/mcp')
for (const tool of tools) {
  console.log(`${tool.name}: ${tool.description}`)
  console.log(JSON.stringify(tool.inputSchema, null, 2))
}
```

### Prompts

List and retrieve prompts:

```typescript
import { mcpGetPrompt, mcpListPrompts } from 'plaited/mcp'

const prompts = await mcpListPrompts('https://example.com/mcp')
const messages = await mcpGetPrompt('https://example.com/mcp', 'prompt-name', { arg: 'value' })
```

### Resources

List and read resources:

```typescript
import { mcpListResources, mcpReadResource } from 'plaited/mcp'

const resources = await mcpListResources('https://example.com/mcp')
const contents = await mcpReadResource('https://example.com/mcp', 'resource://schemas/config.json')
```

## Session API (connection reuse)

For multiple operations against the same server, use a session:

```typescript
import { createRemoteMcpSession } from 'plaited/mcp'

await using session = await createRemoteMcpSession('https://example.com/mcp', {
  timeoutMs: 30_000,
})
const tools = await session.listTools()
const result = await session.callTool('search', { query: 'test' })
```

`await using` automatically closes the connection when the block exits.

## Skill Generation Pattern

After discovery, evaluate each capability type and generate the appropriate skill structure.

### 1. Tools → `scripts/`

Tools become executable wrapper scripts. Use [references/wrapper-template.ts](references/wrapper-template.ts) as a starting point:

```bash
mkdir -p skills/search-my-service/scripts
cp skills/add-remote-mcp/references/wrapper-template.ts skills/search-my-service/scripts/search.ts
```

Edit the constants: `MCP_URL`, `TOOL_NAME`, and adjust the input validation if the tool takes more than `query`.

### 2. Prompts → evaluate for skill adaptation

MCP prompts are pre-built message templates. Evaluate whether to:

- **Adapt into SKILL.md instructions** — If the prompt teaches a workflow, extract its content into the skill's markdown body.
- **Create a prompt script in `scripts/`** — If the prompt is used at runtime:

```typescript
import { mcpGetPrompt } from 'plaited/mcp'

const messages = await mcpGetPrompt(MCP_URL, 'prompt-name', { arg: 'value' })
for (const message of messages) {
  if (message.content.type === 'text') console.log(message.content.text)
}
```

### 3. Resources → `assets/` or pull scripts

- **Static/small → `assets/`** — Download once and commit.
- **Dynamic/large → `scripts/`** — Fetch on demand:

```typescript
import { mcpReadResource } from 'plaited/mcp'

const contents = await mcpReadResource(MCP_URL, process.argv[2]!)
for (const content of contents) {
  if (content.text) console.log(content.text)
}
```

### 4. Scaffold SKILL.md

Create `skills/my-skill/SKILL.md` with frontmatter:

```yaml
---
name: my-skill
description: What this skill does. Use when...
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
---
```

### 5. Validate

```bash
plaited validate-skill '{"paths": ["skills/my-skill"]}'
```

### 6. Test

```bash
bun run skills/my-skill/scripts/search.ts '{"query": "test query"}'
```

## Authentication

### Tier 1: No auth (public endpoints)

No options needed — the default:

```typescript
const tools = await mcpListTools('https://bun.com/docs/mcp')
```

### Tier 2: API key / Bearer token

Pass custom headers via options:

```typescript
import { mcpCallTool } from 'plaited/mcp'

const result = await mcpCallTool(
  'https://example.com/mcp',
  'SearchExample',
  { query: 'test' },
  { headers: { Authorization: `Bearer ${process.env.MY_API_KEY}` } },
)
```

### Tier 3: OAuth 2.1

OAuth requires a programmatic `OAuthClientProvider`:

```typescript
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { createRemoteMcpSession } from 'plaited/mcp'

const provider: OAuthClientProvider = {
  get redirectUrl() { return undefined },
  get clientMetadata() { return { client_id: '...', client_name: '...' } },
  tokens() { /* return cached tokens */ },
  saveTokens(tokens) { /* persist tokens */ },
  redirectToAuthorization(url) { /* open browser */ },
}

await using session = await createRemoteMcpSession(MCP_URL, { authProvider: provider })
const tools = await session.listTools()
```

### Which tier to use

| Scenario | Tier | Example |
|----------|------|---------|
| Public doc search | No auth | bun.com, modelcontextprotocol.io |
| SaaS API with API key | Bearer token | You.com, OpenAI |
| Enterprise SSO / IdP | OAuth 2.1 | Internal services |
| Agent-to-agent (Modnet) | OAuth client credentials | Node MCP servers |

## References

- **`references/wrapper-template.ts`** — Template for MCP wrapper scripts that import `plaited/mcp`

## Dependencies

- **`@modelcontextprotocol/sdk`** — MCP protocol client (Streamable HTTP transport)
- **`add-mcp`** — Transport-agnostic session API (sibling skill)

## Protocol notes

- Uses MCP Streamable HTTP transport (2025-03-26+) via `StreamableHTTPClientTransport`
- SDK handles Accept header negotiation (`application/json` and `text/event-stream`)
- Session API reuses a single connection; one-shot helpers create and dispose per call
- Not for stdio-based MCP servers — use `add-mcp` directly with an stdio transport
