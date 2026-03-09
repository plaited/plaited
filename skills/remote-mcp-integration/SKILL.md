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

```bash
plaited remote-mcp-client '{"url": "https://example.com/mcp", "method": "discover"}'
```

### Tool schemas

Get input schemas for each tool — equivalent to our CLI `--schema input` pattern:

```bash
plaited remote-mcp-client '{"url": "https://example.com/mcp", "method": "list-tools"}'
```

### Prompts

List prompts:

```bash
plaited remote-mcp-client '{"url": "https://example.com/mcp", "method": "list-prompts"}'
```

Retrieve a prompt's messages:

```bash
plaited remote-mcp-client '{"url": "https://example.com/mcp", "method": "get-prompt", "name": "prompt-name", "arguments": {"arg": "value"}}'
```

### Resources

List and read resources:

```bash
plaited remote-mcp-client '{"url": "https://example.com/mcp", "method": "list-resources"}'
plaited remote-mcp-client '{"url": "https://example.com/mcp", "method": "read-resource", "uri": "resource://schemas/config.json"}'
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
const result = await Bun.$`plaited remote-mcp-client ${JSON.stringify({
  url: MCP_URL,
  method: 'get-prompt',
  name: 'prompt-name',
  arguments: { arg: 'value' },
})}`.json()
for (const m of result.messages) {
  if (m.content.type === 'text') console.log(m.content.text)
}
```

### 3. Resources → `assets/` or pull scripts

MCP resources are data the server exposes. Evaluate the access pattern:

- **Static/small → `assets/`** — Download once and commit. Good for schemas, templates, configuration files that rarely change. Create a one-time download script:

```typescript
const result = await Bun.$`plaited remote-mcp-client ${JSON.stringify({
  url: MCP_URL,
  method: 'read-resource',
  uri: 'resource://schemas/config.json',
})}`.json()
for (const c of result.contents) {
  if (c.text) await Bun.write(`skills/my-skill/assets/${c.uri.split('/').pop()}`, c.text)
}
```

- **Dynamic/large → `scripts/`** — Create a pull script that fetches on demand. Good for documentation, search indexes, or data that updates frequently:

```typescript
const result = await Bun.$`plaited remote-mcp-client ${JSON.stringify({
  url: MCP_URL,
  method: 'read-resource',
  uri: process.argv[2],
})}`.json()
for (const c of result.contents) {
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
- **`plaited remote-mcp-client`** — CLI tool wrapping the SDK. Accepts JSON input with `method` discriminant, returns JSON output. Scripts call this via `Bun.$` instead of importing library functions.

## References

- [**references/wrapper-template.ts**](references/wrapper-template.ts) — Template for tool wrapper scripts. Copy and customize for new MCP servers.

## Authentication

### Tier 1: No auth (public endpoints)

No headers needed — the default:

```bash
plaited remote-mcp-client '{"url": "https://bun.com/docs/mcp", "method": "list-tools"}'
```

### Tier 2: API key / Bearer token

Pass custom headers. Use environment variables — never hardcode secrets:

```bash
plaited remote-mcp-client "$(jq -n --arg key "$MY_API_KEY" '{
  url: "https://example.com/mcp",
  method: "call-tool",
  toolName: "SearchExample",
  arguments: {query: "test"},
  headers: {Authorization: ("Bearer " + $key)}
}')"
```

For wrapper scripts, build the headers object:

```typescript
const AUTH_HEADERS: Record<string, string> | undefined =
  process.env.MY_API_KEY
    ? { Authorization: `Bearer ${process.env.MY_API_KEY}` }
    : undefined

const result = await Bun.$`plaited remote-mcp-client ${JSON.stringify({
  url: MCP_URL,
  method: 'call-tool',
  toolName: TOOL_NAME,
  arguments: input,
  ...(AUTH_HEADERS ? { headers: AUTH_HEADERS } : {}),
})}`.json()
```

### Tier 3: OAuth 2.1

OAuth requires programmatic `OAuthClientProvider` from the SDK — not CLI-serializable. For OAuth flows, import the library functions directly from `src/tools/remote-mcp-client.ts`:

```typescript
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { mcpListTools } from '../../src/tools/remote-mcp-client.ts'

const provider: OAuthClientProvider = {
  get redirectUrl() { return undefined },
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
- Each CLI invocation creates a fresh client connection (stateless)
- Not for stdio-based MCP servers — use `@modelcontextprotocol/sdk` directly for those
