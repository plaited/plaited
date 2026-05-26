---
name: add-remote-mcp
description: Connect to remote HTTP MCP servers — discover capabilities, call tools, scaffold skills, and configure auth from public endpoints through OAuth and Varlock-resolved secrets. Covers CLI (plaited mcp-client) and skill authoring patterns.
license: ISC
compatibility: Requires `plaited` CLI and network access
allowed-tools: Bash Read Write
---

# Add Remote MCP

Connect to remote HTTP MCP servers via Streamable HTTP transport. Use `plaited mcp-client`
for all operations — no wrapper scripts needed.

## When to use

- Discovering capabilities (tools, prompts, resources) from any HTTP MCP server
- Calling tools, fetching prompts, reading resources from a remote MCP server
- Authoring a skill that documents tool usage via CLI examples
- Configuring auth for public, bearer-token, or OAuth-protected servers
- Checking skill output against the AgentSkills spec

## URL shapes

Remote MCP servers present one of two URL types:

- **Discovery/manifest URL** — Returns advertised capabilities. Accepts `discover`, `list-tools`,
  `list-prompts`, `list-resources` operations.
  Example: `https://bun.com/docs/mcp`
- **Live transport endpoint** — Accepts all operations including `call-tool`, `get-prompt`,
  `read-resource`.

Always try the URL you have first. If `call-tool` fails on a discovery URL, use `discover` to
inspect the advertised capabilities — the provider may publish a separate transport endpoint.

## Discovery

Use `plaited mcp-client` for all discovery and inspection. Every operation accepts optional
`auth`, `headers`, and `timeoutMs` fields.

```bash
# Discover all capabilities
plaited mcp-client '{"mode":"discover","url":"https://example.com/mcp"}'

# List tools only
plaited mcp-client '{"mode":"list-tools","url":"https://example.com/mcp"}'

# List prompts
plaited mcp-client '{"mode":"list-prompts","url":"https://example.com/mcp"}'

# List resources
plaited mcp-client '{"mode":"list-resources","url":"https://example.com/mcp"}'
```

See `plaited mcp-client --help` for all 7 modes and `plaited mcp-client --schema input` for
the full input schema.

## Skill documentation pattern

When authoring a new skill for a remote MCP server, the pattern is:

1. **Discover** the server's capabilities:
   ```bash
   plaited mcp-client '{"mode":"discover","url":"https://example.com/mcp"}'
   ```
2. **Document relevant tools, prompts, and resources** in the skill's `SKILL.md` as inline
   CLI examples:
   ```bash
   # Tool usage
   plaited mcp-client '{"mode":"call-tool","url":"https://example.com/mcp","tool":"search","args":{"query":"..."}}'
   ```
3. **Add auth if needed** (see Authentication section below).

No wrapper scripts needed. The CLI replaces the old pattern of generated `scripts/search.ts`
files. If the server needs auth, include the `auth` field directly in the example:
```bash
plaited mcp-client '{"mode":"call-tool","url":"https://example.com/mcp","tool":"search","args":{"query":"..."},"auth":{"type":"bearer-env","token":{"envVar":"MY_TOKEN"}}}'
```

## Authentication

### Tier 1: No auth (public endpoints)

No options needed:

```bash
plaited mcp-client '{"mode":"list-tools","url":"https://example.com/mcp"}'
```

### Tier 2: API key / Bearer token

Pass the bearer token via an environment variable:

```bash
plaited mcp-client '{"mode":"list-tools","url":"https://example.com/mcp","auth":{"type":"bearer-env","token":{"envVar":"MY_API_KEY"}}}'
```

### Tier 3: Protected endpoints (OAuth, Varlock)

For servers needing OAuth client credentials, refresh tokens, or secrets injected via Varlock,
pass the full auth config inline:

#### Bearer token from env

All secrets resolve from environment variables. Inject them via your secret manager
(Varlock, 1Password, CI secrets, etc.) before invoking the CLI.

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://example.com/mcp","tool":"my_tool","args":{"key":"value"},"auth":{"type":"bearer-env","token":{"envVar":"MY_MCP_ACCESS_TOKEN"}}}'
```

#### OAuth client credentials

```bash
plaited mcp-client '{"mode":"list-tools","url":"https://example.com/mcp","auth":{"type":"oauth-client-credentials","tokenUrl":"https://issuer.example.com/oauth/token","clientId":{"envVar":"MY_MCP_CLIENT_ID"},"clientSecret":{"envVar":"MY_MCP_CLIENT_SECRET"},"scopes":["mcp:tools"]}}'
```

#### OAuth refresh token with file persistence

By default, rotated refresh tokens are held in memory only. Add `tokenPersistence`
to survive across CLI invocations. The default path is
`~/.plaited/mcp/tokens/<host>.json`.

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://example.com/mcp","tool":"my_tool","args":{"key":"value"},"auth":{"type":"oauth-refresh-token","tokenUrl":"https://issuer.example.com/oauth/token","clientId":{"envVar":"MY_MCP_CLIENT_ID"},"clientSecret":{"envVar":"MY_MCP_CLIENT_SECRET"},"refreshToken":{"envVar":"MY_MCP_REFRESH_TOKEN"},"tokenPersistence":{"kind":"file"}}}'
```

Use `plaited mcp-client --schema input` to inspect the complete schema.

### Operator rules — no secrets in repo

- Do not commit JWTs, access tokens, refresh tokens, or client secrets into tracked files.
- Checked-in config may contain auth strategy, env var names, scopes, issuer, and token URLs.
  Secret values themselves must come from environment variables (injected via Varlock,
  1Password, CI secrets, or your preferred secret manager).
- With `tokenPersistence: { kind: "file" }`, the rotated refresh token is written to
  `~/.plaited/mcp/tokens/<host>.json` (same sensitivity as `gcloud` ADC or `aws` SSO cache).
  Omit `tokenPersistence` to keep everything in-memory (lossy across invocations — the
  caller re-injects bootstrap secrets each time).
- Keep access tokens ephemeral and in memory.
- Prefer Varlock plus 1Password for injecting initial secrets into the environment.
  The CLI never writes secrets to any other location.