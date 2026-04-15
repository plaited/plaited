---
name: add-remote-mcp
description: Generate MCP-backed skills from remote MCP servers (Streamable HTTP). Covers discovery, wrapper generation, skill scaffolding, and authentication seams for HTTP endpoints.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash Read Write
---

# Add Remote MCP

Generate skills from any remote MCP server using the framework's shared `plaited/mcp` library surface.

Remote MCP URLs often start as discovery URLs that also accept Streamable HTTP MCP traffic.
For example, `https://bun.com/docs/mcp` is a valid remote MCP URL for discovery, tool listing,
and direct tool calls.

## When to use

- Adding a new remote MCP server as a searchable skill
- Discovering what tools, prompts, and resources an MCP server exposes
- Generating typed wrapper scripts for MCP tools
- Evaluating MCP prompts for adaptation into skill instructions
- Downloading or scripting access to MCP resources

## URL shapes

Remote MCP integrations commonly begin from one of two URL types:

- **Discovery/manifest URL** — Returns advertised capabilities as JSON.
  Example: `https://bun.com/docs/mcp`
- **Live transport endpoint** — Supports Streamable HTTP MCP session traffic directly.

The shared `plaited/mcp` library accepts either URL type:

- `mcpDiscover`, `mcpListTools`, `mcpListPrompts`, `mcpListResources`
  - accept either URL type
- `createRemoteMcpSession`, `remoteMcpConnect`, `mcpCallTool`, `mcpGetPrompt`, `mcpReadResource`
  - work against live transport endpoints and manifest URLs that also serve Streamable HTTP

If you only have a discovery URL, start by trying it directly. If connection attempts fail,
then fall back to discovery/list wrappers or use the advertised capabilities to locate a
separate transport endpoint.

## Discovery

- Unified CLI for discovery, listing, prompt fetches, resource reads, and session summaries:
  `bun skills/add-remote-mcp/scripts/run.ts '{"url":"https://bun.com/docs/mcp","operation":{"type":"session-summary"}}'`
- Full capability discovery and tool listing:
  [references/discovery-template.ts](references/discovery-template.ts)
- Prompt retrieval:
  [references/prompt-template.ts](references/prompt-template.ts)
- Resource reads:
  [references/resource-template.ts](references/resource-template.ts)

## Session API (connection reuse)

For multiple operations against the same server, use a session when the URL accepts live MCP
traffic.
See [references/session-template.ts](references/session-template.ts).

`await using` automatically closes the connection when the block exits.

## Skill Generation Pattern

After discovery, evaluate each capability type and generate the appropriate skill structure.

### 1. Tools → `scripts/`

Tools become executable wrapper scripts. Use [references/wrapper-template.ts](references/wrapper-template.ts) as a starting point:

```bash
mkdir -p skills/search-my-service/scripts
cp skills/add-remote-mcp/references/wrapper-template.ts skills/search-my-service/scripts/search.ts
```

Edit the constants: `MCP_URL`, `TOOL_NAME`, and adjust the input validation if the tool takes
more than `query`.

Start with the discovery URL the server publishes. If direct execution fails, switch the wrapper
to the server's separate transport URL if one is advertised.

### 2. Prompts → evaluate for skill adaptation

MCP prompts are pre-built message templates. Evaluate whether to:

- **Adapt into SKILL.md instructions** — If the prompt teaches a workflow, extract its content into the skill's markdown body.
- **Create a prompt script in `scripts/`** — If the prompt is used at runtime.
  See [references/prompt-template.ts](references/prompt-template.ts).

### 3. Resources → `assets/` or pull scripts

- **Static/small → `assets/`** — Download once and commit.
- **Dynamic/large → `scripts/`** — Fetch on demand.
  See [references/resource-template.ts](references/resource-template.ts).

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
# Check the generated skill against the AgentSkills spec and repo conventions
bun run skills/search-agent-skills/scripts/search.ts '{"query":"SKILL.md frontmatter fields scripts references assets conventions"}'

# Or inspect the remote server directly through the unified add-remote-mcp CLI
bun skills/add-remote-mcp/scripts/run.ts '{"url":"https://bun.com/docs/mcp","operation":{"type":"session-summary"}}'
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

Pass custom headers via options.
See [references/wrapper-template.ts](references/wrapper-template.ts).

### Tier 3: OAuth 2.1

OAuth requires a programmatic `OAuthClientProvider`.
See [references/oauth-provider-template.ts](references/oauth-provider-template.ts).

### Which tier to use

| Scenario | Tier | Example |
|----------|------|---------|
| Public doc search | No auth | modelcontextprotocol.io, agentskills.io |
| SaaS API with API key | Bearer token | You.com, OpenAI |
| Enterprise SSO / IdP | OAuth 2.1 | Internal services |
| Agent-to-agent (Modnet) | OAuth client credentials | Node MCP servers |

## References

- **`references/discovery-template.ts`** — Capability discovery and tool listing
- **`references/session-template.ts`** — Reusable remote session pattern
- **`references/prompt-template.ts`** — Prompt retrieval example
- **`references/resource-template.ts`** — Resource read example
- **`references/oauth-provider-template.ts`** — OAuth provider seam example
- **`references/wrapper-template.ts`** — Template for MCP wrapper scripts that import `plaited/mcp`

## Dependencies

- **`@modelcontextprotocol/sdk`** — MCP protocol client (Streamable HTTP transport)

## Protocol notes

- Discovery/list helpers accept both manifest URLs and live Streamable HTTP transport URLs
- Session-style APIs also work with manifest URLs when the same URL serves live MCP traffic
- Uses MCP Streamable HTTP transport (2025-03-26+) via `StreamableHTTPClientTransport`
- SDK handles Accept header negotiation (`application/json` and `text/event-stream`)
- Session API reuses a single connection; one-shot helpers create and dispose per call
- Not for stdio-based MCP servers — use `add-mcp` directly with an stdio transport
