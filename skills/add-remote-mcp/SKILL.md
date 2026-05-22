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

#### Bearer token from env or Varlock

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://example.com/mcp","tool":"my_tool","args":{"key":"value"},"auth":{"type":"bearer-env","token":{"envVar":"MY_MCP_ACCESS_TOKEN","storage":{"kind":"varlock-1password","reference":"op://team/service/access-token"}}}}'
```

#### OAuth client credentials

```bash
plaited mcp-client '{"mode":"list-tools","url":"https://example.com/mcp","auth":{"type":"oauth-client-credentials","tokenUrl":"https://issuer.example.com/oauth/token","clientId":{"envVar":"MY_MCP_CLIENT_ID","storage":{"kind":"env"}},"clientSecret":{"envVar":"MY_MCP_CLIENT_SECRET","storage":{"kind":"varlock-1password","reference":"op://team/service/client-secret"}},"scopes":["mcp:tools"]}}'
```

#### OAuth refresh token

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://example.com/mcp","tool":"my_tool","args":{"key":"value"},"auth":{"type":"oauth-refresh-token","tokenUrl":"https://issuer.example.com/oauth/token","clientId":{"envVar":"MY_MCP_CLIENT_ID","storage":{"kind":"env"}},"clientSecret":{"envVar":"MY_MCP_CLIENT_SECRET","storage":{"kind":"varlock-1password"}},"refreshToken":{"envVar":"MY_MCP_REFRESH_TOKEN","storage":{"kind":"varlock-1password"}},"tokenPersistence":{"kind":"system-keychain","key":"com.example.mcp/service"}}}'
```

> The `auth` field on every `plaited mcp-client` mode accepts the full
> `ConfiguredRemoteMcpOptions` surface. Use `plaited mcp-client --schema input` to inspect the
> complete schema.

### Operator rules — no secrets in repo

- Do not commit JWTs, access tokens, refresh tokens, or client secrets into tracked files.
- Checked-in config may contain auth strategy, env var names, scopes, issuer or token URLs, and
  storage metadata. The secret values themselves must come from env or Varlock-injected env vars.
- Pass `tokenPersistence` as metadata for operators — actual refresh-material handling comes from
  a runtime `refreshMaterialStore`.
- Keep access tokens ephemeral and in memory.
- The CLI's `auth` field only logs the auth type and env var name (never the secret value) under
  `--dry-run`.
- Prefer Varlock plus 1Password or plain env injection for stable credentials.
- If refresh material must survive process restarts, inject a keychain or external store at
  runtime. Do not default to tracked repo files.