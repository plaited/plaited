---
name: remote-mcp-integration
description: Generate skills from remote MCP servers via composable wrappers. Covers full server discovery (tools, prompts, resources), wrapper generation, and skill scaffolding for any MCP Streamable HTTP endpoint.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash Read Write
---

# Remote MCP Integration

Generate skills from any remote MCP server (Streamable HTTP transport) using the composable wrapper pattern.

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
import { mcpDiscover } from 'plaited'
const { tools, prompts, resources } = await mcpDiscover('https://example.com/mcp')
console.log(JSON.stringify({ tools, prompts, resources }, null, 2))
```

### Tool schemas

Get input schemas for each tool — equivalent to our CLI `--schema input` pattern:

```typescript
import { mcpListTools } from 'plaited'
const tools = await mcpListTools('https://example.com/mcp')
for (const tool of tools) {
  console.log(`${tool.name}: ${tool.description}`)
  console.log(JSON.stringify(tool.inputSchema, null, 2))
}
```

### Prompts

List prompts and retrieve their messages:

```typescript
import { mcpListPrompts, mcpGetPrompt } from 'plaited'
const prompts = await mcpListPrompts('https://example.com/mcp')
for (const p of prompts) {
  console.log(`${p.name}: ${p.description}`)
  const messages = await mcpGetPrompt('https://example.com/mcp', p.name)
  console.log(JSON.stringify(messages, null, 2))
}
```

### Resources

List and read resources:

```typescript
import { mcpListResources, mcpReadResource } from 'plaited'
const resources = await mcpListResources('https://example.com/mcp')
for (const r of resources) {
  console.log(`${r.uri} (${r.mimeType}): ${r.description}`)
}
const contents = await mcpReadResource('https://example.com/mcp', resources[0].uri)
```

## Skill Generation Pattern

After discovery, evaluate each capability type and generate the appropriate skill structure.

### 1. Tools → `scripts/`

Tools become executable wrapper scripts. Use [references/wrapper-template.ts](references/wrapper-template.ts) as a starting point:

```bash
mkdir -p skills/search-my-service/scripts
cp skills/remote-mcp-integration/references/wrapper-template.ts skills/search-my-service/scripts/search.ts
```

Edit the constants: `MCP_URL`, `TOOL_NAME`, and adjust the input type if the tool takes more than `query`.

### 2. Prompts → evaluate for skill adaptation

MCP prompts are pre-built message templates. Evaluate whether to:

- **Adapt into SKILL.md instructions** — If the prompt teaches a workflow or pattern, extract its content into the skill's markdown body. The prompt becomes part of the skill's teaching rather than a runtime dependency.
- **Create a prompt script in `scripts/`** — If the prompt is used at runtime (e.g., a specialized system prompt for a specific task), create a script that fetches and prints it:

```typescript
import { mcpGetPrompt } from 'plaited'
const messages = await mcpGetPrompt(MCP_URL, 'prompt-name', { arg: 'value' })
for (const m of messages) {
  if (m.content.type === 'text') console.log(m.content.text)
}
```

### 3. Resources → `assets/` or pull scripts

MCP resources are data the server exposes. Evaluate the access pattern:

- **Static/small → `assets/`** — Download once and commit. Good for schemas, templates, configuration files that rarely change. Create a one-time download script:

```typescript
import { mcpReadResource } from 'plaited'
const contents = await mcpReadResource(MCP_URL, 'resource://schemas/config.json')
for (const c of contents) {
  if (c.text) await Bun.write(`skills/my-skill/assets/${c.uri.split('/').pop()}`, c.text)
}
```

- **Dynamic/large → `scripts/`** — Create a pull script that fetches on demand. Good for documentation, search indexes, or data that updates frequently:

```typescript
import { mcpReadResource } from 'plaited'
const contents = await mcpReadResource(MCP_URL, process.argv[2])
for (const c of contents) {
  if (c.text) console.log(c.text)
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

Add usage instructions referencing scripts and assets.

### 5. Validate

```bash
bunx @plaited/development-skills validate-skill skills/my-skill
```

### 6. Test

```bash
bun run skills/my-skill/scripts/search.ts '{"query": "test query"}'
```

## Dependencies

- **`@modelcontextprotocol/sdk`** — MCP protocol client (Streamable HTTP transport). Handles session management, Accept header negotiation, and JSON-RPC framing.
- [**src/utils/remote-mcp-client.ts**](../../src/utils/remote-mcp-client.ts) — Convenience layer over the SDK. Exports `mcpConnect`, `mcpDiscover`, `mcpListTools`, `mcpCallTool`, `mcpListPrompts`, `mcpGetPrompt`, `mcpListResources`, `mcpReadResource`. Re-exported from `'plaited'`.

## References

- [**references/wrapper-template.ts**](references/wrapper-template.ts) — Template for tool wrapper scripts. Copy and customize for new MCP servers.

## Authentication

All convenience functions accept an optional `McpTransportOptions` as their last parameter.

### Tier 1: No auth (public endpoints)

No options needed — the default:

```typescript
const tools = await mcpListTools('https://bun.com/docs/mcp')
```

### Tier 2: API key / Bearer token

Pass custom headers via `options.headers`. Use environment variables — never hardcode secrets:

```typescript
const result = await mcpCallTool(MCP_URL, TOOL_NAME, input, {
  headers: { Authorization: `Bearer ${process.env.MY_API_KEY}` },
})
```

For wrapper scripts, read the key at the top:

```typescript
const AUTH_HEADER = process.env.MY_API_KEY
  ? { headers: { Authorization: `Bearer ${process.env.MY_API_KEY}` } }
  : undefined

const result = await mcpCallTool(MCP_URL, TOOL_NAME, input, AUTH_HEADER)
```

### Tier 3: OAuth 2.1

Pass an `OAuthClientProvider` from the SDK for machine-to-machine (client credentials) or interactive (authorization code) flows:

```typescript
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'

const provider: OAuthClientProvider = {
  get redirectUrl() { return undefined }, // undefined for non-interactive flows
  get clientMetadata() { return { client_id: '...', client_name: '...' } },
  tokens() { /* return cached tokens */ },
  saveTokens(tokens) { /* persist tokens */ },
  redirectToAuthorization(url) { /* open browser for interactive flows */ },
}

const tools = await mcpListTools(MCP_URL, { authProvider: provider })
```

### Which tier to use

| Scenario | Tier | Example |
|----------|------|---------|
| Public doc search | No auth | bun.com, modelcontextprotocol.io |
| SaaS API with API key | Bearer token | You.com, OpenAI |
| Enterprise SSO / IdP | OAuth 2.1 | Internal services |
| Agent-to-agent (Modnet) | OAuth client credentials | Node MCP servers |

## Protocol notes

- Uses MCP Streamable HTTP transport (2025-03-26+) via `StreamableHTTPClientTransport`
- SDK handles Accept header negotiation (`application/json` and `text/event-stream`)
- Each convenience function creates a fresh client connection (stateless)
- Use `mcpConnect` directly for multi-operation sessions (single connection)
- Use `mcpDiscover` for efficient full-server capability scanning (single connection)
- Not for stdio-based MCP servers — use `@modelcontextprotocol/sdk` directly for those
