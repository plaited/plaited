# MCP Apps — Plaited Reference Implementation

How plaited implements the [A2UI-in-MCP-apps](https://github.com/a2ui-project/a2ui/blob/main/docs/public/guides/a2ui-in-mcp-apps.md) pattern: a generative-UI surface served from an MCP server with no traditional website, discovered via ARD, monetized via x402, distributed via ATProto + RSS.

This doc is the design for the plaited-side implementation. The supporting framework change — `p-scale` nesting validation with scale carried as data — is in `../../prompts/add-scale-validation-to-renderer-and-controller.md`.

---

## Why MCP Apps (and not a website)

The content-site stack (Parts 1–8) targets creators who, per Nilay Patel's framing, shouldn't have to build a website. The MCP App pattern inverts the surface: the "site" is a self-contained HTML resource served by an MCP server, loaded into a sandboxed iframe by a host client, and driven by MCP tool calls. There is no domain serving a traditional HTML site that Google indexes — there is an MCP server whose resources include an MCP App, and ARD (`ai-catalog.json`) makes it discoverable to agents and hosts.

This keeps the design spec's vocabulary (`p-scale`, `affordances:`, `feedback:`, `patterns:`) as the structural language of the generative UI without requiring the creator to operate a website. The creator operates: content (PDS + RSS), an agent API (MCP server), and a generative surface (the MCP App). Distribution is ARD + firehose + RSS; consumption is agent (MCP) or human (host renders the MCP App).

## The three variants (recap from the evaluation)

| | A: Plaited-native MCP App | B: A2UI-emission MCP App | C: Resource-only MCP |
|---|---|---|---|
| Rendered UI | Plaited Controller/Renderer push-UI | A2UI JSON, any renderer | None (agent/RSS only) |
| Host | Plaited reference client | Any A2UI-compatible host | None |
| Frontier analysis | Full (`verifyFrontiers` on UI loop) | Agent behavioral program only | Agent behavioral program only |
| Plaited build target | ✅ Default for the coding-agent + demos | ❌ Not built by plaited (happens if a user wants framework interop) | ✅ Minimum-viable creator |

**Plaited builds A and C.** B is not a thing we explicitly build skills/threads/code for — if a user not using the full framework wants A2UI emission, they adapt; we don't scaffold it. This doc focuses on A (the full plaited experience) and notes where C diverges.

## Actors (Variant A)

```
┌──────────────────────────────────────────────────────────────┐
│  Server-side (Cloudflare Workers — plaited behavioral runtime)│
│                                                                │
│  Behavioral Program                                            │
│  ├── handlers respond to MCP tool calls                         │
│  ├── emit render/attrs BPEvents (with `scale` in detail)       │
│  └── frontier-verifiable UI loop                               │
│                                                                │
│  MCP Server                                                    │
│  ├── resources: the MCP App HTML (inlined, self-contained)     │
│  ├── tools: search, get_content, submit_comment, pay, …        │
│  └── tool results carry `application/a2ui+json` OR plaited     │
│      BPEvent resources (the host chooses)                      │
│                                                                │
│  PDS (Durable Objects) + RSS + x402 (Monetization Gateway)     │
└───────────────────────────┬──────────────────────────────────┘
                            │ MCP protocol (JSON-RPC)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Client-side — Plaited Reference Client (the host)            │
│                                                                │
│  Host App                                                      │
│  ├── connects to MCP server (plaited mcp-client)              │
│  ├── loads the MCP App resource into a sandboxed iframe       │
│  ├── bridges postMessage ↔ MCP tool calls                      │
│  └── the MCP App's Controller receives pushed render/attrs    │
│      over a WebSocket to the behavioral program                │
│                                                                │
│  MCP App (sandboxed, inlined HTML)                             │
│  ├── plaited Controller + HTML with p-target/p-trigger/p-scale │
│  ├── A2UI Surface equivalent = plaited push-UI regions        │
│  └── p-scale structures the generative UI composition          │
└──────────────────────────────────────────────────────────────┘
```

## Data flow (Variant A)

1. **Load**: the reference client fetches the MCP App resource (an inlined HTML string) from the MCP server and loads it via `srcdoc` in a sandboxed iframe (`sandbox="allow-scripts"`).
2. **Init**: the MCP App's plaited Controller opens a WebSocket to the behavioral program (same origin as the MCP server, or a bridge the host provides). It sends an initial `ui_event` requesting the first render.
3. **Render**: the behavioral program's handler emits a `render` BPEvent with `detail.scale` set (the structural scale of the content). The Controller applies `render`/`attrs` to the live DOM and validates the nesting (`assertScaleNesting`) using the target's `p-scale` and the message's `scale`.
4. **Interact**: a `p-trigger` in the MCP App emits a `ui_event` → the behavioral program responds with the next `render` (with `scale`) → the Controller applies it. The loop is frontier-verifiable.
5. **Pay**: when a tool call is entitlement-gated, the MCP server's tool returns 402 (via Cloudflare Monetization Gateway + x402). The host pays (stablecoin) and retries; the tool then returns the content. The receipt flows back as a `render` showing the unlocked content.

## The MCP server shape (Variant A and C)

The MCP server exposes:

- **Resources**
  - `app://plaited` — the inlined MCP App HTML (Variant A only; absent in C)
  - `content://article/{id}` — article metadata + preview (public)
  - `content://episode/{id}` — episode metadata (public)
- **Tools**
  - `search({ query })` — returns content references
  - `get_content({ id })` — entitlement-gated; returns full text (or 402)
  - `submit_comment({ article_id, text })` — writes an `app.bsky.feed.post` reply record to PDS
  - `pay({ resource })` — x402 payment flow (delegated to the Gateway)
- **The MCP App resource** (Variant A) is built by inlining the plaited Controller + the initial HTML. Use `vite-plugin-singlefile` (or a post-build inline script) to produce a self-contained HTML file served as a single resource — exactly the A2UI-in-MCP-apps guide's "Inlining the Renderer" step, but with the plaited Controller instead of an A2UI renderer.

## Scale as data (the bridge to MCP Apps)

The key adaptation from the A2UI-in-MCP-apps pattern: **carry `scale` in the render message detail, not only as an HTML attribute.** The prompt in `../../prompts/` adds an optional `scale` field to `RenderMessageSchema.detail` and enforces the nesting constraint in both the Renderer and Controller using that field (falling back to the target's `p-scale` attribute when absent).

Why: the MCP App host may not render `p-scale` attributes (Variant B's A2UI host doesn't). By carrying `scale` in the data, the structural intent travels with the payload. The plaited reference client (Variant A) uses it for the nesting check + DOM rendering; a future A2UI host (Variant B) could map it to its component hierarchy. This keeps `p-scale` substrate-neutral per the design spec while letting the plaited Renderer/Controller enforce the constraint when they apply the render.

For the MCP server's tool results that return UI intent as a resource (`application/a2ui+json` or a plaited BPEvent resource), include the `scale` in the resource payload so the host renderer can apply the same nesting rule in its own substrate.

## The reference client (Variant A)

The plaited reference client is a small host app that:

1. Reads an ARD catalog entry (`ai-catalog.json`) pointing at the MCP server's URL.
2. Calls `plaited mcp-client` to discover the server's tools/resources.
3. Fetches the `app://plaited` resource and loads it in a sandboxed iframe.
4. Bridges `postMessage` (from the MCP App) to MCP tool calls (to the server).
5. The MCP App's own Controller handles the WebSocket push loop to the behavioral program (the host doesn't need to mediate renders — the Controller talks to the agent directly, the same as a normal plaited multi-page app).

The reference client is the "browser" for MCP Apps. It can run on-device (a native shell) or in a browser tab. It's the only plaited-specific component a consumer needs to render Variant A.

## ARD catalog entry

The MCP server publishes an `ai-catalog.json` (ARD) entry:

```json
{
  "specVersion": "1.0",
  "host": { "displayName": "Creator Name", "identifier": "did:web:creator.example" },
  "entries": [
    {
      "identifier": "urn:air:creator.example:mcp:content",
      "displayName": "Creator Content + App",
      "type": "application/mcp-server-card+json",
      "url": "https://mcp.creator.example/mcp",
      "description": "Articles, episodes, and a plaited MCP App for agent + human consumption.",
      "capabilities": ["search", "get_content", "submit_comment", "pay"],
      "representativeQueries": [
        "latest articles from Creator",
        "play the newest episode",
        "what did Creator say about topic"
      ]
    }
  ]
}
```

- `identifier` is a URN with the creator's domain (or a hosting platform's domain — per ARD's "Solo Developer Path," `urn:air:hf.co:creator:content` works if hosted on HuggingFace).
- `host.identifier` is the creator's `did:web` — identity is portable, decoupled from the MCP server URL (which can move).
- `url` points at the MCP server's transport endpoint (Cloudflare Workers).
- `representativeQueries` let ARD registries build semantic embeddings so agents searching for the creator's content discover this MCP server.

`you-discover` searches the ARD catalog (or federated registries that crawled this `ai-catalog.json`), so agents find the MCP server without a traditional website.

## x402 integration

The MCP server runs behind the Cloudflare Monetization Gateway. Rules:

- `get_content` for premium content: "charge only unauthenticated callers" — authenticated subscribers pass free; unauthenticated agents get 402 with price + payment instructions.
- The `pay` tool wraps `@x402/mcp` so a tool call triggers the 402-then-pay-then-retry flow. The agent (Siri 2.0, Claude, local LLM) pays in stablecoin; the Gateway verifies at the edge; the tool returns the content.
- Receipts flow back as renders (Variant A) or tool results (Variant C), feeding the analytics + rights agents (Parts 1, 5).

## Variant C (resource-only) divergence

Variant C omits:

- The `app://plaited` resource (no MCP App).
- The reference client (no rendered UI).
- The `scale`-in-render enforcement (nothing to render).

What remains:

- The MCP server with content resources + tools (search, get_content, submit_comment, pay).
- PDS + RSS for human/feed-reader distribution.
- x402 for agent pay-per-request.
- ARD for discovery.

Consumers: agents (Siri 2.0, Claude, local LLMs) query the MCP server directly; humans use RSS or their on-device agent (Shortcuts/Siri — Part 4). `p-scale` annotates content records as latent structural metadata a future renderer could use, but there is no rendered surface today. This is the "don't build a website" minimum.

## What plaited builds (and doesn't)

**Builds:**
- The framework change: `scale` in `RenderMessageSchema.detail` + `assertScaleNesting` in Renderer/Controller (the prompt).
- The MCP server host: a plaited behavioral program running on Cloudflare Workers that emits render/attrs with `scale` and serves the MCP App resource + content/comment/pay tools. This is a plaited project template + skills, not framework code.
- The reference client: a small plaited host app that loads the MCP App and bridges to the MCP server. Also a project template, not framework code.
- An ARD catalog entry template and a `you-discover`-discoverable deployment guide.

**Does not build:**
- Variant B (A2UI emission) — if a user not using the full framework wants A2UI, they adapt; plaited doesn't scaffold skills/threads/code for it.
- A2A — not a dependency (see the A2A evaluation; content sites are consumed by agents, not delegated among agents).

## Open questions

- **WebSocket transport for the MCP App's Controller**: does the Controller connect directly to the behavioral program over WebSocket (same as a normal plaited app), or does the host mediate? Direct is simpler and matches the existing Controller contract; the host only bridges the initial MCP tool calls, not the render loop. Lean: direct.
- **Sandboxing + WebSocket**: a sandboxed iframe with `allow-scripts` can open a WebSocket. Confirm the MCP App's Controller can reach the MCP server's WebSocket endpoint from inside the sandbox (origin restrictions). If blocked, the host proxies the WebSocket via `postMessage` — more work.
- **Inline build**: confirm `vite-plugin-singlefile` (or a Bun equivalent) produces a self-contained HTML file the MCP server can serve as one resource. The plaited Controller is already a small async module; inlining should be straightforward.
- **`scale` in tool-result resources**: for the `application/a2ui+json` resource shape a Variant B host would consume, decide whether plaited's MCP server emits that shape at all. Since plaited doesn't build Variant B, the answer is "not by default" — but the `scale` field on render messages is the seam that would make it possible later.

## References

- [A2UI-in-MCP-apps guide](https://github.com/a2ui-project/a2ui/blob/main/docs/public/guides/a2ui-in-mcp-apps.md)
- [ARD spec](https://github.com/ards-project/ard-spec/blob/main/spec/ard.md)
- [Part 7: progressive web agents rendering layers](../atproto-content-sites/part-7-progressive-web-agents-rendering-layers.md)
- [Part 5: monetization agents + Cloudflare Gateway](../atproto-content-sites/part-5-monetization-agents-cloudflare-gateway.md)
- [Part 2: permissioned data + PDS](../atproto-content-sites/part-2-permissioned-data-local-ai-on-device.md)
- [Design spec (p-scale, vocabulary, carrier model)](../../skills/plaited-framework/references/design-spec.md)
- [Scale-validation prompt](../../prompts/add-scale-validation-to-renderer-and-controller.md)
- Old scale validation: `src/client/template.ts` @ `425dcab14259fd179d6a7af783310e4fb5a53a8a`
