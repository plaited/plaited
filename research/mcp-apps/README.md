# MCP Apps — Plaited Reference Implementation

Research into how plaited implements the [A2UI-in-MCP-apps](https://github.com/a2ui-project/a2ui/blob/main/docs/public/guides/a2ui-in-mcp-apps.md) pattern: serving a generative-UI surface from an MCP server with no traditional website, consumed by a plaited reference client (Variant A) or any A2UI-compatible host (Variant B), or consumed agent-only with no rendered UI (Variant C).

This directory holds the design notes for the plaited-side implementation. The supporting change to the framework — `p-scale` nesting validation in the Renderer/Controller with scale carried as data — is captured in `../../prompts/add-scale-validation-to-renderer-and-controller.md`.

## Files

- `implementation.md` — the full implementation design (actors, data flow, MCP server shape, reference client, scale-as-data, x402 integration, ARD catalog entry, what's in/out of scope)
