# Plaited × you-discover: Compressing Discover → Ship into Minutes

*Part 6 of the ATProto content-sites research.* Grounded in plaited's shipped surfaces (skills, CLI, behavioral runtime, push-UI layer) and the `you-discover` ARD tool. This part pivots from "what the stack is" (Parts 1–5) to "how fast can a developer go from zero to a running, agent-readable, monetizable content site" — and argues plaited + you-discover can compress that path to minutes, not hours.

---

## The problem

Everything defined in Parts 1–5 takes time to set up. ATProto PDS + custom lexicons, MCP server authoring, x402 payment wiring, App Intents, Foundation Models tool protocol, composable labelers — each is a separate spec, SDK, and integration. A developer who wants to build a content site on this stack faces hours of reading before the first running page.

For any live demo, workshop, or first-impression scenario, that is fatal. The bar is "5 seconds to sign up, 5 minutes to wow" — a developer needs to feel the stack working before they have time to question whether it's worth the setup.

**The postulate:** plaited + you-discover can compress the path from zero to a running, agent-readable, monetizable content site into ~5 minutes, because plaited already wraps each step of the stack as an agent-callable primitive and `you-discover` removes the "which tool do I even use?" search.

---

## What each side brings

### Plaited's shipped surfaces (grounded in the repo)

- **Behavioral runtime** (`behavioral`) — b-threads, triggers, handlers, the super-step model. Event-coordination layer for agents. ([skills/plaited-framework/references/behavioral.md](../../skills/plaited-framework/references/behavioral.md))
- **Push-based UI layer** — `Controller` (browser, applies `render`/`attrs`/`dispatch_custom_event`/`navigate` over a WebSocket) + `Renderer` (SSR, synchronous, same transform on a string). The agent is the source of truth for what the page shows; there is no client-side fetch-render loop. ([skills/plaited-framework/references/controller.md](../../skills/plaited-framework/references/controller.md), [renderer.md](../../skills/plaited-framework/references/renderer.md))
- **`plaited mcp-client` CLI** — seven modes (discover, list-tools, list-prompts, list-resources, call-tool, get-prompt, read-resource) for discovering and calling remote MCP servers and authoring skills for them. JSON-in/JSON-out over stdio; supports public, bearer-env, and OAuth auth tiers. ([skills/mcp-client/SKILL.md](../../skills/mcp-client/SKILL.md))
- **`plaited git-context`, `plaited markdown`, `plaited typescript-lsp`** — structured-replacement CLI tools for Git context, markdown link-checking/frontmatter, and LSP-style TypeScript analysis. ([skills/](../../skills/))
- **AI Catalog** — `skills/mcp-client/assets/ai-catalog.json`, a curated ARD list (Bun docs, MDN, MCP/ACP/AgentSkills specs, Varlock, You.com) in the [AI Catalog format](https://ai-catalog.io/specification/). A reference, not a requirement — the engineer may point at any MCP server.
- **Eval / autoresearch / frontier analysis** — capture and grade agent runs (`eval`), hill-climb over behavioral agents (`autoresearch`), and verify no deadlock/livelock over the closed state graph (`verifyFrontiers` / `exploreFrontiers`). ([skills/plaited-framework/references/eval.md](../../skills/plaited-framework/references/eval.md), [autoresearch.md](../../skills/plaited-framework/references/autoresearch.md), [frontier-analysis.md](../../skills/plaited-framework/references/frontier-analysis.md))
- **Skills** — portable `SKILL.md` agent-facing extensions; the composition surface. `plaited mcp-client`'s authoring loop turns a discovered MCP server into an installable skill any agent can load.

### What `you-discover` brings

ARD (Agentic Resource Discovery) — searches You.com's AI Catalog plus GitHub and HuggingFace finders for MCP servers, agents, skills, SDKs, OpenAPI specs, and integration guides. Discovery-only (never installs or connects); returns ranked results. The "yellow pages" for the agent-readable web. ([you-discover skill](https://github.com/youdotcom-oss/agent-skills))

### The combinational insight

`you-discover` *finds* resources; `plaited mcp-client` *calls* them and *authors skills* for them; plaited's behavioral runtime + push-UI *composes them into a running app*; frontier analysis *verifies* the composition. That is the full **discover → connect → compose → verify → ship** loop, and every step is agent-operable.

---

## The compressed loop

| Step | Plaited / you-discover primitive | Time |
|------|----------------------------------|------|
| **Discover** | `you-discover` (ARD across You.com + GitHub + HuggingFace) | seconds |
| **Connect & validate** | `plaited mcp-client` discover / call-tool | seconds |
| **Compose** | `behavioral()` b-threads, triggers, handlers | minutes |
| **Render / ship** | `Controller` (push-UI over WebSocket) + `Renderer` (SSR) | seconds |
| **Verify** | `verifyFrontiers` / `exploreFrontiers` (deadlock/livelock over closed state graph) | seconds |
| **Reuse / publish** | `SKILL.md` authoring (the mcp-client skill's loop) | seconds |
| **Pay** | `@x402` + a behavioral 402→pay→retry handler | seconds |

The reason this can be minutes where the raw stack takes hours: **plaited already wraps each step as an agent-callable CLI or runtime primitive**, and **you-discover removes the "which tool do I even use?" search**. A developer doesn't read the atproto spec, the MCP spec, and the x402 spec — the agent discovers the right resources, validates them, composes them behaviorally, and pushes the result to a live page.

---

## Five ways the compression shows up

### 1. The Live "Discover → Skill → Running App" Loop

A developer types a one-liner; in minutes they have a running web app wired to a remote MCP server they didn't know existed moments ago.

1. `you-discover` "web content search MCP server" → ranked candidates (a news API MCP, a docs MCP).
2. `plaited mcp-client discover` against the top result → see its tools.
3. `plaited mcp-client call-tool` → prove one tool works against the live server (the mcp-client skill's validation step).
4. The behavioral runtime wires the MCP tool as a **handler** inside a b-thread that triggers on `ui_event` (user search) and **pushes** the result via `Controller.render` / `Renderer.render`.
5. `bun run` → a live push-based page: type a query, the agent calls the MCP server, the page updates over WebSocket without a fetch loop.

The developer never wrote an HTTP client, never read API docs, never set up a render loop. `you-discover` found the resource; `mcp-client` connected and validated; the behavioral runtime composed it into a push-UI page. The whole arc — from "what's out there?" to a live app — is one continuous flow. This is the **agent-readable docs** site type (Part 3), built live, against a server the developer just discovered.

### 2. The Skill Forge — Author a Publishable Skill in Minutes

A developer leaves with a *published, installable skill* that any other plaited agent can use — authored against a server they found, validated, and documented, all live.

1. `you-discover` for a useful public MCP server (weather, stocks, a content API).
2. `plaited mcp-client discover` → list tools.
3. Plaited **generates a `SKILL.md`** documenting the relevant tools as inline `plaited mcp-client` examples (the mcp-client skill's authoring loop is built for exactly this).
4. Validate by running one documented example live (`call-tool`).
5. The skill is now a portable artifact: drop it in `.agents/skills/`, any plaited agent loads it and can call the server by following the documented examples.

The output isn't a throwaway demo — it's a **reusable, publishable integration artifact** in the AgentSkills format. The developer started with discovery, ended with something they can commit, share, and that other agents can install. This demonstrates the **ARD → skill → composability** loop that is the whole point of the agent-readable web (Part 3). It's also the same "portable artifact" pattern a content publisher uses when publishing to ATProto as Standard.site — a skill is the analog for MCP.

### 3. The Agent-Readable Content Site, Compressed

A developer goes from empty directory to a content site that (a) publishes to ATProto, (b) is queryable by an MCP client, and (c) renders via plaited's push-UI — in minutes.

1. `plaited bootstrap` the agent scaffold (`create-agent` + behavioral core).
2. `you-discover` "ATProto PDS / Standard.site" → find the `@atproto` SDK and Standard.site lexicon references.
3. `plaited mcp-client` against the atproto/MCP references → get the lexicon shapes.
4. Wire a behavioral handler that, on publish, writes a `site.standard.document` record (public PDS layer, Part 1) and renders the article via `Renderer.render` (SSR) + `Controller` push.
5. Separately, expose the same content as an MCP `read-resource` (plaited as MCP host) so a second terminal running `plaited mcp-client read-resource` can pull the article — proving the site is **agent-readable**, not just human-readable.
6. Open the page; type a comment; the `ui_event` flows back, the agent writes an `app.bsky.feed.post` reply record, and the cross-protocol comment appears.

This is the **protocol-native publication** (Part 1) + **agent-readable** (Part 3) compressed into one flow. The developer sees both halves of the stack thesis in real time: content *published to the open protocol* (ATProto firehose) AND *queryable by an agent* (MCP resource) AND *rendered via push-UI* — three normally-separate concerns wired by one behavioral program. The payoff is watching a comment posted on the site show up as a Bluesky reply without writing glue code.

### 4. The "Discover, Wire, Pay" Monetization Flow, Live

A developer discovers a paid MCP tool, wires it into an app, and watches an agent pay for a call via x402 — with the receipt shown on screen.

1. `you-discover` "x402 paid MCP server" or "pay-per-request API" → find a candidate that returns HTTP 402.
2. `plaited mcp-client discover` → see the tool and its pricing (the 402 payload states price + where to pay).
3. Wire a behavioral handler that calls the tool via `mcp-client call-tool`. The first call returns 402; the agent (or the `@x402/fetch` client) pays in stablecoin and retries.
4. The push-UI renders the paid content **and** the payment receipt (amount, tx hash, settled in under a second) on the page via `Controller.render`.
5. A second handler logs the receipt to the agent's analytics — proving the **monetization agent** role (Part 5) fires automatically.

Money moving on screen, sub-second, no checkout page, no account, in a live app the developer just built — is viscerally impressive. It demonstrates the **premium / token-gated** thesis (Part 5) in the most concrete possible way: agents pay per request, the publisher gets paid, the receipt is real. And it connects `you-discover` (find the paid resource) → `mcp-client` (call it) → plaited behavioral runtime (handle the 402/pay/retry loop as an event-coordination problem the b-thread model is built for) → push-UI (show the result + receipt). The 402-then-pay-then-retry flow is literally a behavioral program (request → waitFor payment → request again), so plaited is the natural substrate for it.

### 5. The "Self-Discovering Agent" — Frontier-Verified Live

A developer watches an agent **discover its own tools, wire them, and verify the wiring works** — autonomously, with the frontier-analysis engine proving correctness.

1. Give the plaited agent a goal: "build me a page that shows the latest [topic] news and lets me comment on Bluesky."
2. The agent runs `you-discover` for relevant MCP servers (a news/content MCP, the You.com search MCP, the atproto-related resources).
3. For each candidate, the agent runs `plaited mcp-client discover` + `call-tool` to validate it actually works.
4. The agent composes the validated tools into a **behavioral program** (b-threads for fetch, render, comment-submit), wires `Controller` push-UI.
5. **Frontier analysis** (`verifyFrontiers` / `exploreFrontiers`) runs over the behavioral program's closed state graph, proving no deadlock/livelock on the tool-call → render → comment-submit paths before the developer ever runs it.
6. `bun run` → live page; if a tool call fails, the agent autoresearch-style hill-climbs the prompt/lexicon choices, capturing the run via `eval`.

This is the **full plaited × you-discover × stack** thesis in one flow: ARD finds tools, mcp-client validates them, the behavioral runtime composes them, frontier analysis *proves* the composition is correct, and the push-UI ships it. The developer isn't hand-wiring — they're watching an agent bootstrap itself from discovery to a verified running app. The payoff is the **autonomy + verifiability** combo: the agent found and wired its own tools, and you can see the proof it won't deadlock. That is a fundamentally different demonstration than "I copy-pasted an API key and got JSON back."

---

## Why this matters for the stack thesis

Parts 1–5 established *what* the stack is and *why* a publisher would want it. This part establishes *how fast* a developer can reach it. The stack's value proposition — agent-readable content, protocol-native distribution, pay-per-request monetization, on-device personalization — is only credible if the path to building it is short. plaited + you-discover makes it short by making every step agent-operable:

- **Discovery** (you-discover) replaces reading specs.
- **Connection** (mcp-client) replaces hand-writing HTTP clients and reading API docs.
- **Composition** (behavioral runtime) replaces ad-hoc orchestration glue.
- **Rendering** (push-UI) replaces the client-side fetch-render-loop boilerplate.
- **Verification** (frontier analysis) replaces "run it and hope it doesn't hang."
- **Reuse** (SKILL.md authoring) replaces one-off scripts with portable artifacts.
- **Payment** (x402 + behavioral handler) replaces building a billing system.

The compressed loop is the "5 minutes to wow" path: a developer goes from "I have heard of this stack" to "I have a running, agent-readable, monetizable content site that I built by watching an agent discover and wire its own tools" — in the time it takes to introduce the stack the old way.

---

## Sources

- [plaited README](../../README.md) — sovereign agent node framework, core shape
- [skills/mcp-client/SKILL.md](../../skills/mcp-client/SKILL.md) — the seven-mode MCP client CLI, the authoring loop
- [skills/plaited-framework/SKILL.md](../../skills/plaited-framework/SKILL.md) — route table to behavioral/controller/renderer/eval/autoresearch/frontier references
- [skills/plaited-framework/references/behavioral.md](../../skills/plaited-framework/references/behavioral.md) — b-threads, super-step model
- [skills/plaited-framework/references/controller.md](../../skills/plaited-framework/references/controller.md) — push-UI, WebSocket, render/attrs/dispatch/navigate
- [skills/plaited-framework/references/renderer.md](../../skills/plaited-framework/references/renderer.md) — SSR, strict subset of Controller
- [skills/plaited-framework/references/frontier-analysis.md](../../skills/plaited-framework/references/frontier-analysis.md) — verifyFrontiers / exploreFrontiers
- [skills/plaited-framework/references/eval.md](../../skills/plaited-framework/references/eval.md) — eval trace primitives
- [skills/plaited-framework/references/autoresearch.md](../../skills/plaited-framework/references/autoresearch.md) — hill-climb loops
- [skills/mcp-client/assets/ai-catalog.json](../../skills/mcp-client/assets/ai-catalog.json) — curated ARD catalog
- [AI Catalog specification](https://ai-catalog.io/specification/)
- [you-discover skill](https://github.com/youdotcom-oss/agent-skills) — ARD across You.com + GitHub + HuggingFace
