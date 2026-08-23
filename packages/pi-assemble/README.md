# @plaited/pi-assemble

pi plugin for developing MCP Apps that leverage the [plaited](../plaited) framework.

Based on the research in [`research/mcp-apps`](../../research/mcp-apps): serving a
generative-UI surface from an MCP server with no traditional website (Variant A —
plaited-native MCP App), discovered via ARD, monetized via x402, distributed via
ATProto + RSS.

Depends on [`plaited`](../plaited) (`workspace:*`). This plugin provides the
agent-facing skills, scaffolds, and tooling for assembling MCP Apps — the
specialized complement to [`@plaited/pi-dev`](../pi-dev) (which targets general
coding-agent usage).

## Development

```bash
bun run check    # biome + tsc
bun test
```
