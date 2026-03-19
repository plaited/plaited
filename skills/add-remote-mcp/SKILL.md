---
name: add-remote-mcp
description: Generate MCP-backed skills from remote MCP servers (Streamable HTTP). Covers discovery, wrapper generation, skill scaffolding, and authentication seams for HTTP endpoints.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash Read Write
---

# Add Remote MCP

Generate skills from any remote MCP server using the framework's shared `plaited mcp ...` CLI.

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
plaited mcp discover https://example.com/mcp
```

### Tool schemas

Get input schemas for each tool:

```typescript
plaited mcp list-tools https://example.com/mcp
```

### Prompts

List and retrieve prompts:

```typescript
plaited mcp list-prompts https://example.com/mcp
plaited mcp get-prompt https://example.com/mcp prompt-name '{"arg":"value"}'
```

### Resources

List and read resources:

```typescript
plaited mcp list-resources https://example.com/mcp
plaited mcp read-resource https://example.com/mcp resource://schemas/config.json
```

## Session API (connection reuse)

For multiple operations against the same server, use a session:

```typescript
plaited mcp list-tools https://example.com/mcp --timeout 30000
plaited mcp call https://example.com/mcp search '{"query":"test"}'
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
plaited mcp get-prompt "$MCP_URL" prompt-name '{"arg":"value"}'
```

### 3. Resources → `assets/` or pull scripts

- **Static/small → `assets/`** — Download once and commit.
- **Dynamic/large → `scripts/`** — Fetch on demand:

```typescript
plaited mcp read-resource "$MCP_URL" "$RESOURCE_URI"
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
plaited mcp call https://example.com/mcp SearchExample '{"query":"test"}' \
  --headers "{\"Authorization\":\"Bearer ${MY_API_KEY}\"}"
```

### Tier 3: OAuth 2.1

OAuth requires a programmatic `OAuthClientProvider`:

```typescript
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { createRemoteMcpSession } from '../../../src/tools/mcp.utils.ts'

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

- **`references/wrapper-template.ts`** — Template for MCP wrapper scripts that shell out to `plaited mcp call`

## Dependencies

- **`@modelcontextprotocol/sdk`** — MCP protocol client (Streamable HTTP transport)
- **`add-mcp`** — Transport-agnostic session API (sibling skill)

## Protocol notes

- Uses MCP Streamable HTTP transport (2025-03-26+) via `StreamableHTTPClientTransport`
- SDK handles Accept header negotiation (`application/json` and `text/event-stream`)
- Session API reuses a single connection; one-shot helpers create and dispose per call
- Not for stdio-based MCP servers — use `add-mcp` directly with an stdio transport
