# ACP Adapter Catalog

Curated list of ACP-compatible adapters for agent integration.

## Official Adapters

### Claude Code ACP

The official Claude Code adapter from Anthropic/Zed.

| Property | Value |
|----------|-------|
| Package | `@zed-industries/claude-code-acp` |
| Protocol | ACP v1 |
| Language | TypeScript |
| Status | Production |

**Installation:**
```bash
bunx @zed-industries/claude-code-acp
```

**Capabilities:**
- `loadSession` - Resume existing sessions
- `promptCapabilities.image` - Image input support
- MCP server integration

**Use when:**
- Evaluating Claude Code with the harness
- Building Claude-based automation
- Comparing Claude performance across prompts

**Documentation:** [NPM Package](https://www.npmjs.com/package/@zed-industries/claude-code-acp)

---

## Community Adapters

> **Note:** Community adapters may have varying levels of maintenance and protocol compliance. Always verify with `adapter:check` before production use.

### Template Adapter

A reference implementation for building new adapters.

| Property | Value |
|----------|-------|
| Repository | `github:example/acp-adapter-template` |
| Protocol | ACP v1 |
| Language | TypeScript |
| Status | Reference |

**Use when:**
- Learning the ACP protocol
- Starting a new adapter project
- Understanding best practices

---

## Compatibility Matrix

| Adapter | Protocol | loadSession | MCP | Images | Streaming |
|---------|----------|-------------|-----|--------|-----------|
| claude-code-acp | v1 | Yes | Yes | Yes | Yes |
| (template) | v1 | No | No | No | Yes |

### Legend

- **Protocol**: ACP protocol version supported
- **loadSession**: Can resume existing sessions
- **MCP**: Supports MCP server pass-through
- **Images**: Accepts image content blocks
- **Streaming**: Emits real-time `session/update` notifications

---

## Evaluating Adapters

Before choosing an adapter, consider:

### 1. Protocol Compliance

Run the compliance checker:
```bash
acp-harness adapter:check bunx <adapter-package>
```

All 6 checks should pass for production use.

### 2. Feature Requirements

Match your needs to adapter capabilities:

| Need | Required Capability |
|------|---------------------|
| Resume conversations | `loadSession` |
| Use MCP tools | MCP server support |
| Send images | `promptCapabilities.image` |
| Real-time progress | Streaming updates |

### 3. Maintenance Status

Check the adapter repository for:
- Recent commits (active maintenance)
- Open issues (known problems)
- Protocol version (matches your client)

---

## Contributing an Adapter

To add your adapter to this catalog:

1. **Verify compliance:**
   ```bash
   acp-harness adapter:check <your-command>
   # Must pass all 6 checks
   ```

2. **Document capabilities:**
   - Protocol version
   - Supported features
   - Installation instructions

3. **Submit PR** to this repository with:
   - Entry in this catalog
   - Basic usage example
   - Link to documentation

---

## Missing Your Agent?

If your agent doesn't have an ACP adapter:

1. **Check if one exists:** Search npm for `<agent-name>-acp` or `acp-<agent-name>`

2. **Build your own:** See [Implementation Guide](implementation-guide.md)

3. **Request from vendor:** Many agent providers are adding ACP support

The `adapter:scaffold` command helps you get started quickly:
```bash
acp-harness adapter:scaffold my-agent
```
