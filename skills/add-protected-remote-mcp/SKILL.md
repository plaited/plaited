---
name: add-protected-remote-mcp
description: Scaffold protected remote MCP skills for generic tool execution using repo-native auth config, env or Varlock-resolved secrets, and optional external refresh-material storage.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
metadata:
  plaited:
    kind: skill
    origin:
      kind: first-party
    capabilities:
      - id: workflow.protected-mcp-skill
        type: workflow
        lane: private
        phase: generation
        audience: [coder]
        actions: [discover, scaffold, secure]
        sideEffects: workspace-write
        source:
          type: first-party
---

# Add Protected Remote MCP

Use this skill when a remote MCP server is protected by OAuth, minted bearer tokens, or other
operator-managed secrets that must not be committed into the repository.

This skill is intentionally for generic MCP tool execution. The wrapper templates accept arbitrary
JSON tool arguments that match the MCP tool schema. They do not assume a `{ "query": "..." }`
shape.

## When to use

- Protected remote MCP servers that need OAuth client credentials
- Protected remote MCP servers that need refresh-token access
- Remote MCP wrappers that should resolve bearer tokens from env or Varlock-injected env vars
- Generic tool wrappers that need one-shot or session-based execution

## Operator rules

- No secrets in repo. Do not commit JWTs, access tokens, refresh tokens, or client secrets.
- Checked-in config may contain auth strategy, env var names, scopes, issuer or token URLs, and
  storage metadata.
- `tokenPersistence` in checked-in config is metadata for operators and future adapters. Actual
  persisted refresh-material handling still comes from a runtime `refreshMaterialStore`.
- Prefer Varlock plus 1Password or plain env injection for stable credentials.
- Keep access tokens ephemeral and in memory.
- If refresh material must survive process restarts, inject a keychain or external store at
  runtime. Do not default to tracked repo files.

## Wrapper templates

- [references/one-shot-tool-template.ts](references/one-shot-tool-template.ts)
  Use for single MCP tool calls against public or already-resolved endpoints.
- [references/session-tool-template.ts](references/session-tool-template.ts)
  Use when the wrapper should reuse one MCP session for repeated calls.
- [references/protected-session-tool-template.ts](references/protected-session-tool-template.ts)
  Use for bearer-env, OAuth client credentials, or refresh-token protected servers through
  `resolveConfiguredRemoteMcpOptions`.

## Recommended flow

1. Discover the protected server's tools and schema with repo-native MCP helpers or provider docs.
2. Copy the wrapper template that matches the execution pattern.
3. Fill in `MCP_URL`, `TOOL_NAME`, and a checked-in `ConfiguredRemoteMcpOptions` object.
4. Put only env var names and storage metadata in checked-in config.
5. Inject secrets with env or `bunx varlock run -- bun ...`.
6. If refresh-token rotation must persist, pass a runtime `refreshMaterialStore`.

## Example auth configs

### Bearer token from env or Varlock

```ts
const REMOTE_MCP = {
  auth: {
    type: 'bearer-env',
    token: {
      envVar: 'MY_MCP_ACCESS_TOKEN',
      storage: { kind: 'varlock-1password', reference: 'op://team/service/access-token' },
    },
  },
}
```

### OAuth client credentials

```ts
const REMOTE_MCP = {
  auth: {
    type: 'oauth-client-credentials',
    tokenUrl: 'https://issuer.example.com/oauth/token',
    clientId: {
      envVar: 'MY_MCP_CLIENT_ID',
      storage: { kind: 'env' },
    },
    clientSecret: {
      envVar: 'MY_MCP_CLIENT_SECRET',
      storage: { kind: 'varlock-1password', reference: 'op://team/service/client-secret' },
    },
    scopes: ['mcp:tools'],
  },
}
```

### OAuth refresh token

```ts
const REMOTE_MCP = {
  auth: {
    type: 'oauth-refresh-token',
    tokenUrl: 'https://issuer.example.com/oauth/token',
    clientId: {
      envVar: 'MY_MCP_CLIENT_ID',
      storage: { kind: 'env' },
    },
    clientSecret: {
      envVar: 'MY_MCP_CLIENT_SECRET',
      storage: { kind: 'varlock-1password' },
    },
    refreshToken: {
      envVar: 'MY_MCP_REFRESH_TOKEN',
      storage: { kind: 'varlock-1password' },
    },
    tokenPersistence: { kind: 'system-keychain', key: 'com.example.mcp/service' },
  },
}
```

## Relationship to `add-remote-mcp`

Use [add-remote-mcp](../add-remote-mcp/SKILL.md) for public endpoints and simple static-header or
bearer-env cases where you mainly need discovery or a lightweight wrapper.

Use this protected skill when the server needs OAuth, rotated refresh material, or a generic
tool-execution wrapper that should hide auth-provider construction behind the `plaited/mcp`
library.
