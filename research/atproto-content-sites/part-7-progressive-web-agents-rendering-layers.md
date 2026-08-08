# Progressive Web Agents: Rendering Layers and the Both-Flows Question

*Part 7 of the ATProto content-sites research.* Grounded in plaited's design spec, controller/renderer references, and the emerging A2UI / AG-UI agentic UI stack. This part addresses: can the agent plugin for the stack (Parts 1–5) support both a plaited-native rendering flow AND alternative rendering flows for the output "progressive web agents," without mandating plaited's rendering?

---

## The question, precisely

The plan: an **agent plugin** for the stack we've been researching (ATProto PDS, MCP server, x402, App Intents, on-device personalization, monetization) — the things that make a content site agent-readable, protocol-distributed, and pay-per-request. The output of using this plugin with a coding agent is a **progressive web agent**: an agentic web app whose primary surface is an agent-queryable API + a rendered UI.

The tension: plaited has a rendering framework (Controller/Renderer push model + design spec vocabulary). It's great for the coding-agent's own usage (building the agentic web apps). But **mandating plaited's rendering for every progressive web agent output** limits adoption — a dev who already uses React, Vue, Lit, or Flutter shouldn't have to swap rendering layers to get the stack's distribution/monetization/agent-readability benefits.

The concern: **pulling off generative UI might be hard with other frameworks or more limited.** Plaited's push model + behavioral program + design spec vocabulary are tightly integrated — the vocabulary flows through both SSR (Renderer) and CSR (Controller) unchanged, the behavioral program IS the loop, frontier analysis verifies the composition. Can an alternative rendering layer match that?

**The answer, found in the design spec itself and in the emerging A2UI/AG-UI ecosystem: yes, both flows can be supported, and the design spec already has the split baked in.**

---

## 1. The split the design spec already locks

The [design spec](../../skills/plaited-framework/references/design-spec.md) (decision #1, "Plaited-bound normative") explicitly separates two things:

> "The spec *requires* Plaited's HTML-first substrate as part of its contract — `@scope`, Declarative Shadow DOM, CSS custom properties, the `p-*` attribute surface. Portability to non-Plaited runtimes is out of scope for the *mechanism*. **The *functional vocabulary* (affordances/feedback/patterns) is deliberately substrate-neutral in its *description*** (see Functional flow) so a non-Plaited consumer with a similar trigger→logic→render loop can consume the same vocabulary through its own channel."

This is the architectural seam. Three layers:

| Layer | What it is | Plaited-bound? |
|-------|-----------|---------------|
| **Mechanism** | `p-target`/`p-trigger`/`p-scale`, Controller (WebSocket push), Renderer (SSR), `render`/`attrs`/`dispatch_custom_event`/`navigate` BPEvents | **Yes** — plaited's HTML-first substrate |
| **Functional vocabulary** | `affordances:` (primary, secondary, danger), `feedback:` (error, pending, success, confirmation), `patterns:` (Streams, Pools, Daisy, etc.) | **No** — substrate-neutral in description; "a non-Plaited consumer with a similar trigger→logic→render loop can consume the same vocabulary through its own channel" |
| **Expressive** | `--*` CSS custom property tokens | Tokens are CSS; portable to any web renderer |

The functional flow the spec teaches is substrate-neutral:

```
   user action ──► trigger ──► logic ──► render ──► user sees ──► user acts again
                                  │                       │
                          (holds an affordance,     (styled by the
                           transitions through       affordance/feedback
                           feedback states,          token bundles)
                           renders into a pattern)
```

> "A Plaited agent recognizes its own flow (behavioral threads, Renderer, Controller, BPEvents) in this shape; **a non-Plaited agent with a similar trigger→logic→render loop recognizes *its* flow.** The spec names none of the mechanism — only the shape and the vocabulary that flows through it."

**The design spec was already designed for this.** The vocabulary is the portable layer; the mechanism is one implementation of it. The question is: what are the alternative channels?

---

## 2. The emerging agentic UI stack — A2UI and AG-UI

The broader ecosystem has converged on a **layered agentic UI stack** that maps onto plaited's architecture almost exactly:

| Agentic UI stack layer | What it does | Plaited equivalent |
|------------------------|-------------|-------------------|
| **MCP** | Agent calls tools/data sources | `plaited mcp-client` (already integrated) |
| **A2UI** (Google, Dec 2025) | Declarative generative UI specification — agents emit UI intent as JSON; any renderer (Lit, Angular, Flutter, React, SwiftUI) renders it. "A2UI is the WHAT." | The design spec's functional vocabulary (affordances/feedback/patterns) — the WHAT |
| **AG-UI** (CopilotKit) | Agent↔User Interaction protocol — bi-directional runtime connection, event streaming (SSE/WebSocket), shared state, human-in-the-loop. "AG-UI is the HOW." | Plaited's Controller push model (render/attrs/dispatch/navigate over WebSocket) + behavioral program — the HOW |
| **A2A** | Agent-to-agent communication | Plaited's A2A modnet direction |

### A2UI — the framework-agnostic "WHAT"
[A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/) (Agent-to-User-Interface) is Google's open-source declarative generative UI specification:
- Agents emit **JSON describing UI intent** (component IDs, props, layouts) — not executable code.
- **Framework-agnostic**: same A2UI JSON renders on Lit, Angular, Flutter, React, SwiftUI. The client owns the rendering.
- **Security-first**: declarative data, not code; agents can only request components from a pre-approved catalog.
- **LLM-friendly**: flat JSON structure, easy for models to generate.
- **Streaming**: updateable, agent-generated UIs with low-latency streaming.

([A2UI v0.9 announcement](https://developers.googleblog.com/a2ui-v0-9-generative-ui/); [a2ui.sh: A2UI vs AG-UI](https://a2ui.sh/articles/a2ui-vs-ag-ui); [Medium: Complete Guide to Generative UI 2026](https://medium.com/@akshaychame2/the-complete-guide-to-generative-ui-frameworks-in-2026-fde71c4fa8cc))

### AG-UI — the framework-agnostic "HOW"
[AG-UI](https://docs.ag-ui.com/introduction) (Agent–User Interaction Protocol) is CopilotKit's open-source protocol:
- Standardizes how agents communicate with UIs in real time — **event streaming** (SSE or WebSocket), state synchronization, human-in-the-loop.
- **Framework-agnostic**: works with React, Vue, plain JS; the agent side doesn't care what model/runtime you use.
- Works with any agent framework (LangGraph, CrewAI, Google ADK, Microsoft Agent Framework, AWS Strands).
- Supports generative UI specs (A2UI, MCP-UI, Open-JSON-UI) as the content format it carries.

([AG-UI docs](https://docs.ag-ui.com/introduction); [CopilotKit: AG-UI and A2UI Explained](https://www.copilotkit.ai/blog/ag-ui-and-a2ui-explained-how-the-emerging-agentic-stack-fits-together); [Microsoft: AG-UI](https://techcommunity.microsoft.com/blog/appsonazureblog/ag-ui-the-future-of-agent-driven-user-interfaces/4515769))

### The key insight
> "A2UI and AG-UI aren't competing protocols — they're complementary layers in the agentic stack: A2UI is the what, AG-UI is the how." ([a2ui.sh](https://a2ui.sh/articles/a2ui-vs-ag-ui))

Plaited's architecture maps onto this stack: **the design spec's vocabulary is plaited's A2UI equivalent; the Controller push model is plaited's AG-UI equivalent.** The behavioral program is the agent backend both layers serve.

---

## 3. The two flows — and how to support both

### Flow A: Plaited-native (full power)

The behavioral program emits plaited BPEvents (`render`/`attrs`/`dispatch_custom_event`/`navigate`) → Controller (browser) / Renderer (SSR) applies them → `p-target`/`p-trigger`/`p-scale` DOM + design spec vocabulary (affordances/feedback/patterns as token bundles).

**What this gets you:**
- The vocabulary and mechanism are **integrated** — the same thread emits the render AND the affordance/feedback tokens; no translation layer.
- **Frontier analysis** (`verifyFrontiers`) can verify the behavioral program's UI loop has no deadlock/livelock before it runs — the push model's event graph is closed and analyzable.
- **SSR + CSR share the same flow** — Renderer and Controller are strict subsets of the same transform; the vocabulary flows through both unchanged.
- **Push, not pull** — the agent is the source of truth; no client-side fetch-render loop, no state synchronization problem.
- **Behavioral program IS the UI loop** — b-threads orchestrate the trigger→logic→render cycle; the "mechanic" (sudden vs gradual reveal) is how the thread sequences emits.

This is the "full power" path and the one to use for the coding-agent's own output (the progressive web agent the dev builds with plaited).

### Flow B: Alternative renderer (A2UI/AG-UI emission)

The behavioral program emits **A2UI JSON** (UI intent: component IDs, props, layouts from the design spec's vocabulary) → an **AG-UI event stream** (SSE or WebSocket) carries it → **any framework renderer** (React, Vue, Lit, Flutter) renders it using its own component library.

**What this gets you:**
- **Framework freedom** — a dev who already uses React/Vue/Flutter gets the stack's distribution/monetization/agent-readability without swapping rendering layers.
- **Portable UI intent** — the same A2UI JSON can render on web, mobile, desktop; the client owns the rendering.
- **Ecosystem alignment** — A2UI/AG-UI are emerging standards backed by Google, CopilotKit, Microsoft, Oracle; plaited emits a standard format rather than a proprietary one.
- **The vocabulary still flows** — the design spec's affordances/feedback/patterns map to A2UI component IDs and props; the substrate-neutral vocabulary is the bridge.

**What you lose vs. plaited-native:**
- **No frontier analysis of the UI loop** — the alternative renderer's event graph isn't plaited's behavioral program; you can't `verifyFrontiers` on a React component tree. (You can still verify the *agent's* behavioral program; you just can't verify the *renderer's* response to it.)
- **No integrated SSR/CSR subset guarantee** — the alternative renderer may have its own SSR story (React Server Components, Next.js) but it's not the strict-subset Renderer/Controller relationship plaited has.
- **Translation layer overhead** — emitting A2UI from a plaited behavioral program requires a mapping from BPEvents (render/attrs) to A2UI JSON. This is a thin adapter, not a reimplementation, but it's work.
- **The push model is AG-UI's, not plaited's** — AG-UI is event streaming (SSE/WebSocket) which is conceptually the same as plaited's WebSocket push, but the behavioral program's BPEvents need to be emitted as AG-UI events.

### How both flows coexist — the architecture

```
                    ┌──────────────────────────────────┐
                    │  Behavioral Program (agent)      │
                    │  b-threads, triggers, handlers    │
                    │  (the loop: trigger→logic→render)│
                    └──────────────┬───────────────────┘
                                   │ emits
                    ┌──────────────┴───────────────────┐
                    │                                  │
                    ▼                                  ▼
          ┌─────────────────┐              ┌─────────────────────┐
          │ Flow A: Plaited │              │ Flow B: A2UI/AG-UI  │
          │ BPEvents        │              │ emission            │
          │ render/attrs/   │              │ (A2UI JSON of the   │
          │ dispatch/       │              │  design spec        │
          │ navigate        │              │  vocabulary)        │
          └────────┬────────┘              └──────────┬──────────┘
                   │                                  │
                   ▼                                  ▼
          ┌─────────────────┐              ┌─────────────────────┐
          │ Plaited         │              │ AG-UI event stream  │
          │ Controller /    │              │ (SSE / WebSocket)   │
          │ Renderer        │              └──────────┬──────────┘
          │ (push-UI)       │                         │
          └────────┬────────┘                         ▼
                   │              ┌─────────────────────────────────┐
                   │              │ Any renderer:                   │
                   │              │ React, Vue, Lit, Flutter,       │
                   │              │ SwiftUI, Angular, plain JS      │
                   │              │ (client owns rendering)         │
                   │              └─────────────────────────────────┘
                   ▼
          ┌─────────────────┐
          │ Plaited HTML    │
          │ p-target /      │
          │ p-trigger /     │
          │ p-scale +       │
          │ design spec     │
          │ vocabulary      │
          └─────────────────┘
```

**The same behavioral program can emit both** — a plaited-native BPEvent path (Flow A) and an A2UI/AG-UI emission path (Flow B). The behavioral program is the source of truth in both; the difference is the output adapter. The design spec's vocabulary (affordances/feedback/patterns) is the shared language — in Flow A it becomes plaited render/attrs + token bundles; in Flow B it becomes A2UI component IDs + props.

**This is the "both flows" answer**: the agent plugin doesn't mandate a renderer. It emits UI intent in the design spec's substrate-neutral vocabulary. A plaited renderer (Controller/Renderer) consumes it natively; an A2UI-compatible renderer (React/Vue/Flutter) consumes the A2UI emission. The behavioral program and the stack (ATProto, MCP, x402) are the same in both flows — only the rendering tail differs.

---

## 4. Why generative UI is harder without plaited's integration (the honest assessment)

The concern was right: **pulling off generative UI is harder with alternative renderers.** Here's specifically what's harder and what's not:

### What's harder with Flow B (alternative renderers)

| Capability | Plaited-native (Flow A) | Alternative (Flow B) | Gap |
|-----------|------------------------|----------------------|-----|
| **UI loop verification** | `verifyFrontiers` proves no deadlock/livelock over the closed state graph (BPEvents are the event graph) | Can't verify a React component tree; the renderer's behavior is outside plaited's frontier analysis | **Real gap** — the alternative renderer's response to AG-UI events isn't verifiable the same way |
| **SSR/CSR parity** | Renderer is a strict subset of Controller; same `render`/`attrs` transform; SSR pre-renders, CSR drives live transitions; same vocabulary | React Server Components / Next.js have their own SSR story, but it's not the strict-subset guarantee; SSR and CSR can diverge | **Partial gap** — RSC is good but it's a different parity model |
| **Push-model simplicity** | Agent pushes; Controller applies; no client fetch-render loop; no state sync problem | AG-UI is event streaming (similar conceptually) but the client framework still has its own state model that must sync with AG-UI events | **Small gap** — AG-UI solves the transport; the client framework's state sync is its own concern |
| **Vocabulary-to-tokens integration** | Affordance/feedback token bundles are CSS custom properties that flow through the DOM via inheritance; the thread emits the render AND the tokens in one BPEvent | A2UI JSON describes component IDs + props; the alternative renderer must map those to its own styling system (CSS-in-JS, Tailwind, etc.) | **Translation gap** — the design spec's token-bundle model needs an A2UI mapping |
| **Behavioral program IS the loop** | The thread's request/wait/emit sequence *is* the interaction mechanic (sudden vs gradual reveal) | The agent emits A2UI; the renderer decides how to animate/transition | **Semantic gap** — the "mechanic" is in the thread in Flow A; in Flow B the renderer owns transitions |

### What's NOT harder (or is equally solved)

| Capability | Plaited-native | Alternative | Notes |
|-----------|---------------|-------------|-------|
| **Agent-readable content** (MCP) | ✅ | ✅ | MCP is renderer-agnostic; the agent plugin's MCP server works in both flows |
| **Protocol distribution** (ATProto, RSS) | ✅ | ✅ | Distribution is renderer-agnostic |
| **Monetization** (x402) | ✅ | ✅ | Payment is renderer-agnostic |
| **On-device AI exposure** (App Intents, llms.txt) | ✅ | ✅ | Agent-readability is renderer-agnostic |
| **Streaming UI updates** | ✅ (WebSocket push) | ✅ (AG-UI SSE/WebSocket) | AG-UI is designed for this |
| **Human-in-the-loop** | ✅ (ui_event → agent) | ✅ (AG-UI has approval flows) | Both support it |
| **Tool-call-result rendering** | ✅ (handler emits render) | ✅ (A2UI for tool results) | A2UI is designed for this |

**The bottom line**: the stack's core value (distribution, monetization, agent-readability) is fully renderer-agnostic. Only the **generative UI integration** — vocabulary-to-tokens, SSR/CSR parity, frontier-verifiable UI loop, push-model simplicity — is harder with alternative renderers. And that's exactly the part plaited-native does best.

**So the recommendation**: the agent plugin supports both flows. Plaited-native is the "full power" path (use it for the coding-agent's own output, for demos, for the "5 minutes to wow" flows from Part 6). A2UI/AG-UI emission is the "bring your own renderer" path (use it for devs who already have React/Vue/Flutter and want the stack's distribution/monetization benefits). The behavioral program and the stack are the same in both; the rendering tail is a pluggable adapter.

---

## 5. The catalog question — alternatives without per-agent skills

The concern: "I don't want to have to add skills for other agents." The current `skills/mcp-client/assets/ai-catalog.json` has 8 entries — MCP servers and skills repos. Adding a skill for every alternative renderer (React, Vue, Lit, Flutter) would be unsustainable.

### The better approach: register rendering alternatives in the catalog

The AI Catalog format supports `type` field discrimination. Today the catalog has:
- `application/mcp-server+json` → MCP servers (call via `plaited mcp-client`)
- `application/agent-skills+json` → skills repos (install)

**Proposal: add rendering alternatives as a new entry type**, not as skills:
- `application/a2ui-renderer+json` → A2UI-compatible renderers (React, Vue, Lit, Flutter, SwiftUI) — the catalog points at the renderer's A2UI integration docs, not a plaited skill for each.
- `application/ag-ui-client+json` → AG-UI client libraries (CopilotKit, etc.)

The catalog becomes a registry of "what renderers/protocols are available for progressive web agents." An agent using the plugin discovers: the stack's MCP servers (for content/monetization) AND the rendering alternatives (for the output UI). No per-renderer skill; just catalog entries pointing at the standard (A2UI/AG-UI) integrations.

### The catalog deployment path

The concern: "it's in framework layer but I'm going to eventually deploy it and move it out of skill." This aligns with the AI Catalog's own architecture — it's a deployed, discoverable registry (the [AI Catalog specification](https://ai-catalog.io/specification/) is a format, not a plaited-specific artifact). Moving it out of `skills/mcp-client/assets/` to a deployed location (e.g., a hosted catalog endpoint, or a `plaited.dev`-served catalog) makes it:
- **Discoverable via `you-discover`** — the catalog itself becomes an ARD resource.
- **Versioned independently** of the framework release cycle.
- **Consumable by any agent**, not just plaited — the catalog format is standard; the entries point at standard integrations.
- **Updatable without framework releases** — adding a renderer or an MCP server is a catalog update, not a plaited release.

This is the right architectural direction: the catalog is the **neutral registry**; plaited is one consumer of it; `you-discover` is one way to search it; the entries point at standards (A2UI, AG-UI, MCP) not at plaited-specific skills.

---

## 6. The "progressive web agent" definition

With both flows supported, a **progressive web agent** (the output of using the agent plugin with a coding agent) is:

> An agentic web app whose primary surface is an **agent-queryable API** (MCP server, ATProto PDS records, App Intents) + a **rendered UI** (plaited-native push-UI OR an A2UI/AG-UI-compatible renderer), driven by a **behavioral program** that coordinates distribution, monetization, agent-readability, and rendering through a single event-coordination layer.

The "progressive" part: like a PWA, it's a web app that works as an app. Unlike a PWA, its primary interface is an agent-queryable API, not just an HTML page — agents (Siri 2.0, Claude Desktop, local LLMs) can query it via MCP; humans can use it via the rendered UI; both consume the same behavioral program's output.

### The two flavors

| | Plaited-native PWA | A2UI/AG-UI PWA |
|---|---|---|
| Renderer | Controller + Renderer (push-UI) | React/Vue/Lit/Flutter (A2UI renderer) |
| Transport | WebSocket (plaited) | SSE/WebSocket (AG-UI) |
| UI intent | BPEvents (render/attrs) | A2UI JSON |
| Vocabulary | Design spec (affordances/feedback/patterns) → token bundles | Design spec vocabulary → A2UI component IDs/props |
| UI loop verification | `verifyFrontiers` (frontier analysis) | Not applicable (renderer is external) |
| SSR/CSR | Renderer/Controller strict subset | Renderer's own SSR (RSC, Next.js, etc.) |
| Agent backend | Behavioral program | Behavioral program (same) |
| Stack (ATProto, MCP, x402) | Integrated (same) | Integrated (same) |

Both are progressive web agents. Both use the same agent plugin, the same stack, the same behavioral program. The difference is the rendering tail.

---

## 7. Recommendation — the architecture for the agent plugin

1. **The agent plugin is renderer-agnostic.** It provides the stack: ATProto PDS publishing, MCP server exposure, x402/Cloudflare Gateway monetization, App Intents/llms.txt agent-readability, RSS distribution. None of these mandate a renderer.

2. **The behavioral program is the integration point.** The plugin's handlers emit UI intent in the design spec's substrate-neutral vocabulary (affordances/feedback/patterns). This is the "A2UI equivalent" — the WHAT.

3. **Two rendering adapters consume the vocabulary:**
   - **Plaited-native adapter** (Flow A): maps the vocabulary to BPEvents (render/attrs) → Controller/Renderer. Full power: frontier-verifiable, SSR/CSR parity, push-model. Use for coding-agent output, demos, the "5 minutes to wow" flows.
   - **A2UI/AG-UI adapter** (Flow B): maps the vocabulary to A2UI JSON → AG-UI event stream → any framework renderer. Framework freedom: React, Vue, Lit, Flutter. Use for devs who bring their own renderer.

4. **The catalog (deployed, not in the skill layer) registers both:**
   - MCP servers for the stack's content/monetization tools.
   - A2UI-compatible renderers as rendering alternatives (not skills — catalog entries pointing at standard integrations).
   - AG-UI client libraries as transport alternatives.

5. **`you-discover` searches the deployed catalog.** An agent building a progressive web agent discovers: the stack's MCP servers (for content/payment) AND the rendering alternatives (for the UI tail). The catalog is the neutral registry; `you-discover` is the search; plaited is one renderer; A2UI renderers are others.

6. **The design spec's vocabulary is the portability layer.** It was designed for this ("substrate-neutral in description; a non-Plaited consumer with a similar trigger→logic→render loop can consume the same vocabulary through its own channel"). The A2UI adapter is the "other channel."

---

## 8. What to watch

- **A2UI spec finalization** (Google, public roadmap) — the declarative UI format is still early; v0.9 shipped April 2026. The spec's component-catalog model and streaming update format need to stabilize.
- **AG-UI adoption** — CopilotKit's protocol is gaining traction (Microsoft, Oracle, LangGraph, CrewAI, Google ADK support). Watch for a standard AG-UI client for plain JS/React.
- **A2UI ↔ design spec vocabulary mapping** — the translation from plaited's affordances/feedback/patterns to A2UI component IDs/props is the concrete adapter work. A mapping guide or codegen is the bridge.
- **Frontier analysis for A2UI emission** — can `verifyFrontiers` reason about the behavioral program's A2UI emission graph (the agent's output events) even if it can't reason about the external renderer's response? Partial verification (the agent's emit side is closed; the renderer's apply side is open) is better than none.
- **AI Catalog deployment** — moving `ai-catalog.json` out of `skills/mcp-client/assets/` to a hosted/versioned location, indexed by `you-discover`, with rendering alternatives as a new entry type.

---

## Sources

### Plaited (grounded in repo)
- [skills/plaited-framework/references/design-spec.md](../../skills/plaited-framework/references/design-spec.md) — the substrate-neutral vocabulary split (decision #1), functional flow, carrier model
- [skills/plaited-framework/references/controller.md](../../skills/plaited-framework/references/controller.md) — push model, BPEvents, Controller as message applier
- [skills/plaited-framework/references/renderer.md](../../skills/plaited-framework/references/renderer.md) — SSR strict subset of Controller
- [skills/mcp-client/SKILL.md](../../skills/mcp-client/SKILL.md) — AI Catalog, authoring loop
- [skills/mcp-client/assets/ai-catalog.json](../../skills/mcp-client/assets/ai-catalog.json) — current 8-entry catalog
- [AI Catalog specification](https://ai-catalog.io/specification/)

### A2UI (Google)
- [Google: Introducing A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [Google: A2UI v0.9](https://developers.googleblog.com/a2ui-v0-9-generative-ui/)
- [a2ui.sh: A2UI vs AG-UI](https://a2ui.sh/articles/a2ui-vs-ag-ui)

### AG-UI (CopilotKit)
- [AG-UI docs: Overview](https://docs.ag-ui.com/introduction)
- [AG-UI docs: Generative UI specs](https://docs.ag-ui.com/concepts/generative-ui-specs)
- [CopilotKit: AG-UI and A2UI Explained](https://www.copilotkit.ai/blog/ag-ui-and-a2ui-explained-how-the-emerging-agentic-stack-fits-together)
- [Microsoft: AG-UI](https://techcommunity.microsoft.com/blog/appsonazureblog/ag-ui-the-future-of-agent-driven-user-interfaces/4515769)
- [Oracle: Open Agent Specification for A2UI + CopilotKit + AG-UI](https://blogs.oracle.com/ai-and-datascience/announcing-agent-spec-for-a2ui-copilotkit-ag-ui)

### Generative UI landscape
- [Medium: Complete Guide to Generative UI Frameworks 2026](https://medium.com/@akshaychame2/the-complete-guide-to-generative-ui-frameworks-in-2026-fde71c4fa8cc)
- [agentwiki.org: Generative UI](https://agentwiki.org/generative_ui)
- [MindStudio: Six Agent Protocols 2026](https://www.mindstudio.ai/blog/six-agent-protocols-ai-builders-2026)
- [marktechpost: Coding Deep Dive into Agentic UI](https://www.marktechpost.com/2026/04/30/a-coding-deep-dive-into-agentic-ui-generative-ui-state-synchronization-and-interrupt-driven-approval-flows/)

### Server-driven UI alternatives
- [htmx vs React comparisons (2026)](https://daily.dev/blog/htmx-vs-react-when-hypermedia-beats-javascript-frameworks/)
- [Phoenix LiveView](https://medium.com/@lucasvarelladev/phoenix-liveview-real-time-interactivity-without-writing-a-single-line-of-javascript-cd56712a090c)